//! Liquidator provides stable coin tokens, which are burned, and gets
//! collateral tokens at a discounted price. The amount given to the liquidator
//! is then subtracted from user's receipt, and the amount of stable coin tokens
//! burned is also subtracted from the user's receipt.

use crate::prelude::*;
use anchor_spl::token::{self, Token};

#[derive(Accounts)]
#[instruction(component_bump_seed: u8)]
pub struct LiquidatePosition<'info> {
    pub liquidator: Signer<'info>,
    #[account(
        constraint = stable_coin.key() == component.stable_coin
            @ err::stable_coin_mismatch(),
        constraint = stable_coin.mint == stable_coin_mint.key()
            @ err::stable_coin_mint_mismatch(),
    )]
    pub stable_coin: Box<Account<'info, StableCoin>>,
    #[account(mut)]
    pub stable_coin_mint: AccountInfo<'info>,
    /// We need to mutate mint allowance in config.
    #[account(
        mut,
        constraint = freeze_wallet.key() == component.freeze_wallet
            @ err::freeze_wallet_mismatch(),
    )]
    pub component: Box<Account<'info, Component>>,
    /// Authorizes transfer from freeze wallet.
    #[account(
        seeds = [component.to_account_info().key.as_ref()],
        bump = component_bump_seed,
    )]
    pub component_pda: AccountInfo<'info>,
    #[account(
        constraint = reserve.key() == component.blp_reserve
            @ err::reserve_mismatch(),
        constraint = !reserve.is_stale(&clock)
            @ borrow_lending::err::reserve_stale(),
    )]
    pub reserve: Box<Account<'info, borrow_lending::models::Reserve>>,
    /// Gives user's collateral away to liquidator at a discount price.
    #[account(mut)]
    pub freeze_wallet: AccountInfo<'info>,
    #[account(
        mut,
        constraint = liquidation_fee_wallet.key() == component.liquidation_fee_wallet
            @ err::acc("Liq. fee wallet must match component's config"),
    )]
    pub liquidation_fee_wallet: AccountInfo<'info>,
    #[account(
        mut,
        constraint = interest_wallet.key() == component.interest_wallet
            @ err::acc("Interest wallet must match component's config"),
    )]
    pub interest_wallet: AccountInfo<'info>,
    #[account(
        mut,
        constraint = borrow_fee_wallet.key() == component.borrow_fee_wallet
            @ err::acc("Borrow fee wallet must match component's config"),
    )]
    pub borrow_fee_wallet: AccountInfo<'info>,
    #[account(
        mut,
        constraint = receipt.component == component.key()
            @ err::acc("Receipt belongs to a different component"),
    )]
    pub receipt: Account<'info, Receipt>,
    /// Some tokens in this wallet are burned.
    #[account(mut)]
    pub liquidator_stable_coin_wallet: AccountInfo<'info>,
    /// And in return the liquidator gets tokens from freeze wallet into this
    /// one.
    #[account(mut)]
    pub liquidator_collateral_wallet: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn handle(
    ctx: Context<LiquidatePosition>,
    component_bump_seed: u8,
) -> ProgramResult {
    let accounts = ctx.accounts;

    let token_market_price = accounts
        .component
        .smallest_unit_market_price(&accounts.reserve)?;
    let Liquidate {
        repaid_shares,
        liquidator_collateral_tokens,
        platform_collateral_tokens,
    } = accounts.receipt.liquidate(
        &accounts.component.config,
        accounts.clock.slot,
        token_market_price,
    )?;
    let RepaidShares {
        repaid_borrow_fee,
        repaid_interest,
        repaid_borrow,
    } = repaid_shares;

    accounts.component.config.mint_allowance = accounts
        .component
        .config
        .mint_allowance
        .checked_add(repaid_borrow)
        .ok_or(ErrorCode::MathOverflow)?;

    token::burn(accounts.as_burn_stable_coin_context(), repaid_borrow)?;

    // pay liquidator
    let pda_seeds = &[
        &accounts.component.key().to_bytes()[..],
        &[component_bump_seed],
    ];
    token::transfer(
        accounts
            .as_claim_discounted_collateral_context()
            .with_signer(&[&pda_seeds[..]]),
        liquidator_collateral_tokens,
    )?;

    // pay fee to stable coin's admin
    let pda_seeds = &[
        &accounts.component.key().to_bytes()[..],
        &[component_bump_seed],
    ];
    token::transfer(
        accounts
            .as_pay_liquidation_fee_context()
            .with_signer(&[&pda_seeds[..]]),
        platform_collateral_tokens,
    )?;

    // pay borrow fee into a dedicated admin's wallet
    token::transfer(accounts.as_pay_borrow_fee_context(), repaid_borrow_fee)?;
    // pay interest into a dedicated admin's wallet
    token::transfer(accounts.as_pay_interest_context(), repaid_interest)?;

    Ok(())
}

impl<'info> LiquidatePosition<'info> {
    pub fn as_burn_stable_coin_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, token::Burn<'info>> {
        let cpi_accounts = token::Burn {
            mint: self.stable_coin_mint.to_account_info(),
            to: self.liquidator_stable_coin_wallet.to_account_info(),
            authority: self.liquidator.to_account_info(),
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }

    pub fn as_claim_discounted_collateral_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>> {
        let cpi_accounts = token::Transfer {
            from: self.freeze_wallet.clone(),
            to: self.liquidator_collateral_wallet.clone(),
            authority: self.component_pda.clone(),
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }

    pub fn as_pay_liquidation_fee_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>> {
        let cpi_accounts = token::Transfer {
            from: self.freeze_wallet.clone(),
            to: self.liquidation_fee_wallet.clone(),
            authority: self.component_pda.clone(),
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }

    pub fn as_pay_borrow_fee_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>> {
        let cpi_accounts = token::Transfer {
            from: self.liquidator_stable_coin_wallet.clone(),
            to: self.borrow_fee_wallet.to_account_info(),
            authority: self.liquidator.to_account_info(),
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }

    pub fn as_pay_interest_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>> {
        let cpi_accounts = token::Transfer {
            from: self.liquidator_stable_coin_wallet.to_account_info(),
            to: self.interest_wallet.to_account_info(),
            authority: self.liquidator.to_account_info(),
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }
}
