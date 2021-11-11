//! Once a borrower initiated an obligation with
//! [`crate::endpoints::init_obligation_r10`] then they can deposit collateral
//! to it. The collateral is the token minted in
//! [`crate::endpoints::deposit_reserve_liquidity`].
//!
//! No market price is calculated at this step, only after refreshing the
//! obligation with [`crate::endpoints::refresh_obligation`] do we calculate
//! how much value is actually collateralized.

use crate::prelude::*;
use anchor_spl::token::{self, Token};

#[derive(Accounts)]
pub struct DepositObligationCollateral<'info> {
    #[account(signer)]
    pub borrower: AccountInfo<'info>,
    #[account(
        mut,
        constraint = borrower.key() == obligation.owner
            @ ProgramError::IllegalOwner,
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
    #[account(mut)]
    pub source_collateral_wallet: AccountInfo<'info>,
    #[account(
        mut,
        constraint = destination_collateral_wallet.key() !=
            source_collateral_wallet.key()
            @ err::acc("Destination wallet musn't equal source wallet"),
        constraint = reserve.collateral.supply ==
            destination_collateral_wallet.key() @ err::acc("Dest. wallet must \
                match reserve config collateral supply"),
    )]
    pub destination_collateral_wallet: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn handle(
    ctx: Context<DepositObligationCollateral>,
    collateral_amount: u64,
) -> ProgramResult {
    let accounts = ctx.accounts;

    if collateral_amount == 0 {
        msg!("Collateral amount to deposit mustn't be zero");
        return Err(ErrorCode::InvalidAmount.into());
    }

    accounts
        .obligation
        .deposit(accounts.reserve.key(), collateral_amount)?;
    accounts.obligation.last_update.mark_stale();

    token::transfer(
        accounts.to_deposit_collateral_context(),
        collateral_amount,
    )?;

    Ok(())
}

impl<'info> DepositObligationCollateral<'info> {
    pub fn to_deposit_collateral_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>> {
        let cpi_accounts = token::Transfer {
            from: self.source_collateral_wallet.to_account_info(),
            to: self.destination_collateral_wallet.to_account_info(),
            authority: self.borrower.clone(),
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }
}
