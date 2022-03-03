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
    /// The account holding state and configuration.
    #[account(zero)]
    pub stable_coin: Box<Account<'info, StableCoin>>,
    #[account(
        seeds = [stable_coin.to_account_info().key.as_ref()],
        bump = stable_coin_bump_seed,
    )]
    pub stable_coin_pda: AccountInfo<'info>,
    /// The actual (e.g. USP) stable coin token mint.
    #[account(
        constraint = mint.mint_authority == Some(stable_coin_pda.key()).into(),
        constraint = mint.freeze_authority.is_none(),
    )]
    pub mint: Box<Account<'info, Mint>>,
    /// Address of the AMM program is important so that we can verify that
    /// swap etc hits the right target.
    #[account(executable)]
    pub aldrin_amm: AccountInfo<'info>,
    pub rent: AccountInfo<'info>,
}

pub fn handle(ctx: Context<InitStableCoin>) -> ProgramResult {
    let accounts = ctx.accounts;

    accounts.stable_coin.aldrin_amm = accounts.aldrin_amm.key();
    accounts.stable_coin.mint = accounts.mint.key();
    accounts.stable_coin.admin = accounts.admin.key();

    Ok(())
}
