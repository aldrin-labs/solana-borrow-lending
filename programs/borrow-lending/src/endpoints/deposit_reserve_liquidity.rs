use crate::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount};

#[derive(Accounts)]
#[instruction(lending_market_bump_seed: u8, liquidity_amount: u64)]
pub struct DepositReserveLiquidity<'info> {
    #[account(signer)]
    pub funder: AccountInfo<'info>,
    #[account(
        mut,
        constraint = reserve_liquidity_wallet.key() !=
            source_liquidity_wallet.key()
            @ err::acc("Reserve liq. wallet mustn't equal source liq. wallet"),
        constraint = source_liquidity_wallet.amount >= liquidity_amount
            @ ErrorCode::InsufficientFunds,
    )]
    pub source_liquidity_wallet: Account<'info, TokenAccount>,
    #[account(
        seeds = [reserve.lending_market.as_ref()],
        bump = lending_market_bump_seed,
    )]
    pub lending_market_pda: AccountInfo<'info>,
    #[account(
        mut,
        constraint = !reserve.last_update.is_stale(clock.slot).unwrap_or(true)
            @ err::reserve_stale(),
    )]
    pub reserve: Account<'info, Reserve>,
    #[account(
        mut,
        constraint = reserve.collateral.mint == reserve_collateral_mint.key()
            @ err::acc("Reserve col. mint must match reserve conf"),
    )]
    pub reserve_collateral_mint: AccountInfo<'info>,
    #[account(mut)]
    pub destination_collateral_wallet: AccountInfo<'info>,
    #[account(
        mut,
        constraint = reserve_liquidity_wallet.key() == reserve.liquidity.supply
            @ err::acc("Reserve liq. wallet must match reserve conf"),
    )]
    pub reserve_liquidity_wallet: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn handle(
    ctx: Context<DepositReserveLiquidity>,
    lending_market_bump_seed: u8,
    liquidity_amount: u64,
) -> ProgramResult {
    let accounts = ctx.accounts;

    if liquidity_amount == 0 {
        msg!("Liquidity amount provided cannot be zero");
        return Err(ErrorCode::InvalidAmount.into());
    }

    let collateral_amount =
        accounts.reserve.deposit_liquidity(liquidity_amount)?;
    accounts.reserve.last_update.mark_stale();

    let pda_seeds = &[
        &accounts.reserve.lending_market.to_bytes()[..],
        &[lending_market_bump_seed],
    ];
    token::mint_to(
        accounts
            .into_mint_collateral_for_liquidity_context()
            .with_signer(&[&pda_seeds[..]]),
        collateral_amount,
    )?;

    token::transfer(
        accounts.into_deposit_liquidity_context(),
        liquidity_amount,
    )?;

    Ok(())
}

impl<'info> DepositReserveLiquidity<'info> {
    pub fn into_mint_collateral_for_liquidity_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, token::MintTo<'info>> {
        let cpi_accounts = token::MintTo {
            mint: self.reserve_collateral_mint.clone(),
            to: self.destination_collateral_wallet.clone(),
            authority: self.lending_market_pda.clone(),
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }

    pub fn into_deposit_liquidity_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>> {
        let cpi_accounts = token::Transfer {
            from: self.source_liquidity_wallet.to_account_info(),
            to: self.reserve_liquidity_wallet.to_account_info(),
            authority: self.funder.clone(),
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }
}
