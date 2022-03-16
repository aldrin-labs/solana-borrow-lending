pub mod endpoints;
pub mod err;
pub mod models;
mod prelude;

use endpoints::*;
use prelude::*;

declare_id!("9oiokTQXJSgbzLcmvsGXMvw8SM2a6vRTnthYhRycnP18");

#[program]
pub mod stable_coin {
    use super::*;

    pub fn init_stable_coin(ctx: Context<InitStableCoin>) -> ProgramResult {
        endpoints::init_stable_coin::handle(ctx)
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
        config: ComponentConfig,
    ) -> ProgramResult {
        endpoints::update_component_config::handle(ctx, config)
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

    pub fn init_receipt(ctx: Context<InitReceipt>) -> ProgramResult {
        endpoints::init_receipt::handle(ctx)
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
}
