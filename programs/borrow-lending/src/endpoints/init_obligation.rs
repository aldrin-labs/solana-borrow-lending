use crate::prelude::*;

#[derive(Accounts)]
pub struct InitObligation<'info> {
    #[account(signer)]
    pub owner: AccountInfo<'info>,
    pub lending_market: Box<Account<'info, LendingMarket>>,
    /// Create a new obligation which is linked to a lending market.
    #[account(zero)]
    pub obligation: AccountLoader<'info, Obligation>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn handle(ctx: Context<InitObligation>) -> ProgramResult {
    let obligation = &mut ctx.accounts.obligation.load_init()?;

    obligation.owner = ctx.accounts.owner.key();
    obligation.lending_market = ctx.accounts.lending_market.key();
    obligation.last_update = LastUpdate::new(ctx.accounts.clock.slot);

    Ok(())
}
