pub mod endpoints;
pub mod err;
pub mod models;
pub mod prelude;

use endpoints::*;
use prelude::*;

declare_id!("9oiokTQXJSgbzLcmvsGXMvw8SM2a6vRTnthYhRycnP18");

#[program]
pub mod stable_coin {
    use super::*;

    pub fn init_stable_coin(
        ctx: Context<InitStableCoin>,
        stable_coin_bump_seed: u8,
    ) -> ProgramResult {
        endpoints::init_stable_coin::handle(ctx, stable_coin_bump_seed)
    }

    pub fn init_component(
        ctx: Context<InitComponent>,
        component_bump_seed: u8,
        config: InputComponentConfig,
    ) -> ProgramResult {
        endpoints::init_component::handle(ctx, component_bump_seed, config)
    }

    pub fn update_component_config(
        ctx: Context<UpdateComponentConfig>,
        config: InputComponentConfig,
    ) -> ProgramResult {
        endpoints::update_component_config::handle(ctx, config)
    }

    pub fn init_receipt(ctx: Context<InitReceipt>) -> ProgramResult {
        endpoints::init_receipt::handle(ctx)
    }

    pub fn deposit_collateral(
        ctx: Context<DepositCollateral>,
        amount: u64,
    ) -> ProgramResult {
        endpoints::deposit_collateral::handle(ctx, amount)
    }

    pub fn withdraw_collateral(
        ctx: Context<WithdrawCollateral>,
        component_bump_seed: u8,
        amount: u64,
    ) -> ProgramResult {
        endpoints::withdraw_collateral::handle(ctx, component_bump_seed, amount)
    }

    pub fn borrow_stable_coin(
        ctx: Context<BorrowStableCoin>,
        stable_coin_bump_seed: u8,
        amount: u64,
    ) -> ProgramResult {
        endpoints::borrow_stable_coin::handle(
            ctx,
            stable_coin_bump_seed,
            amount,
        )
    }

    pub fn repay_stable_coin(
        ctx: Context<RepayStableCoin>,
        max_amount_to_repay: u64,
    ) -> ProgramResult {
        endpoints::repay_stable_coin::handle(ctx, max_amount_to_repay)
    }

    pub fn liquidate_position(
        ctx: Context<LiquidatePosition>,
        component_bump_seed: u8,
    ) -> ProgramResult {
        endpoints::liquidate_position::handle(ctx, component_bump_seed)
    }

    /// Starts a new position via Aldrin's AMM. Instead of user having to
    /// repeatably borrow stable coin, swap it into collateral, deposit the
    /// collateral and borrow again, we perform all of it in one step.
    pub fn leverage_via_aldrin_amm(
        ctx: Context<LeverageViaAldrinAmm>,
        stable_coin_bump_seed: u8,
        collateral_ratio: SDecimal,
        initial_stable_coin_amount: u64,
        min_intermediary_swap_return: u64,
        min_collateral_swap_return: u64,
    ) -> ProgramResult {
        endpoints::leverage_via_aldrin_amm::handle(
            ctx,
            stable_coin_bump_seed,
            collateral_ratio.to_dec(),
            initial_stable_coin_amount,
            min_intermediary_swap_return,
            min_collateral_swap_return,
        )
    }

    pub fn deleverage_via_aldrin_amm(
        ctx: Context<DeleverageViaAldrinAmm>,
        component_bump_seed: u8,
        collateral_amount: u64,
        min_intermediary_swap_return: u64,
        min_stable_coin_swap_return: u64,
    ) -> ProgramResult {
        endpoints::deleverage_via_aldrin_amm::handle(
            ctx,
            component_bump_seed,
            collateral_amount,
            min_intermediary_swap_return,
            min_stable_coin_swap_return,
        )
    }
}
