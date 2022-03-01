use crate::prelude::*;
use anchor_spl::token::Mint;

#[derive(Accounts)]
pub struct InitStableCoin<'info> {
    /// Has right to add new components.
    pub admin: Signer<'info>,
    /// The account holding state and configuration.
    #[account(zero)]
    pub stable_coin: Account<'info, StableCoin>,
    /// The actual (e.g. USP) stable coin token mint.
    #[account(zero)]
    pub mint: Account<'info, Mint>,
    /// Which market, owned by BL program (has to be verified by caller), will
    /// be used as oracle via [`borrow_lending::Reserve`].
    pub blp_market: AccountInfo<'info>,
    /// Address of the AMM program is important so that we can verify that
    /// swap etc hits the right target.
    #[account(executable)]
    pub aldrin_amm: AccountInfo<'info>,
    pub rent: AccountInfo<'info>,
}

pub fn handle(ctx: Context<InitStableCoin>) -> ProgramResult {
    let accounts = ctx.accounts;

    accounts.stable_coin.blp_market = accounts.blp_market.key();
    accounts.stable_coin.aldrin_amm = accounts.aldrin_amm.key();
    accounts.stable_coin.mint = accounts.mint.key();
    accounts.stable_coin.admin = accounts.admin.key();

    Ok(())
}
