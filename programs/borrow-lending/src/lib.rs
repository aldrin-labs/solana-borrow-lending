#[macro_use]
extern crate shrinkwraprs;

pub mod endpoints;
pub mod math;
pub mod models;
pub mod prelude;

use endpoints::*;
use prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod borrow_lending {
    use super::*;

    pub fn init_lending_market(
        ctx: Context<InitLendingMarket>,
        currency: UniversalAssetCurrency,
    ) -> ProgramResult {
        endpoints::init_lending_market::handle(ctx, currency)
    }

    pub fn set_lending_market_owner(
        ctx: Context<SetLendingMarketOwner>,
    ) -> ProgramResult {
        endpoints::set_lending_market_owner::handle(ctx)
    }

    pub fn init_reserve(
        ctx: Context<InitReserve>,
        lending_market_bump_seed: u8,
        liquidity_amount: u64,
        config: InputReserveConfig,
    ) -> ProgramResult {
        endpoints::init_reserve::handle(
            ctx,
            lending_market_bump_seed,
            liquidity_amount,
            config,
        )
    }

    pub fn refresh_reserve(ctx: Context<RefreshReserve>) -> ProgramResult {
        endpoints::refresh_reserve::handle(ctx)
    }
}
