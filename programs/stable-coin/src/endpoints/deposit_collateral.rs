//! After a user calls [`crate::endpoints::init_receipt`], they deposit some
//! collateral with this endpoint and after that, they can
//! [`crate::endpoints::borrow_stable_coin`].

use crate::prelude::*;

#[derive(Accounts)]
pub struct DepositCollateral<'info> {
    pub borrower: Signer<'info>,
    #[account(
        mut,
        constraint = freeze_wallet.key() == component.freeze_wallet,
    )]
    pub component: Account<'info, Component>,
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

pub fn handle(_ctx: Context<DepositCollateral>) -> ProgramResult {
    Ok(())
}
