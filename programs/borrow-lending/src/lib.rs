#[cfg(test)]
#[macro_use]
extern crate memoffset;

#[macro_use]
extern crate shrinkwraprs;

pub mod endpoints;
pub mod err;
pub mod math;
pub mod models;
pub mod prelude;

use endpoints::*;
use prelude::*;

declare_id!("7vRDzPZK2toUCkGUgtb1uPZLXvtj8YvXUKUBRh8Ufr5y");

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

    pub fn deposit_reserve_liquidity(
        ctx: Context<DepositReserveLiquidity>,
        lending_market_bump_seed: u8,
        liquidity_amount: u64,
    ) -> ProgramResult {
        endpoints::deposit_reserve_liquidity::handle(
            ctx,
            lending_market_bump_seed,
            liquidity_amount,
        )
    }

    pub fn redeem_reserve_collateral(
        ctx: Context<RedeemReserveCollateral>,
        lending_market_bump_seed: u8,
        collateral_amount: u64,
    ) -> ProgramResult {
        endpoints::redeem_reserve_collateral::handle(
            ctx,
            lending_market_bump_seed,
            collateral_amount,
        )
    }

    /// Creates a new obligation with up to 10 possible different reserves from
    /// which to borrow or to which to deposit.
    pub fn init_obligation_r10(ctx: Context<InitObligation>) -> ProgramResult {
        assert_eq!(10, consts::MAX_OBLIGATION_RESERVES);

        endpoints::init_obligation::handle(ctx)
    }

    pub fn refresh_obligation(
        ctx: Context<RefreshObligation>,
    ) -> ProgramResult {
        endpoints::refresh_obligation::handle(ctx)
    }

    pub fn deposit_obligation_collateral(
        ctx: Context<DepositObligationCollateral>,
        collateral_amount: u64,
    ) -> ProgramResult {
        endpoints::deposit_obligation_collateral::handle(ctx, collateral_amount)
    }

    /// As long as borrower's obligation stays healthy they withdraw given
    /// amount of collateral from a specific reserve.
    pub fn withdraw_obligation_collateral(
        ctx: Context<WithdrawObligationCollateral>,
        lending_market_bump_seed: u8,
        collateral_amount: u64,
    ) -> ProgramResult {
        endpoints::withdraw_obligation_collateral::handle(
            ctx,
            lending_market_bump_seed,
            collateral_amount,
        )
    }

    /// Borrower makes a loan of a specific reserve liquidity against all
    /// collateral they deposited.
    pub fn borrow_obligation_liquidity<'info>(
        ctx: Context<'_, '_, '_, 'info, BorrowObligationLiquidity<'info>>,
        lending_market_bump_seed: u8,
        liquidity_amount: u64,
    ) -> ProgramResult {
        endpoints::borrow_obligation_liquidity::handle(
            ctx,
            lending_market_bump_seed,
            liquidity_amount,
        )
    }

    /// Borrowed repays part or all of their loan of a specific reserve.
    pub fn repay_obligation_liquidity(
        ctx: Context<RepayObligationLiquidity>,
        liquidity_amount: u64,
    ) -> ProgramResult {
        endpoints::repay_obligation_liquidity::handle(ctx, liquidity_amount)
    }

    /// Any user can repay part of loan of a specific reserve for advantageous
    /// market value and receive collateral in lieu.
    pub fn liquidate_obligation(
        ctx: Context<LiquidateObligation>,
        lending_market_bump_seed: u8,
        liquidity_amount: u64,
    ) -> ProgramResult {
        endpoints::liquidate_obligation::handle(
            ctx,
            lending_market_bump_seed,
            liquidity_amount,
        )
    }
}
