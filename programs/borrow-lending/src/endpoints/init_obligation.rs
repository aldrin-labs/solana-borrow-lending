use crate::prelude::*;

#[derive(Accounts)]
pub struct InitObligation<'info> {
    #[account(signer)]
    pub owner: AccountInfo<'info>,
    pub lending_market: Account<'info, LendingMarket>,
    /// Create a new obligation which is linked to a lending market.
    #[account(zero)]
    pub obligation: Box<Account<'info, Obligation>>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn handle(ctx: Context<InitObligation>) -> ProgramResult {
    let accounts = ctx.accounts;

    accounts.obligation.owner = accounts.owner.key();
    accounts.obligation.lending_market = accounts.lending_market.key();
    accounts.obligation.last_update = LastUpdate::new(accounts.clock.slot);

    Ok(())
}
