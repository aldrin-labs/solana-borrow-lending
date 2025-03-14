//! Instead of user having to borrow stable coin, swap it for collateral,
//! deposit collateral, borrow stable coin, and so on many times, we offer
//! leverage logic which performs this in a single step.
//!
//! The user tells us how many stable coin tokens to mint. They provide
//! AMM's pool for an intermediary token and stable coin, e.g. USP/USDC. They
//! also provide us with pool intermediary token and collateral, e.g. USDC/SOL.
//!
//!
//! # Steps
//! 1. Calculate leverage [ref. eq. (13)] and from that calculate how many
//! stable coin tokens to mint by multiplying the initial borrow amount of
//! stable coin. The user must have deposited enough collateral for the initial
//! borrow amount.
//!
//! 2. Swap minted stable coin into an intermediary token. We use an
//! intermediary token because there won't be pools which would allow us to swap
//! from stable coin directly to collateral.
//!
//! 3. Swap from intermediary token to collateral token.
//!
//! 4. Transfer the collateral tokens into freeze wallet and add the amount to
//! the receipt as collateral.
//!
//! 5. Keep track of the borrow and new collateral in the receipt.
//!
//!
//! # Important
//! Leverage position does not deposit any tokens into the user's wallet but
//! rather uses them to buy more collateral.
//!
//!
//! # Example
//! Reserve:
//! - mSOL: $100
//! - Borrow fee: 0.05%
//! - Liquidation fee: 12.5%
//! - Interest rate: 1.5%
//! - MCR: 80%
//!
//! Leverage position:
//! 1. A user puts 2 mSOL as collateral and enables leverage.
//! 2. The UI automatically puts the borrow at the max of 80%
//! 3. $160 (borrow) is 80% of $200 which is the collateral value.
//! 4. The max leverage for this would be 4.99x, meaning the max amount of USP
//! that could be borrowed with max leverage will be 798.4 USP tokens (160 x
//! 4.99).
//!
//! (1 - 0.8^30) / (1 - 0.8) ~= 4.993
//!
//! 5. If we change the borrow to 70% then the max leverage will change to
//! 3.33x, meaning the new borrow will be $140, the expected amount to be
//! borrowed with leverage will be 466.2 USP (140 x 3.33).
//!
//! (1 - 0.7^30) / (1 - 0.7) ~= 3.333
//!
//! 6. The formula used to obtain leverage is (1-LTV^30) / (1-LTV).

use crate::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount};
use cpis::aldrin::SwapCpi;

#[derive(Accounts)]
#[instruction(stable_coin_bump_seed: u8)]
pub struct LeverageViaAldrinAmm<'info> {
    pub borrower: Signer<'info>,
    #[account(
        constraint = stable_coin.key() == component.stable_coin
            @ err::stable_coin_mismatch(),
        constraint = stable_coin.mint == stable_coin_mint.key()
            @ err::stable_coin_mint_mismatch(),
    )]
    pub stable_coin: Box<Account<'info, StableCoin>>,
    /// CHECK: UNSAFE_CODES#signer
    #[account(
        seeds = [component.stable_coin.as_ref()],
        bump = stable_coin_bump_seed,
    )]
    pub stable_coin_pda: AccountInfo<'info>,
    /// We need to mutate mint allowance in config.
    #[account(mut)]
    pub component: Box<Account<'info, Component>>,
    #[account(
        constraint = reserve.key() == component.blp_reserve
            @ err::reserve_mismatch(),
        constraint = !reserve.is_stale(&clock)
            @ borrow_lending::err::reserve_stale(),
    )]
    pub reserve: Box<Account<'info, borrow_lending::models::Reserve>>,
    /// The swapped collateral is eventually transferred here
    ///
    /// CHECK: UNSAFE_CODES#wallet
    #[account(
        mut,
        constraint = freeze_wallet.key() == component.freeze_wallet
            @ err::freeze_wallet_mismatch(),
    )]
    pub freeze_wallet: AccountInfo<'info>,
    /// Needed to mint new stable coin tokens
    ///
    /// CHECK: UNSAFE_CODES#wallet
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
    /// Stable coin is minted here, but then swapped so in the end there're no
    /// extra tokens remaining (i.e. same amount as in the beginning)
    ///
    /// CHECK: UNSAFE_CODES#wallet
    #[account(mut)]
    pub borrower_stable_coin_wallet: AccountInfo<'info>,
    /// Intermediary token (e.g. USDC) is swapped for collateral wallet, so in
    /// the end there's no extra tokens remaining (i.e. same amount as in the
    /// beginning)
    #[account(mut)]
    pub borrower_intermediary_wallet: Box<Account<'info, TokenAccount>>,
    /// Collateral is swapped for intermediary into this wallet, but then it's
    /// transferred to freeze wallet so there're no extra tokens remaining
    /// (i.e. same amount as in the beginning)
    #[account(mut)]
    pub borrower_collateral_wallet: Box<Account<'info, TokenAccount>>,
    // -------------- AMM Accounts ----------------
    /// CHECK: UNSAFE_CODES#constraints
    #[account(
        executable,
        constraint = stable_coin.aldrin_amm == amm_program.key()
            @ err::aldrin_amm_program_mismatch(),
    )]
    pub amm_program: AccountInfo<'info>,
    /// This is pool which gets us from stable coin token to intermediary token
    ///
    /// CHECK: UNSAFE_CODES#amm
    pub pool_1: AccountInfo<'info>,
    /// CHECK: UNSAFE_CODES#amm
    pub pool_signer_1: AccountInfo<'info>,
    /// CHECK: UNSAFE_CODES#amm
    #[account(mut)]
    pub pool_mint_1: AccountInfo<'info>,
    #[account(mut)]
    pub base_token_vault_1: Box<Account<'info, TokenAccount>>,
    /// CHECK: UNSAFE_CODES#amm
    #[account(mut)]
    pub quote_token_vault_1: AccountInfo<'info>,
    /// CHECK: UNSAFE_CODES#amm
    #[account(mut)]
    pub fee_pool_wallet_1: AccountInfo<'info>,
    /// This is pool which gets us from intermediary token to collateral token
    ///
    /// CHECK: UNSAFE_CODES#amm
    pub pool_2: AccountInfo<'info>,
    /// CHECK: UNSAFE_CODES#amm
    pub pool_signer_2: AccountInfo<'info>,
    /// CHECK: UNSAFE_CODES#amm
    #[account(mut)]
    pub pool_mint_2: AccountInfo<'info>,
    #[account(mut)]
    pub base_token_vault_2: Box<Account<'info, TokenAccount>>,
    /// CHECK: UNSAFE_CODES#amm
    #[account(mut)]
    pub quote_token_vault_2: AccountInfo<'info>,
    /// CHECK: UNSAFE_CODES#amm
    #[account(mut)]
    pub fee_pool_wallet_2: AccountInfo<'info>,
    // -------------- Other ----------------
    pub token_program: Program<'info, Token>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn handle(
    ctx: Context<LeverageViaAldrinAmm>,
    stable_coin_bump_seed: u8,
    collateral_ratio: Decimal,
    initial_stable_coin_amount: u64,
    min_intermediary_swap_return: u64,
    min_collateral_swap_return: u64,
) -> Result<()> {
    let accounts = ctx.accounts;

    //
    // 1.
    //

    // user must already have deposited collateral
    let token_market_price = accounts
        .component
        .smallest_unit_market_price(&accounts.reserve)?;
    let remaining_borrow_value = accounts.receipt.remaining_borrow_value(
        token_market_price,
        accounts.component.config.max_collateral_ratio.to_dec(),
    )?;
    let initial_borrow_value = Decimal::from(initial_stable_coin_amount)
        .try_div(Decimal::from(consts::STABLE_COIN_DECIMALS as u64))?;
    if remaining_borrow_value < initial_borrow_value {
        msg!(
            "Cannot borrow more than {}, but requested {}",
            remaining_borrow_value,
            initial_borrow_value
        );
        return Err(ErrorCode::BorrowTooLarge.into());
    }

    let max_collateral_ratio =
        accounts.component.config.max_collateral_ratio.to_dec();
    if collateral_ratio > max_collateral_ratio {
        msg!("Max collateral ratio is {}", max_collateral_ratio);
        return Err(ErrorCode::CannotGoOverMaxCollateralRatio.into());
    }

    // ref. eq. (13)
    let leverage = (Decimal::one()
        .try_sub(collateral_ratio.try_pow(consts::MAX_LEVERAGE_LOOPS)?)?)
    .try_div(Decimal::one().try_sub(collateral_ratio)?)?;

    // we don't need to scale by decimals because the initial_stable_coin_amount
    // already comes in the smallest unit
    let stable_coin_amount_to_mint: u64 = leverage
        .try_mul(Decimal::from(initial_stable_coin_amount))?
        .try_floor_u64()?;

    let pda_seeds = &[
        &accounts.component.stable_coin.to_bytes()[..],
        &[stable_coin_bump_seed],
    ];
    token::mint_to(
        accounts
            .as_mint_stable_coin_context()
            .with_signer(&[&pda_seeds[..]]),
        stable_coin_amount_to_mint,
    )?;

    let initial_borrower_collateral =
        accounts.borrower_collateral_wallet.amount;
    let initial_borrower_intermediary =
        accounts.borrower_intermediary_wallet.amount;

    //
    // 2.
    //

    accounts.swap_stable_coin_to_intermediary(
        stable_coin_amount_to_mint,
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
    accounts.swap_intermediary_to_collateral(
        intermediary_gained,
        min_collateral_swap_return,
    )?;

    //
    // 4.
    //

    accounts.borrower_collateral_wallet.reload()?;
    let final_borrower_collateral = accounts.borrower_collateral_wallet.amount;
    let collateral_gained = final_borrower_collateral
        .checked_sub(initial_borrower_collateral)
        .ok_or(ErrorCode::MathOverflow)?;
    token::transfer(
        accounts.as_swapped_collateral_to_freeze_wallet_context(),
        collateral_gained,
    )?;

    //
    // 5.
    //

    accounts.receipt.collateral_amount = accounts
        .receipt
        .collateral_amount
        .checked_add(collateral_gained)
        .ok_or(ErrorCode::MathOverflow)?;
    accounts.receipt.borrow(
        &mut accounts.component.config,
        accounts.clock.slot,
        stable_coin_amount_to_mint,
        token_market_price,
    )?;

    Ok(())
}

impl<'info> LeverageViaAldrinAmm<'info> {
    pub fn as_mint_stable_coin_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, token::MintTo<'info>> {
        let cpi_accounts = token::MintTo {
            mint: self.stable_coin_mint.to_account_info(),
            to: self.borrower_stable_coin_wallet.to_account_info(),
            authority: self.stable_coin_pda.to_account_info(),
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }

    pub fn as_swapped_collateral_to_freeze_wallet_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>> {
        let cpi_accounts = token::Transfer {
            from: self.borrower_collateral_wallet.to_account_info(),
            to: self.freeze_wallet.to_account_info(),
            authority: self.borrower.to_account_info(),
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }
}

impl<'info> LeverageViaAldrinAmm<'info> {
    fn swap_stable_coin_to_intermediary(
        &self,
        amount_to_swap: u64,
        min_swap_return: u64,
    ) -> Result<()> {
        let side = if self.base_token_vault_1.mint
            == self.borrower_intermediary_wallet.mint
        {
            borrow_lending::models::aldrin_amm::Side::Bid
        } else {
            borrow_lending::models::aldrin_amm::Side::Ask
        };

        let stable_coin_wallet =
            self.borrower_stable_coin_wallet.to_account_info();
        let intermediary_wallet =
            self.borrower_intermediary_wallet.to_account_info();
        let (user_base_wallet, user_quote_wallet) = if side.is_ask() {
            (stable_coin_wallet, intermediary_wallet)
        } else {
            (intermediary_wallet, stable_coin_wallet)
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

    fn swap_intermediary_to_collateral(
        &self,
        amount_to_swap: u64,
        min_swap_return: u64,
    ) -> Result<()> {
        let side = if self.base_token_vault_2.mint
            == self.borrower_collateral_wallet.mint
        {
            borrow_lending::models::aldrin_amm::Side::Bid
        } else {
            borrow_lending::models::aldrin_amm::Side::Ask
        };

        let intermediary_wallet =
            self.borrower_intermediary_wallet.to_account_info();
        let collateral_wallet =
            self.borrower_collateral_wallet.to_account_info();
        let (user_base_wallet, user_quote_wallet) = if side.is_ask() {
            (intermediary_wallet, collateral_wallet)
        } else {
            (collateral_wallet, intermediary_wallet)
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
