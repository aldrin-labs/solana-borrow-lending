use crate::prelude::*;
use anchor_spl::token::{self, Token};

#[derive(Accounts)]
#[instruction(lending_market_bump_seed: u8)]
pub struct BorrowObligationLiquidity<'info> {
    #[account(signer)]
    pub borrower: AccountInfo<'info>,
    #[account(
        mut,
        constraint = borrower.key() == obligation.owner
            @ ProgramError::IllegalOwner,
        constraint = !obligation.last_update.is_stale(clock.slot).unwrap_or(true)
            @ err::obligation_stale(),
        constraint = obligation.has_deposits()
            @ ErrorCode::ObligationDepositsZero,
        constraint = obligation.deposited_value.to_dec() != Decimal::zero()
            @ ErrorCode::ObligationDepositsZero,
    )]
    pub obligation: Box<Account<'info, Obligation>>,
    #[account(
        mut,
        constraint = reserve.lending_market == obligation.lending_market
            @ err::market_mismatch(),
        constraint = !reserve.last_update.is_stale(clock.slot).unwrap_or(true)
            @ err::reserve_stale(),
    )]
    pub reserve: Box<Account<'info, Reserve>>,
    #[account(
        seeds = [reserve.lending_market.as_ref()],
        bump = lending_market_bump_seed,
    )]
    pub lending_market_pda: AccountInfo<'info>,
    #[account(
        mut,
        constraint = source_liquidity_wallet.key() == reserve.liquidity.supply
            @ err::acc("Source liq. wallet must eq. reserve's liq. supply"),
    )]
    pub source_liquidity_wallet: AccountInfo<'info>,
    #[account(
        mut,
        constraint = destination_liquidity_wallet.key() !=
            reserve.liquidity.supply @ err::acc("Dest. liq. wallet mustn't \
            eq. reserve's liq. supply"),
    )]
    pub destination_liquidity_wallet: AccountInfo<'info>,
    #[account(
        mut,
        constraint = fee_receiver.key() == reserve.liquidity.fee_receiver
            @ err::acc("Fee receiver doesn't match reserve's config"),
    )]
    pub fee_receiver: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn handle(
    ctx: Context<BorrowObligationLiquidity>,
    lending_market_bump_seed: u8,
    liquidity_amount: u64,
) -> ProgramResult {
    let accounts = ctx.accounts;

    if liquidity_amount == 0 {
        msg!("Liquidity amount provided cannot be zero");
        return Err(ErrorCode::InvalidAmount.into());
    }

    let pda_seeds = &[
        &accounts.reserve.lending_market.to_bytes()[..],
        &[lending_market_bump_seed],
    ];
    token::transfer(
        accounts
            .into_borrow_liquidity_context()
            .with_signer(&[&pda_seeds[..]]),
        borrow_amount,
    )?;

    Ok(())
}

impl<'info> BorrowObligationLiquidity<'info> {
    pub fn into_borrow_liquidity_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>> {
        let cpi_accounts = token::Transfer {
            from: self.source_liquidity_wallet.clone(),
            to: self.destination_liquidity_wallet.clone(),
            authority: self.lending_market_pda.clone(),
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }
}
