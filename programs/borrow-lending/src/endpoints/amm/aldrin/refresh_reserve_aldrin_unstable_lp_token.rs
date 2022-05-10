use crate::prelude::*;
use anchor_spl::token::{Mint, TokenAccount};
use pyth::Load;

#[derive(Accounts)]
pub struct RefreshReserveAldrinUnstableLpToken<'info> {
    #[account(mut)]
    pub reserve: Account<'info, Reserve>,
    /// CHECK: UNSAFE_CODES.md#constraints
    #[account(
        constraint = reserve
            .liquidity
            .oracle
            .is_aldrin_amm_lp_pyth(
                vault.key(),
                pool_mint.key(),
                oracle_price.key(),
            )
            @ err::acc("Oracle kind or price key don't match"),
    )]
    pub oracle_price: AccountInfo<'info>,
    pub vault: Account<'info, TokenAccount>,
    pub pool_mint: Account<'info, Mint>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn handle(ctx: Context<RefreshReserveAldrinUnstableLpToken>) -> Result<()> {
    let accounts = ctx.accounts;
    msg!("refresh reserve '{}'", accounts.reserve.key());

    let oracle_price_data = accounts.oracle_price.try_borrow_data()?;
    let oracle_price = pyth::Price::load(&oracle_price_data)?.validate()?;
    let constituent_token_market_price =
        pyth::calculate_market_price(oracle_price, &accounts.clock)?;
    accounts.reserve.liquidity.market_price =
        aldrin_amm::unstable_lp_token_market_price(
            accounts.pool_mint.supply,
            constituent_token_market_price,
            accounts.vault.amount,
        )?
        .into();

    accounts.reserve.accrue_interest(accounts.clock.slot)?;
    accounts
        .reserve
        .last_update
        .update_slot(accounts.clock.slot);

    Ok(())
}
