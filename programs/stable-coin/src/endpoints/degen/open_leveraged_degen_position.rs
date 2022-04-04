use crate::prelude::*;
use anchor_spl::token::{self, Token};

#[derive(Accounts)]
#[instruction(stable_coin_bump_seed: u8)]
pub struct OpenLeveragedDegenPosition<'info> {
    pub borrower: Signer<'info>,
    #[account(mut)]
    pub borrower_ust_wallet: AccountInfo<'info>,
    #[account(
        constraint = stable_coin.mint == stable_coin_mint.key()
            @ err::stable_coin_mint_mismatch(),
    )]
    pub stable_coin: Box<Account<'info, StableCoin>>,
    /// Necessary to authorize minting of new stable coin tokens.
    #[account(
        seeds = [stable_coin.key().as_ref()],
        bump = stable_coin_bump_seed,
    )]
    pub stable_coin_pda: AccountInfo<'info>,
    #[account(mut)]
    pub stable_coin_mint: AccountInfo<'info>,
    #[account(
        mut,
        constraint = stable_coin.key() == degen_strategy.key()
            @ err::stable_coin_mismatch(),
        constraint = stable_coin.mint == stable_coin_mint.key()
            @ err::stable_coin_mint_mismatch(),
    )]
    pub degen_strategy: Account<'info, DegenStrategy>,
    pub token_program: Program<'info, Token>,
}

pub fn handle(
    ctx: Context<OpenLeveragedDegenPosition>,
    stable_coin_bump_seed: u8,
    initial_ust_amount: u64,
    leverage: SDecimal,
) -> ProgramResult {
    let accounts = ctx.accounts;

    Ok(())
}
