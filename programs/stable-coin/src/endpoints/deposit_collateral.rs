//! After a user calls [`crate::endpoints::init_receipt`], they deposit some
//! collateral with this endpoint and after that, they can
//! [`crate::endpoints::borrow_stable_coin`].

use crate::prelude::*;
use anchor_spl::token::{self, Token};

#[derive(Accounts)]
pub struct DepositCollateral<'info> {
    pub borrower: Signer<'info>,
    #[account(
        mut,
        constraint = freeze_wallet.key() == component.freeze_wallet
            @ err::acc("Freeze wallet doesn't match component's configuration"),
    )]
    pub component: Account<'info, Component>,
    /// Freezes user's collateral tokens.
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
    /// Tokens from here are sent to freeze wallet.
    #[account(mut)]
    pub borrower_collateral_wallet: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
}

pub fn handle(ctx: Context<DepositCollateral>, amount: u64) -> ProgramResult {
    let accounts = ctx.accounts;

    if amount == 0 {
        msg!("Collateral amount to deposit mustn't be zero");
        return Err(ErrorCode::InvalidAmount.into());
    }

    accounts.receipt.collateral_amount = accounts
        .receipt
        .collateral_amount
        .checked_add(amount)
        .ok_or(ErrorCode::MathOverflow)?;

    token::transfer(accounts.as_deposit_collateral_context(), amount)?;

    Ok(())
}

impl<'info> DepositCollateral<'info> {
    pub fn as_deposit_collateral_context(
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
