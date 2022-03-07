//! Updates configuration for component. The most common use case is to change
//! the `mint_allowance` of [`ComponentConfig`]. When changing the allowance, we
//! pass the whole config again and only change that one value.

use crate::prelude::*;

#[derive(Accounts)]
pub struct UpdateComponentConfig<'info> {
    pub admin: Signer<'info>,
    /// The root stable coin account to associated with the component in
    /// question.
    #[account(
        constraint = stable_coin.admin == admin.key() @ err::admin_mismatch(),
    )]
    pub stable_coin: Account<'info, StableCoin>,
    #[account(
        mut,
        constraint = stable_coin.key() == component.stable_coin
            @ err::stable_coin_mismatch(),
    )]
    pub component: Account<'info, Component>,
}

pub fn handle(_ctx: Context<UpdateComponentConfig>) -> ProgramResult {
    Ok(())
}
