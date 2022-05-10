use crate::prelude::*;
use pyth::Load;

#[derive(Accounts)]
pub struct RefreshReserve<'info> {
    #[account(mut)]
    pub reserve: Account<'info, Reserve>,
    /// CHECK: UNSAFE_CODES.md#constrains
    #[account(
        constraint = reserve
            .liquidity
            .oracle
            .is_simple_pyth_price(&oracle_price.key())
            @ err::acc("Oracle kind or price key doesn't match"),
    )]
    pub oracle_price: AccountInfo<'info>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn handle(ctx: Context<RefreshReserve>) -> Result<()> {
    let accounts = ctx.accounts;
    msg!("refresh reserve '{}'", accounts.reserve.key(),);

    let oracle_price_data = accounts.oracle_price.try_borrow_data()?;
    let oracle_price = pyth::Price::load(&oracle_price_data)?.validate()?;
    accounts.reserve.liquidity.market_price =
        pyth::calculate_market_price(oracle_price, &accounts.clock)?.into();

    accounts.reserve.accrue_interest(accounts.clock.slot)?;
    accounts
        .reserve
        .last_update
        .update_slot(accounts.clock.slot);

    Ok(())
}
