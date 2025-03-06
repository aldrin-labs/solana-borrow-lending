//! Creates a new receipt which keeps track of how much collateral is deposited
//! by the user, and how much stable coin minted for the user.

use crate::prelude::*;

#[derive(Accounts)]
pub struct InitReceipt<'info> {
    pub borrower: Signer<'info>,
    pub component: Account<'info, Component>,
    #[account(zero)]
    pub receipt: Account<'info, Receipt>,
}

pub fn handle(ctx: Context<InitReceipt>) -> Result<()> {
    let accounts = ctx.accounts;

    accounts.receipt.borrower = accounts.borrower.key();
    accounts.receipt.component = accounts.component.key();

    Ok(())
}
