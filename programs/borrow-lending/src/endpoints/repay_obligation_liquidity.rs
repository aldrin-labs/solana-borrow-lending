use crate::prelude::*;
use anchor_spl::token::{self, Token};

#[derive(Accounts)]
pub struct RepayObligationLiquidity<'info> {
    /// Presumably `obligation.owner` but doesn't have to be.
    #[account(signer)]
    pub repayer: AccountInfo<'info>,
    #[account(
        mut,
        constraint = !obligation.is_stale(&clock) @ err::obligation_stale(),
    )]
    pub obligation: Box<Account<'info, Obligation>>,
    #[account(
        mut,
        constraint = reserve.lending_market == obligation.lending_market
            @ err::market_mismatch(),
        constraint = !reserve.is_stale(&clock) @ err::reserve_stale(),
    )]
    pub reserve: Box<Account<'info, Reserve>>,
    #[account(
        mut,
        constraint = source_liquidity_wallet.key() != reserve.liquidity.supply
            @ err::acc("Source liq. wallet mustn't eq. reserve's liq. supply"),
    )]
    pub source_liquidity_wallet: AccountInfo<'info>,
    #[account(
        mut,
        constraint = destination_liquidity_wallet.key() ==
            reserve.liquidity.supply @ err::acc("Dest. liq. wallet must \
            eq. reserve's liq. supply"),
    )]
    pub destination_liquidity_wallet: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn handle(
    ctx: Context<RepayObligationLiquidity>,
    liquidity_amount: u64,
) -> ProgramResult {
    let accounts = ctx.accounts;

    if liquidity_amount == 0 {
        msg!("Liquidity amount provided cannot be zero");
        return Err(ErrorCode::InvalidAmount.into());
    }

    let (liquidity_index, liquidity) = accounts
        .obligation
        .get_liquidity(accounts.reserve.key())
        .ok_or_else(|| {
            msg!("Obligation has no such reserve liquidity");
            ProgramError::InvalidArgument
        })?;
    if liquidity.borrowed_amount.to_dec() == Decimal::zero() {
        msg!("Liquidity borrowed amount is zero");
        return Err(ErrorCode::ObligationLiquidityEmpty.into());
    }

    let (repay_amount, settle_amount) = calculate_repay_amounts(
        liquidity_amount,
        liquidity.borrowed_amount.to_dec(),
    )?;

    if repay_amount == 0 {
        msg!("Repay amount is too small to transfer liquidity");
        return Err(ErrorCode::RepayTooSmall.into());
    }

    accounts
        .reserve
        .liquidity
        .repay(repay_amount, settle_amount)?;
    accounts.reserve.last_update.mark_stale();

    accounts.obligation.repay(settle_amount, liquidity_index)?;
    accounts.obligation.last_update.mark_stale();

    token::transfer(accounts.into_repay_liquidity_context(), repay_amount)?;

    Ok(())
}

impl<'info> RepayObligationLiquidity<'info> {
    pub fn into_repay_liquidity_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>> {
        let cpi_accounts = token::Transfer {
            from: self.source_liquidity_wallet.clone(),
            to: self.destination_liquidity_wallet.clone(),
            authority: self.repayer.clone(),
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }
}
