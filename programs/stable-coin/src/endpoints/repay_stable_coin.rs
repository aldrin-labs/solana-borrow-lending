use crate::prelude::*;
use anchor_spl::token::Token;

#[derive(Accounts)]
#[instruction(stable_coin_bump_seed: u8)]
pub struct RepayStableCoin<'info> {
    pub borrower: Signer<'info>,
    #[account(
        constraint = stable_coin.key() == component.stable_coin,
        constraint = stable_coin.mint == stable_coin_mint.key(),
    )]
    pub stable_coin: Box<Account<'info, StableCoin>>,
    /// We need to mutate mint allowance in config.
    #[account(mut)]
    pub component: Box<Account<'info, Component>>,
    #[account(mut)]
    pub stable_coin_mint: AccountInfo<'info>,
    /// Necessary to authorize burning of existing stable coin tokens.
    #[account(
        seeds = [component.stable_coin.as_ref()],
        bump = stable_coin_bump_seed,
    )]
    pub stable_coin_pda: AccountInfo<'info>,
    #[account(
        mut,
        constraint = receipt.component == component.key(),
        constraint = receipt.borrower == borrower.key(),
    )]
    pub receipt: Account<'info, Receipt>,
    /// Some tokens in this wallet are burned.
    #[account(mut)]
    pub borrower_stable_coin_wallet: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn handle(_ctx: Context<RepayStableCoin>) -> ProgramResult {
    Ok(())
}
