//! Creates a new [`crate::models::LendingMarket`] account which is the base
//! config that relates reserves (tokens that can be borrowed/lent) to each
//! other and obligations (borrows) to these reserves.

use crate::prelude::*;

#[derive(Accounts)]
pub struct InitLendingMarket<'info> {
    #[account(signer)]
    pub owner: AccountInfo<'info>,
    #[account(zero)]
    pub lending_market: Account<'info, LendingMarket>,
}

pub fn handle(
    ctx: Context<InitLendingMarket>,
    currency: UniversalAssetCurrency,
) -> ProgramResult {
    let accounts = ctx.accounts;
    msg!("init lending market '{}'", accounts.lending_market.key());

    accounts.lending_market.owner = accounts.owner.key();
    accounts.lending_market.currency = currency;

    Ok(())
}
