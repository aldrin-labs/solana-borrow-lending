//! A reverse action of [`crate::endpoints::leverage_via_aldrin_amm`] and
//! somewhat similar to [`crate::endpoints::repay_stable_coin`].
//!
//! User gives us amount of collateral to swap into stable coin via intermediary
//! (such as USDC) and we do the swap, leaving any extra USP in the borrower's
//! wallet. (Extra USP after repaying their loan.)
//!
//! # Steps
//! 1. Transfer required amount of collateral to the borrower's wallet. We do
//! this so that we don't use freeze wallet which we couldn't anyway, because
//! the AMM requires that the  signer (borrower) owns both swap wallets.
//!
//! 2. Swap collateral into an intermediary using borrower wallets.
//!
//! 3. Swap all gained intermediary into stable coin.
//!
//! 4. Repay loan and decrement the collateral amount.
//!
//! 5. Burn lent tokens and transfer fees into admin wallets.

use crate::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount};
use cpis::aldrin::SwapCpi;

#[derive(Accounts)]
#[instruction(component_bump_seed: u8)]
pub struct DeleverageViaAldrinAmm<'info> {
    pub borrower: Signer<'info>,
    #[account(
        constraint = stable_coin.key() == component.stable_coin
            @ err::stable_coin_mismatch(),
        constraint = stable_coin.mint == stable_coin_mint.key()
            @ err::stable_coin_mint_mismatch(),
    )]
    pub stable_coin: Box<Account<'info, StableCoin>>,
    /// We need to mutate the allowance in the config.
    #[account(mut)]
    pub component: Box<Account<'info, Component>>,
    /// Used to transfer tokens from the component to the borrower's wallet.
    #[account(
        seeds = [component.key().as_ref()],
        bump = component_bump_seed,
    )]
    pub component_pda: AccountInfo<'info>,
    /// The borrower repays what's owed in interest here.
    #[account(
        mut,
        constraint = interest_wallet.key() == component.interest_wallet
            @ err::acc("Interest wallet must match component's config"),
    )]
    pub interest_wallet: AccountInfo<'info>,
    /// The borrower repays what's owed in borrow fees here.
    #[account(
        mut,
        constraint = borrow_fee_wallet.key() == component.borrow_fee_wallet
            @ err::acc("Borrow fee wallet must match component's config"),
    )]
    pub borrow_fee_wallet: AccountInfo<'info>,
    /// We transfer given amount of collateral from here to the borrower's
    /// wallet.
    #[account(
        mut,
        constraint = freeze_wallet.key() == component.freeze_wallet
            @ err::freeze_wallet_mismatch(),
    )]
    pub freeze_wallet: AccountInfo<'info>,
    /// Needs to be mutable because we burn tokens.
    #[account(mut)]
    pub stable_coin_mint: AccountInfo<'info>,
    #[account(
        mut,
        constraint = receipt.component == component.key()
            @ err::acc("Receipt belongs to a different component"),
        constraint = receipt.borrower == borrower.key()
            @ err::acc("Receipt's borrower doesn't match"),
    )]
    pub receipt: Box<Account<'info, Receipt>>,
    /// We transfer from freeze wallet to this wallet, and then do the swap
    /// from collateral to intermediary. The user doesn't end up with any more
    /// tokens in this wallet.
    #[account(mut)]
    pub borrower_collateral_wallet: AccountInfo<'info>,
    /// The borrower might end up with more stable coin than they started with
    /// if the collateral value is higher than the borrowed amount.
    #[account(mut)]
    pub borrower_stable_coin_wallet: Box<Account<'info, TokenAccount>>,
    /// We swap collateral to intermediary token and all those tokens are again
    /// swapped into collateral. So in the end, no extra tokens are left in
    /// this wallet.
    #[account(mut)]
    pub borrower_intermediary_wallet: Box<Account<'info, TokenAccount>>,
    // -------------- AMM Accounts ----------------
    #[account(
        executable,
        constraint = stable_coin.aldrin_amm == amm_program.key()
            @ err::aldrin_amm_program_mismatch(),
    )]
    pub amm_program: AccountInfo<'info>,
    /// Collateral into intermediary swap
    pub pool_1: AccountInfo<'info>,
    pub pool_signer_1: AccountInfo<'info>,
    #[account(mut)]
    pub pool_mint_1: AccountInfo<'info>,
    #[account(mut)]
    pub base_token_vault_1: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub quote_token_vault_1: AccountInfo<'info>,
    #[account(mut)]
    pub fee_pool_wallet_1: AccountInfo<'info>,
    /// Intermediary into stable coin swap
    pub pool_2: AccountInfo<'info>,
    pub pool_signer_2: AccountInfo<'info>,
    #[account(mut)]
    pub pool_mint_2: AccountInfo<'info>,
    #[account(mut)]
    pub base_token_vault_2: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub quote_token_vault_2: AccountInfo<'info>,
    #[account(mut)]
    pub fee_pool_wallet_2: AccountInfo<'info>,
    // -------------- Other ----------------
    pub token_program: Program<'info, Token>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn handle(
    ctx: Context<DeleverageViaAldrinAmm>,
    component_bump_seed: u8,
    collateral_amount: u64,
    min_intermediary_swap_return: u64,
    min_stable_coin_swap_return: u64,
) -> ProgramResult {
    let accounts = ctx.accounts;

    accounts.receipt.accrue_interest(
        accounts.clock.slot,
        accounts.component.config.interest.to_dec(),
    )?;

    if accounts.receipt.collateral_amount < collateral_amount {
        msg!(
            "Cannot deleverage more than {} tokens",
            accounts.receipt.collateral_amount
        );
        return Err(ErrorCode::InvalidAmount.into());
    }

    // record initial amounts so that we can swap all
    let initial_borrower_intermediary =
        accounts.borrower_intermediary_wallet.amount;
    let initial_borrower_stable_coin =
        accounts.borrower_stable_coin_wallet.amount;

    //
    // 1.
    //

    let pda_seeds = &[
        &accounts.component.key().to_bytes()[..],
        &[component_bump_seed],
    ];
    token::transfer(
        accounts
            .as_collateral_to_borrower_wallet_context()
            .with_signer(&[&pda_seeds[..]]),
        collateral_amount,
    )?;

    //
    // 2.
    //

    accounts.swap_collateral_to_intermediary(
        collateral_amount,
        min_intermediary_swap_return,
    )?;

    //
    // 3.
    //

    accounts.borrower_intermediary_wallet.reload()?;
    let final_borrower_intermediary =
        accounts.borrower_intermediary_wallet.amount;
    let intermediary_gained = final_borrower_intermediary
        .checked_sub(initial_borrower_intermediary)
        .ok_or(ErrorCode::MathOverflow)?;
    accounts.swap_intermediary_to_stable_coin(
        intermediary_gained,
        min_stable_coin_swap_return,
    )?;

    //
    // 4.
    //

    accounts.borrower_stable_coin_wallet.reload()?;
    let final_borrower_stable_coin =
        accounts.borrower_stable_coin_wallet.amount;
    let stable_coin_gained = final_borrower_stable_coin
        .checked_sub(initial_borrower_stable_coin)
        .ok_or(ErrorCode::MathOverflow)?;
    // we checked that the provided amount is less or eq to the receipt
    accounts.receipt.collateral_amount -= collateral_amount;
    let RepaidShares {
        repaid_borrow,
        repaid_interest,
        repaid_borrow_fee,
    } = accounts.receipt.repay(
        &mut accounts.component.config,
        accounts.clock.slot,
        Decimal::from(stable_coin_gained),
    )?;

    //
    // 5.
    //

    // burn what's been minted to the user at the time of borrow
    token::burn(accounts.as_burn_stable_coin_context(), repaid_borrow)?;
    // pay borrow fee into a dedicated wallet
    token::transfer(accounts.as_pay_borrow_fee_context(), repaid_borrow_fee)?;
    // pay interest into a dedicated wallet
    token::transfer(accounts.as_pay_interest_context(), repaid_interest)?;

    // we don't need to check that the position is healthy, because the user
    // won't be able to withdraw unless the position is healthy, and if it's
    // not healthy then they get liquidated
    //
    // so the collateral covers all the stable coin
    Ok(())
}

impl<'info> DeleverageViaAldrinAmm<'info> {
    pub fn as_collateral_to_borrower_wallet_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>> {
        let cpi_accounts = token::Transfer {
            from: self.freeze_wallet.to_account_info(),
            to: self.borrower_collateral_wallet.to_account_info(),
            authority: self.component_pda.to_account_info(),
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }

    pub fn as_burn_stable_coin_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, token::Burn<'info>> {
        let cpi_accounts = token::Burn {
            mint: self.stable_coin_mint.to_account_info(),
            to: self.borrower_stable_coin_wallet.to_account_info(),
            authority: self.borrower.to_account_info(),
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }

    pub fn as_pay_borrow_fee_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>> {
        let cpi_accounts = token::Transfer {
            from: self.borrower_stable_coin_wallet.to_account_info(),
            to: self.borrow_fee_wallet.to_account_info(),
            authority: self.borrower.to_account_info(),
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }

    pub fn as_pay_interest_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>> {
        let cpi_accounts = token::Transfer {
            from: self.borrower_stable_coin_wallet.to_account_info(),
            to: self.interest_wallet.to_account_info(),
            authority: self.borrower.to_account_info(),
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }
}

impl<'info> DeleverageViaAldrinAmm<'info> {
    fn swap_collateral_to_intermediary(
        &self,
        amount_to_swap: u64,
        min_swap_return: u64,
    ) -> ProgramResult {
        let side = if self.base_token_vault_1.mint
            == self.borrower_intermediary_wallet.mint
        {
            borrow_lending::models::aldrin_amm::Side::Bid
        } else {
            borrow_lending::models::aldrin_amm::Side::Ask
        };

        let collateral_wallet =
            self.borrower_collateral_wallet.to_account_info();
        let intermediary_wallet =
            self.borrower_intermediary_wallet.to_account_info();
        let (user_base_wallet, user_quote_wallet) = if side.is_ask() {
            (collateral_wallet, intermediary_wallet)
        } else {
            (intermediary_wallet, collateral_wallet)
        };

        SwapCpi {
            amm_program: *self.amm_program.key,
            pool: self.pool_1.to_account_info(),
            pool_signer: self.pool_signer_1.to_account_info(),
            pool_mint: self.pool_mint_1.to_account_info(),
            fee_pool_wallet: self.fee_pool_wallet_1.to_account_info(),
            base_token_vault: self.base_token_vault_1.to_account_info(),
            quote_token_vault: self.quote_token_vault_1.to_account_info(),
            user_base_wallet: user_base_wallet,
            user_quote_wallet: user_quote_wallet,
            user: self.borrower.to_account_info(),
            token_program: self.token_program.to_account_info(),
        }
        .swap(amount_to_swap, min_swap_return, side.is_ask())?;

        Ok(())
    }

    fn swap_intermediary_to_stable_coin(
        &self,
        amount_to_swap: u64,
        min_swap_return: u64,
    ) -> ProgramResult {
        let side = if self.base_token_vault_2.mint
            == self.borrower_stable_coin_wallet.mint
        {
            borrow_lending::models::aldrin_amm::Side::Bid
        } else {
            borrow_lending::models::aldrin_amm::Side::Ask
        };

        let intermediary_wallet =
            self.borrower_intermediary_wallet.to_account_info();
        let stable_coin_wallet =
            self.borrower_stable_coin_wallet.to_account_info();
        let (user_base_wallet, user_quote_wallet) = if side.is_ask() {
            (intermediary_wallet, stable_coin_wallet)
        } else {
            (stable_coin_wallet, intermediary_wallet)
        };

        SwapCpi {
            amm_program: *self.amm_program.key,
            pool: self.pool_2.to_account_info(),
            pool_signer: self.pool_signer_2.to_account_info(),
            pool_mint: self.pool_mint_2.to_account_info(),
            fee_pool_wallet: self.fee_pool_wallet_2.to_account_info(),
            base_token_vault: self.base_token_vault_2.to_account_info(),
            quote_token_vault: self.quote_token_vault_2.to_account_info(),
            user_base_wallet: user_base_wallet,
            user_quote_wallet: user_quote_wallet,
            user: self.borrower.to_account_info(),
            token_program: self.token_program.to_account_info(),
        }
        .swap(amount_to_swap, min_swap_return, side.is_ask())?;

        Ok(())
    }
}
