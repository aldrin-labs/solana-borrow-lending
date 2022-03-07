use crate::prelude::*;
use anchor_spl::token::Mint;

#[derive(Accounts)]
#[instruction(stable_coin_bump_seed: u8)]
pub struct BorrowStableCoin<'info> {
    pub borrower: Signer<'info>,
    /// We need to mutate mint allowance in config.
    #[account(mut)]
    pub component: Account<'info, Component>,
    #[account(mut)]
    pub stable_coin_mint: Account<'info, Mint>,
    /// Necessary to authorize minting of new stable coin tokens.
    ///
    /// We don't need to check that the stable coin mint is indeed the one
    /// associated with the component because if a malicious user provided
    /// different mint with the same PDA as authority, they'd only lose money
    /// because instead of an actual stable coin tokens, they'd borrow
    /// worthless ones.
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
    /// Gets more tokens.
    #[account(mut)]
    pub borrower_stable_coin_wallet: AccountInfo<'info>,
}

pub fn handle(_ctx: Context<BorrowStableCoin>) -> ProgramResult {
    Ok(())
}
