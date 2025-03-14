use crate::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount};

#[derive(Accounts)]
#[instruction(lending_market_bump_seed: u8, liquidity_amount: u64)]
pub struct DepositReserveLiquidity<'info> {
    pub funder: Signer<'info>,
    #[account(
        mut,
        constraint = reserve_liquidity_wallet.key() !=
            source_liquidity_wallet.key()
            @ err::acc("Reserve liq. wallet mustn't equal source liq. wallet"),
        constraint = source_liquidity_wallet.amount >= liquidity_amount
            @ err::insufficient_funds(
                liquidity_amount,
                source_liquidity_wallet.amount
            ),
        constraint = source_liquidity_wallet.key() != reserve.liquidity.supply
            @ err::acc("Source liq. wallet musn't be reserve liq. wallet"),
    )]
    pub source_liquidity_wallet: Account<'info, TokenAccount>,
    /// CHECK: UNSAFE_CODES.md#signer
    #[account(
        seeds = [reserve.lending_market.as_ref()],
        bump = lending_market_bump_seed,
    )]
    pub lending_market_pda: AccountInfo<'info>,
    #[account(
        mut,
        constraint = !reserve.is_stale(&clock) @ err::reserve_stale(),
    )]
    pub reserve: Account<'info, Reserve>,
    /// CHECK: UNSAFE_CODES.md#wallet
    #[account(
        mut,
        constraint = reserve.collateral.mint == reserve_collateral_mint.key()
            @ err::acc("Reserve col. mint must match reserve conf"),
    )]
    pub reserve_collateral_mint: AccountInfo<'info>,
    /// CHECK: UNSAFE_CODES.md#wallet
    #[account(
        mut,
        constraint = destination_collateral_wallet.key() !=
            reserve.collateral.supply
            @ err::acc("Dest. col. wallet mustn't eq. reserve's col. supply")
    )]
    pub destination_collateral_wallet: AccountInfo<'info>,
    /// CHECK: UNSAFE_CODES.md#wallet
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
) -> Result<()> {
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
            .as_mint_collateral_for_liquidity_context()
            .with_signer(&[&pda_seeds[..]]),
        collateral_amount,
    )?;

    token::transfer(accounts.as_deposit_liquidity_context(), liquidity_amount)?;

    Ok(())
}

impl<'info> DepositReserveLiquidity<'info> {
    pub fn as_mint_collateral_for_liquidity_context(
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

    pub fn as_deposit_liquidity_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>> {
        let cpi_accounts = token::Transfer {
            from: self.source_liquidity_wallet.to_account_info(),
            to: self.reserve_liquidity_wallet.to_account_info(),
            authority: self.funder.to_account_info(),
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }
}
