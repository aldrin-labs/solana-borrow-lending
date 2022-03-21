//! Creates a new stable coin root account. We're going to have a singleton in
//! Aldrin, but theoretically anyone can create their own stable coin. This is
//! analogous to how [`borrow_lending::models::LendingMarket`] works.

use crate::prelude::*;
use anchor_spl::token::Mint;

#[derive(Accounts)]
#[instruction(stable_coin_bump_seed: u8)]
pub struct InitStableCoin<'info> {
    /// Has right to add new components.
    pub admin: Signer<'info>,
    /// The actual (e.g. USP) stable coin token mint.
    #[account(
        constraint = mint.mint_authority == Some(stable_coin_pda.key()).into()
            @ err::acc("Mint authority must be stable coin pda"),
        constraint = mint.freeze_authority.is_none()
            || mint.freeze_authority == Some(stable_coin_pda.key()).into()
            @ err::acc("Mint freeze authority must be either empty or pda"),
        constraint = mint.decimals as u32 == consts::STABLE_COIN_DECIMALS
            @ err::acc(format!(
                "Stable coin mint must have exactly {} decimal places",
                consts::STABLE_COIN_DECIMALS
            )),
    )]
    pub mint: Box<Account<'info, Mint>>,
    /// The account holding state and configuration.
    #[account(zero)]
    pub stable_coin: Box<Account<'info, StableCoin>>,
    #[account(
        seeds = [stable_coin.key().as_ref()],
        bump = stable_coin_bump_seed,
    )]
    pub stable_coin_pda: AccountInfo<'info>,
}

pub fn handle(
    ctx: Context<InitStableCoin>,
    _stable_coin_bump_seed: u8,
) -> ProgramResult {
    let accounts = ctx.accounts;

    accounts.stable_coin.mint = accounts.mint.key();
    accounts.stable_coin.admin = accounts.admin.key();

    Ok(())
}
