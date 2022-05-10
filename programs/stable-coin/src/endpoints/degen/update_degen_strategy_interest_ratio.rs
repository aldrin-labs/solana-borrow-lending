use crate::prelude::*;

#[derive(Accounts)]
#[instruction(degen_strategy_bump_seed: u8)]
pub struct UpdateDegenStrategyInterestRatio<'info> {
    pub admin: Signer<'info>,
    #[account(
        mut,
        constraint = degen_strategy.admin == admin.key()
            @ err::admin_mismatch(),
    )]
    pub degen_strategy: Account<'info, DegenStrategy>,
}

pub fn handle(
    ctx: Context<UpdateDegenStrategyInterestRatio>,
    aust_ratio: SDecimal,
) -> Result<()> {
    let accounts = ctx.accounts;

    accounts.degen_strategy.aust_ratio = aust_ratio;

    Ok(())
}
