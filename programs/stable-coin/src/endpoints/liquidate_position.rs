//! Liquidator provides stable coin tokens, which are burned, and gets
//! collateral tokens at a discounted price. The amount given to the liquidator
//! is then subtracted from user's receipt, and the amount of stable coin tokens
//! burned is also subtracted from the user's receipt.

use crate::prelude::*;

#[derive(Accounts)]
#[instruction(stable_coin_bump_seed: u8, component_bump_seed: u8)]
pub struct LiquidatePosition<'info> {
    pub liquidator: Signer<'info>,
    #[account(
        constraint = stable_coin.key() == component.stable_coin
            @ err::stable_coin_mismatch(),
        constraint = stable_coin.mint == stable_coin_mint.key()
            @ err::stable_coin_mint_mismatch(),
    )]
    pub stable_coin: Box<Account<'info, StableCoin>>,
    #[account(mut)]
    pub stable_coin_mint: AccountInfo<'info>,
    /// Necessary to authorize burning of existing stable coin tokens.
    #[account(
        seeds = [component.stable_coin.as_ref()],
        bump = stable_coin_bump_seed,
    )]
    pub stable_coin_pda: AccountInfo<'info>,
    /// We need to mutate mint allowance in config.
    #[account(mut)]
    pub component: Box<Account<'info, Component>>,
    /// Authorizes transfer from freeze wallet.
    #[account(
        seeds = [component.to_account_info().key.as_ref()],
        bump = component_bump_seed,
    )]
    pub component_pda: AccountInfo<'info>,
    /// Gives user's collateral away to liquidator at a discount price.
    #[account(mut)]
    pub freeze_wallet: AccountInfo<'info>,
    #[account(
        mut,
        constraint = receipt.component == component.key()
            @ err::acc("Receipt belongs to a different component"),
    )]
    pub receipt: Account<'info, Receipt>,
    /// Some tokens in this wallet are burned.
    #[account(mut)]
    pub liquidator_stable_coin_wallet: AccountInfo<'info>,
    /// And in return the liquidator gets tokens from freeze wallet into this
    /// one.
    #[account(mut)]
    pub liquidator_collateral_wallet: AccountInfo<'info>,
}

pub fn handle(ctx: Context<LiquidatePosition>) -> ProgramResult {
    let _accounts = ctx.accounts;

    //

    Ok(())
}
