//! After depositing collateral to an obligation, the borrower can use this
//! endpoint to borrow liquidity from other reserves.
//!
//! The obligation and all reserves connected to it must be refreshed in the
//! same transaction (see [`consts::MARKET_STALE_AFTER_SLOTS_ELAPSED`]). By
//! refreshing we recalculate the allowed borrow rate value
//! ([`Obligation.allowed_borrow_value`]). This UAC value limits how much
//! liquidity can be borrowed against the deposited collateral.

use crate::prelude::*;
use anchor_spl::token::{self, Token};

#[derive(Accounts)]
#[instruction(lending_market_bump_seed: u8)]
pub struct BorrowObligationLiquidity<'info> {
    #[account(signer)]
    pub borrower: AccountInfo<'info>,
    /// Must be refreshed and deposited with some collateral.
    #[account(mut)]
    pub obligation: AccountLoader<'info, Obligation>,
    #[account(
        mut,
        constraint = !reserve.is_stale(&clock) @ err::reserve_stale(),
    )]
    pub reserve: Box<Account<'info, Reserve>>,
    #[account(
        seeds = [reserve.lending_market.as_ref()],
        bump = lending_market_bump_seed,
    )]
    pub lending_market_pda: AccountInfo<'info>,
    /// The program's wallet where it stores all funded liquidity.
    #[account(
        mut,
        constraint = source_liquidity_wallet.key() == reserve.liquidity.supply
            @ err::acc("Source liq. wallet must eq. reserve's liq. supply"),
    )]
    pub source_liquidity_wallet: AccountInfo<'info>,
    /// Where would the borrower like to receive their loan?
    #[account(
        mut,
        constraint = destination_liquidity_wallet.key() !=
            reserve.liquidity.supply @ err::acc("Dest. liq. wallet mustn't \
            eq. reserve's liq. supply"),
    )]
    pub destination_liquidity_wallet: AccountInfo<'info>,
    /// The fee receiver was set up when the reserve was initialized. However,
    /// there's an option to add one more receiver wallet to the remaining
    /// accounts. That wallet can be anything as long as the liquidity matches.
    #[account(
        mut,
        constraint = fee_receiver.key() == reserve.liquidity.fee_receiver
            @ err::acc("Fee receiver doesn't match reserve's config"),
    )]
    pub fee_receiver: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn handle<'info>(
    ctx: Context<'_, '_, '_, 'info, BorrowObligationLiquidity<'info>>,
    lending_market_bump_seed: u8,
    liquidity_amount: u64,
) -> ProgramResult {
    let accounts = ctx.accounts;
    msg!(
        "borrow liquidity from reserve {} at slot {}",
        accounts.reserve.key(),
        accounts.clock.slot
    );

    if liquidity_amount == 0 {
        msg!("Liquidity amount provided cannot be zero");
        return Err(ErrorCode::InvalidAmount.into());
    }

    let mut obligation = accounts.obligation.load_mut()?;

    if accounts.borrower.key() != obligation.owner {
        return Err(ProgramError::IllegalOwner);
    }
    if obligation.is_stale(&accounts.clock) {
        return Err(err::obligation_stale());
    }
    if !obligation.has_deposits() {
        return Err(err::empty_collateral("No collateral deposited"));
    }
    if obligation.is_deposited_value_zero() {
        return Err(err::empty_collateral(
            "Collateral deposited value is zero",
        ));
    }
    if accounts.reserve.lending_market != obligation.lending_market {
        return Err(err::market_mismatch());
    }

    let remaining_borrow_value =
        obligation.remaining_collateralized_borrow_value();
    if remaining_borrow_value == Decimal::zero() {
        msg!("Remaining borrow value is zero");
        return Err(ErrorCode::BorrowTooLarge.into());
    }

    // borrow amount will be liquidity_amount plus fees
    let (
        borrow_amount,
        FeesCalculation {
            borrow_fee,
            host_fee,
        },
    ) = accounts.reserve.borrow_amount_with_fees(
        liquidity_amount,
        remaining_borrow_value,
        LoanKind::Standard,
    )?;

    // marks the funds including fees as borrowed
    accounts.reserve.liquidity.borrow(borrow_amount)?;

    // and takes note of that in the obligation
    obligation.borrow(
        accounts.reserve.key(),
        borrow_amount,
        LoanKind::Standard,
    )?;

    accounts.reserve.last_update.mark_stale();
    obligation.last_update.mark_stale();

    let pda_seeds = &[
        &accounts.reserve.lending_market.to_bytes()[..],
        &[lending_market_bump_seed],
    ];

    let mut owner_fee = borrow_fee;
    if let Some(host_fee_receiver) = ctx.remaining_accounts.iter().next() {
        if host_fee > 0 {
            owner_fee = owner_fee
                .checked_sub(host_fee)
                .ok_or(ErrorCode::MathOverflow)?;

            token::transfer(
                accounts
                    .into_pay_host_fee_context(host_fee_receiver)
                    .with_signer(&[&pda_seeds[..]]),
                host_fee,
            )?;
        }
    }

    if owner_fee > 0 {
        token::transfer(
            accounts
                .into_pay_fee_context()
                .with_signer(&[&pda_seeds[..]]),
            owner_fee,
        )?;
    }

    token::transfer(
        accounts
            .into_borrow_liquidity_context()
            .with_signer(&[&pda_seeds[..]]),
        liquidity_amount,
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

    pub fn into_pay_fee_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>> {
        let cpi_accounts = token::Transfer {
            from: self.source_liquidity_wallet.clone(),
            to: self.fee_receiver.clone(),
            authority: self.lending_market_pda.clone(),
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }

    pub fn into_pay_host_fee_context(
        &self,
        host_fee_receiver: &AccountInfo<'info>,
    ) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>> {
        let cpi_accounts = token::Transfer {
            from: self.source_liquidity_wallet.clone(),
            to: host_fee_receiver.clone(),
            authority: self.lending_market_pda.clone(),
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }
}
