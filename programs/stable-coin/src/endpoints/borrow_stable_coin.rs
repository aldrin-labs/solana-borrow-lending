//! Mints given amount of stable coin under the condition that the deposited
//! collateral in borrower's receipt is sufficient.

use crate::prelude::*;
use anchor_spl::token::{self, Mint, Token};

#[derive(Accounts)]
#[instruction(stable_coin_bump_seed: u8)]
pub struct BorrowStableCoin<'info> {
    pub borrower: Signer<'info>,
    #[account(
        constraint = stable_coin.key() == component.stable_coin
            @ err::stable_coin_mismatch(),
        constraint = stable_coin.mint == stable_coin_mint.key()
            @ err::stable_coin_mint_mismatch(),
    )]
    pub stable_coin: Box<Account<'info, StableCoin>>,
    /// We need to mutate mint allowance in config.
    #[account(mut)]
    pub component: Account<'info, Component>,
    #[account(
        constraint = reserve.key() == component.blp_reserve
            @ err::reserve_mismatch(),
        constraint = !reserve.is_stale(&clock)
            @ borrow_lending::err::reserve_stale(),
    )]
    pub reserve: Box<Account<'info, borrow_lending::models::Reserve>>,
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
        constraint = receipt.component == component.key()
            @ err::acc("Receipt belongs to a different component"),
        constraint = receipt.borrower == borrower.key()
            @ err::acc("Receipt's borrower doesn't match"),
    )]
    pub receipt: Account<'info, Receipt>,
    /// Mint tokens in here
    #[account(mut)]
    pub borrower_stable_coin_wallet: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn handle(
    ctx: Context<BorrowStableCoin>,
    stable_coin_bump_seed: u8,
    amount: u64,
) -> ProgramResult {
    let accounts = ctx.accounts;

    if amount == 0 {
        msg!("Stable coin amount to borrow mustn't be zero");
        return Err(ErrorCode::InvalidAmount.into());
    }

    if amount > accounts.component.config.mint_allowance {
        msg!(
            "This type of collateral can be presently used to
            mint at most {} stable coin tokens",
            accounts.component.config.mint_allowance
        );
        return Err(ErrorCode::MintAllowanceTooSmall.into());
    }

    // we've just checked that this doesn't underflow
    accounts.component.config.mint_allowance -= amount;

    let token_market_price =
        accounts.component.market_price(&accounts.reserve)?;
    // this fails if there isn't enough collateral to cover the borow
    accounts.receipt.borrow(
        &accounts.component.config,
        accounts.clock.slot,
        amount,
        token_market_price,
    )?;

    let pda_seeds = &[
        &accounts.component.stable_coin.to_bytes()[..],
        &[stable_coin_bump_seed],
    ];
    token::mint_to(
        accounts
            .as_mint_collateral_for_liquidity_context()
            .with_signer(&[&pda_seeds[..]]),
        amount,
    )?;

    Ok(())
}

impl<'info> BorrowStableCoin<'info> {
    pub fn as_mint_collateral_for_liquidity_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, token::MintTo<'info>> {
        let cpi_accounts = token::MintTo {
            mint: self.stable_coin_mint.to_account_info(),
            to: self.borrower_stable_coin_wallet.to_account_info(),
            authority: self.stable_coin_pda.to_account_info(),
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }
}
