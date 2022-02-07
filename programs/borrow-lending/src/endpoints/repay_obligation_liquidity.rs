//! Allows the borrower to repay part or all of their loan against a single
//! reserve. The caller of this endpoint, the repayer, doesn't have to
//! necessarily be the owner of the obligation.
//!
//! Both [`LoanKind::Standard`] and [`LoanKind::YieldFarming`] can be repaid
//! this way. However, for leveraged position you should also call
//! [`crate::endpoints::leverage_farming::aldrin::close`], because the borrower
//! might have liquidity staked. See [`crate::endpoints::leverage_farming`] for
//! more information on how to repay a leveraged loan.

use crate::prelude::*;
use anchor_spl::token::{self, Token};

#[derive(Accounts)]
pub struct RepayObligationLiquidity<'info> {
    /// Presumably `obligation.owner` but doesn't have to be.
    #[account(signer)]
    pub repayer: AccountInfo<'info>,
    #[account(mut)]
    pub obligation: AccountLoader<'info, Obligation>,
    #[account(
        mut,
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
    loan_kind: LoanKind,
) -> ProgramResult {
    let accounts = ctx.accounts;

    if liquidity_amount == 0 {
        msg!("Liquidity amount provided cannot be zero");
        return Err(ErrorCode::InvalidAmount.into());
    }

    let mut obligation = accounts.obligation.load_mut()?;

    if obligation.is_stale(&accounts.clock) {
        return Err(err::obligation_stale());
    }
    if accounts.reserve.lending_market != obligation.lending_market {
        return Err(err::market_mismatch());
    }

    let (liquidity_index, liquidity) =
        obligation.get_liquidity(accounts.reserve.key(), loan_kind)?;
    if liquidity.borrowed_amount.to_dec() == Decimal::zero() {
        return Err(err::empty_liquidity("Liquidity borrowed amount is zero"));
    }

    // the repay amount is similar to liquidity but at most equal to the
    // borrowed amount which guarantees that the repayer never overpays
    //
    // the settle amount is decimal representation of the repay amount and is
    // equal to the repay amount unless the repayer requested to repay all of
    // their loan, in which case the repay amount is ceiled version of the
    // settle amount
    let (repay_amount, settle_amount) = calculate_repay_amounts(
        liquidity_amount,
        liquidity.borrowed_amount.to_dec(),
    )?;

    if repay_amount == 0 {
        msg!("Repay amount is too small to transfer liquidity");
        return Err(ErrorCode::RepayTooSmall.into());
    }

    // increases the available amount in the reserve
    accounts
        .reserve
        .liquidity
        .repay(repay_amount, settle_amount)?;

    // and removes the owed amount from the obligation
    obligation.repay(settle_amount, liquidity_index, accounts.clock.slot)?;

    accounts.reserve.last_update.mark_stale();
    obligation.last_update.mark_stale();

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
