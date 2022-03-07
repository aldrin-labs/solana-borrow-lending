//! Allows the user to withdraw their collateral, thereby increasing the chance
//! of getting liquidated. Only if they re-payed all their debt can they
//! withdraw all of the collateral.

use crate::prelude::*;

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
        seeds = [component.to_account_info().key.as_ref()],
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
}

pub fn handle(_ctx: Context<WithdrawCollateral>) -> ProgramResult {
    Ok(())
}
