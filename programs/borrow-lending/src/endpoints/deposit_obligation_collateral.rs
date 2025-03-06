//! Once a borrower initiated an obligation with
//! [`crate::endpoints::init_obligation`] then they can deposit collateral
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
    pub borrower: Signer<'info>,
    #[account(mut)]
    pub obligation: AccountLoader<'info, Obligation>,
    #[account(
        constraint = 0u8 != u8::from(reserve.config.loan_to_value_ratio)
            @ err::cannot_use_as_collateral(),
    )]
    pub reserve: Box<Account<'info, Reserve>>,
    /// CHECK: UNSAFE_CODES.md#wallet
    #[account(mut)]
    pub source_collateral_wallet: AccountInfo<'info>,
    /// CHECK: UNSAFE_CODES.md#wallet
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
) -> Result<()> {
    let accounts = ctx.accounts;

    if collateral_amount == 0 {
        msg!("Collateral amount to deposit mustn't be zero");
        return Err(ErrorCode::InvalidAmount.into());
    }

    let mut obligation = accounts.obligation.load_mut()?;

    if accounts.borrower.key() != obligation.owner {
        return Err(error!(ErrorCode::IllegalOwner));
    }
    if accounts.reserve.lending_market != obligation.lending_market {
        return Err(error!(err::market_mismatch()));
    }

    obligation.deposit(
        accounts.reserve.key(),
        collateral_amount,
        accounts.clock.slot,
    )?;
    obligation.last_update.mark_stale();

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
            authority: self.borrower.to_account_info(),
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }
}
