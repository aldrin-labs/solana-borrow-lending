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
        constraint = freeze_wallet.key() == component.freeze_wallet,
    )]
    pub component: Account<'info, Component>,
    /// Authorizes transfer from freeze wallet
    #[account(
        seeds = [component.key().as_ref()],
        bump = component_bump_seed,
    )]
    pub component_pda: AccountInfo<'info>,
    /// Freezes user's collateral tokens.
    #[account(mut)]
    pub freeze_wallet: AccountInfo<'info>,
    #[account(
        mut,
        constraint = receipt.component == component.key(),
        constraint = receipt.borrower == borrower.key(),
    )]
    pub receipt: Account<'info, Receipt>,
    /// Tokens from here are sent to freeze wallet.
    #[account(mut)]
    pub borrower_collateral_wallet: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
}

pub fn handle(
    ctx: Context<WithdrawCollateral>,
    component_bump_seed: u8,
    amount: u64,
) -> ProgramResult {
    let accounts = ctx.accounts;

    if amount == 0 {
        msg!("Collateral amount to deposit mustn't be zero");
        return Err(ErrorCode::InvalidAmount.into());
    }

    let amount = amount.min(accounts.receipt.collateral_amount);

    // we don't need checked sub because we've used min
    accounts.receipt.collateral_amount -= amount;

    // TODO: check whether allowed

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
