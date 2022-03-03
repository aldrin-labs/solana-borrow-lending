use crate::prelude::*;
use anchor_spl::token::Mint;

#[derive(Accounts)]
#[instruction(stable_coin_bump_seed: u8)]
pub struct BorrowStableCoin<'info> {
    pub borrower: Signer<'info>,
    #[account(
        mut,
        constraint = freeze_wallet.key() == component.freeze_wallet,
    )]
    pub component: Account<'info, Component>,
    #[account(mut)]
    pub stable_coin_mint: Account<'info, Mint>,
    /// Necessary to authorize minting of new stable coin tokens.
    #[account(
        seeds = [component.stable_coin.as_ref()],
        bump = stable_coin_bump_seed,
    )]
    pub stable_coin_pda: AccountInfo<'info>,
    /// Freezes user's collateral tokens.
    #[account(mut)]
    pub freeze_wallet: AccountInfo<'info>,
    #[account(zero)] // TODO: mut? and check whether its zero or not
    pub receipt: Account<'info, Receipt>,
    /// Tokens from here are sent to freeze wallet.
    #[account(mut)]
    pub borrower_collateral_wallet: AccountInfo<'info>,
    /// Gets more tokens.
    #[account(mut)]
    pub borrower_stable_coin_wallet: AccountInfo<'info>,
}
