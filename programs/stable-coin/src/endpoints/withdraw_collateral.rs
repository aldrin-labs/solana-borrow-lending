//! Allows the user to withdraw their collateral, thereby increasing the chance
//! of getting liquidated. Only if they re-payed all their debt can they
//! withdraw all of the collateral.

use crate::prelude::*;
use anchor_spl::token::{self, Token};

#[derive(Accounts)]
#[instruction(component_bump_seed: u8)]
pub struct WithdrawCollateral<'info> {
    pub borrower: Signer<'info>,
    #[account(
        mut,
        constraint = freeze_wallet.key() == component.freeze_wallet
            @ err::acc("Freeze wallet doesn't match component's configuration"),
    )]
    pub component: Box<Account<'info, Component>>,
    #[account(
        constraint = reserve.key() == component.blp_reserve
            @ err::reserve_mismatch(),
        constraint = !reserve.is_stale(&clock)
            @ borrow_lending::err::reserve_stale(),
    )]
    pub reserve: Box<Account<'info, borrow_lending::models::Reserve>>,
    /// Authorizes transfer from freeze wallet
    #[account(
        seeds = [component.key().as_ref()],
        bump = component_bump_seed,
    )]
    pub component_pda: AccountInfo<'info>,
    /// Returns user's collateral
    #[account(mut)]
    pub freeze_wallet: AccountInfo<'info>,
    #[account(
        mut,
        constraint = receipt.component == component.key()
            @ err::acc("Receipt belongs to a different component"),
        constraint = receipt.borrower == borrower.key()
            @ err::acc("Receipt's borrower doesn't match"),
    )]
    pub receipt: Account<'info, Receipt>,
    /// Tokens from the freeze wallet are sent here.
    #[account(mut)]
    pub borrower_collateral_wallet: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn handle(
    ctx: Context<WithdrawCollateral>,
    component_bump_seed: u8,
    amount: u64,
) -> ProgramResult {
    let accounts = ctx.accounts;

    if amount == 0 {
        msg!("Collateral amount to withdraw mustn't be zero");
        return Err(ErrorCode::InvalidAmount.into());
    }

    // we ought to accrue interest to correctly calculate the owed amount
    accounts.receipt.accrue_interest(
        accounts.clock.slot,
        accounts.component.config.interest.into(),
    )?;

    let amount = amount.min(accounts.receipt.collateral_amount);

    // we don't need checked sub because we've used min
    accounts.receipt.collateral_amount -= amount;

    // in the line above we decreased the collateral amount, so now we're
    // basically asking "suppose user had 'amount' collateral less, would their
    // position still be healthy?" and if the answer is no we throw an error
    let token_market_price =
        accounts.component.market_price(&accounts.reserve)?;
    if !accounts.receipt.is_healthy(
        token_market_price,
        accounts.component.config.max_collateral_ratio.into(),
    )? {
        msg!(
            "Cannot withdraw {} tokens because loan needs to be \
            over-collateralized",
            amount
        );
        return Err(ErrorCode::WithdrawTooLarge.into());
    }

    let pda_seeds = &[
        &accounts.component.key().to_bytes()[..],
        &[component_bump_seed],
    ];
    token::transfer(
        accounts
            .as_withdraw_collateral_context()
            .with_signer(&[&pda_seeds[..]]),
        amount,
    )?;

    Ok(())
}

impl<'info> WithdrawCollateral<'info> {
    pub fn as_withdraw_collateral_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>> {
        let cpi_accounts = token::Transfer {
            from: self.freeze_wallet.clone(),
            to: self.borrower_collateral_wallet.clone(),
            authority: self.component_pda.clone(),
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }
}
