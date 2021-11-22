use crate::prelude::*;
use pyth::Load;

#[derive(Accounts)]
pub struct RefreshReserve<'info> {
    #[account(mut)]
    pub reserve: Account<'info, Reserve>,
    #[account(
        constraint = oracle_price.key() == reserve.liquidity.oracle
            @ ProgramError::InvalidAccountData,
    )]
    pub oracle_price: AccountInfo<'info>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn handle(ctx: Context<RefreshReserve>) -> ProgramResult {
    let accounts = ctx.accounts;
    msg!(
        "refresh reserve '{}' at slot {}",
        accounts.reserve.key(),
        accounts.clock.slot
    );

    let oracle_price_data = accounts.oracle_price.try_borrow_data()?;
    let oracle_price = pyth::Price::load(&oracle_price_data)?.validate()?;
    accounts.reserve.liquidity.market_price =
        oracle_price.calculate_market_price(&accounts.clock)?.into();

    accounts.reserve.accrue_interest(accounts.clock.slot)?;
    accounts
        .reserve
        .last_update
        .update_slot(accounts.clock.slot);

    Ok(())
}
