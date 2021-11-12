use crate::prelude::*;
use anchor_spl::token::{self, Token};

#[derive(Accounts)]
#[instruction(lending_market_bump_seed: u8)]
pub struct WithdrawObligationCollateral<'info> {
    #[account(signer)]
    pub borrower: AccountInfo<'info>,
    #[account(
        mut,
        constraint = borrower.key() == obligation.owner
            @ ProgramError::IllegalOwner,
        constraint = !obligation.last_update.is_stale(clock.slot).unwrap_or(true)
            @ err::obligation_stale(),
    )]
    pub obligation: Box<Account<'info, Obligation>>,
    #[account(
        constraint = reserve.lending_market == obligation.lending_market
            @ err::market_mismatch(),
        constraint = !reserve.last_update.is_stale(clock.slot).unwrap_or(true)
            @ err::reserve_stale(),
        constraint = 0u8 != reserve.config.loan_to_value_ratio.into()
            @ err::cannot_use_as_collateral(),
    )]
    pub reserve: Box<Account<'info, Reserve>>,
    #[account(
        seeds = [reserve.lending_market.as_ref()],
        bump = lending_market_bump_seed,
    )]
    pub lending_market_pda: AccountInfo<'info>,
    pub source_collateral_wallet: AccountInfo<'info>,
    pub destination_collateral_wallet: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn handle(
    ctx: Context<WithdrawObligationCollateral>,
    lending_market_bump_seed: u8,
    collateral_amount: u64,
) -> ProgramResult {
    let accounts = ctx.accounts;

    if collateral_amount == 0 {
        msg!("Collateral amount provided cannot be zero");
        return Err(ErrorCode::InvalidAmount.into());
    }

    let (collateral_index, collateral) = accounts
        .obligation
        .get_collateral(accounts.reserve.key())
        .ok_or_else(|| {
            msg!("Obligation has no such reserve collateral");
            ProgramError::InvalidArgument
        })?;

    if collateral.deposited_amount == 0 {
        msg!("Collateral deposited amount is zero");
        return Err(ErrorCode::ObligationCollateralEmpty.into());
    }

    accounts.obligation.last_update.mark_stale();

    let pda_seeds = &[
        &accounts.reserve.lending_market.to_bytes()[..],
        &[lending_market_bump_seed],
    ];
    token::transfer(
        accounts
            .into_withdraw_collateral_context()
            .with_signer(&[&pda_seeds[..]]),
        withdraw_amount,
    )?;

    Ok(())
}

impl<'info> WithdrawObligationCollateral<'info> {
    pub fn into_withdraw_collateral_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>> {
        let cpi_accounts = token::Transfer {
            from: self.source_collateral_wallet.clone(),
            to: self.destination_collateral_wallet.clone(),
            authority: self.lending_market_pda.clone(),
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }
}
