use crate::prelude::*;

#[derive(Accounts)]
pub struct UpdateReserveConfig<'info> {
    /// The entity which created the [`LendingMarket`].
    pub owner: Signer<'info>,
    #[account(has_one = owner @ ErrorCode::InvalidMarketOwner)]
    pub lending_market: Account<'info, LendingMarket>,
    #[account(mut)]
    pub reserve: Account<'info, Reserve>,
}

pub fn handle(
    ctx: Context<UpdateReserveConfig>,
    config: InputReserveConfig,
) -> Result<()> {
    ctx.accounts.reserve.config = config.validate()?;

    Ok(())
}
