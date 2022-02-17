//! Action which allows the borrower to withdraw their deposited collateral.
//! They can only withdraw as much collateral as not to go under a threshold
//! with respect to their borrowed funds. See eq. (7) for a formula which limits
//! how much collateral can be withdrawn.

use crate::prelude::*;
use anchor_spl::token::{self, Token};

#[derive(Accounts)]
#[instruction(lending_market_bump_seed: u8)]
pub struct WithdrawObligationCollateral<'info> {
    #[account(signer)]
    pub borrower: AccountInfo<'info>,
    #[account(mut)]
    pub obligation: AccountLoader<'info, Obligation>,
    /// The reserve whose collateral is deposited in the obligation and should
    /// be withdrawn.
    #[account(
        constraint = !reserve.is_stale(&clock) @ err::reserve_stale(),
    )]
    pub reserve: Box<Account<'info, Reserve>>,
    #[account(
        seeds = [reserve.lending_market.as_ref()],
        bump = lending_market_bump_seed,
    )]
    pub lending_market_pda: AccountInfo<'info>,
    /// The reserve's collateral supply wallet where BLp stores all deposited
    /// collateral from all borrowers.
    #[account(
        mut,
        constraint = source_collateral_wallet.key() == reserve.collateral.supply
            @ err::acc("Source col. wallet must eq. reserve's col. supply"),
    )]
    pub source_collateral_wallet: AccountInfo<'info>,
    /// Any kind of token wallet with the same mint as source collateral
    /// wallet.
    #[account(
        mut,
        constraint = destination_collateral_wallet.key() !=
            reserve.collateral.supply @ err::acc("Dest. col. wallet mustn't \
            eq. reserve's col. supply"),
    )]
    pub destination_collateral_wallet: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn handle(
    ctx: Context<WithdrawObligationCollateral>,
    lending_market_bump_seed: u8,
    collateral_amount: u64,
) -> ProgramResult {
    msg!(
        "withdraw {} tokens from obligation '{}'",
        collateral_amount,
        ctx.accounts.obligation.key(),
    );

    let accounts = ctx.accounts;

    if collateral_amount == 0 {
        msg!("Collateral amount provided cannot be zero");
        return Err(ErrorCode::InvalidAmount.into());
    }

    let mut obligation = accounts.obligation.load_mut()?;

    if accounts.reserve.lending_market != obligation.lending_market {
        return Err(err::market_mismatch());
    }
    if obligation.is_stale(&accounts.clock) {
        return Err(err::obligation_stale());
    }
    if accounts.borrower.key() != obligation.owner {
        return Err(ProgramError::IllegalOwner);
    }

    let (collateral_index, collateral) =
        obligation.get_collateral(accounts.reserve.key())?;

    if collateral.deposited_amount == 0 {
        return Err(err::empty_collateral(
            "Collateral deposited amount is zero",
        ));
    }

    let withdraw_amount = if !obligation.has_borrows() {
        // if there are no borrows then withdraw up to all deposited amount
        collateral.deposited_amount.min(collateral_amount)
    } else if obligation.deposited_value.to_dec() == Decimal::zero() {
        // unlikely situation as if there's no deposited value then there won't
        // be any borrows, but since we're dividing by deposited amount, this
        // is a more friendly error in any case
        return Err(err::empty_collateral(
            "Obligation deposited value is zero",
        ));
    } else {
        let max_withdraw_value = obligation.max_withdraw_value()?;
        if max_withdraw_value == Decimal::zero() {
            return Err(err::empty_collateral(
                "No collateral can be withdrawn",
            ));
        }

        let withdraw_amount =
            collateral_amount.min(collateral.deposited_amount);

        // what percentage of deposited funds is user trying to withdraw (0; 1]
        let withdraw_pct = Decimal::from(withdraw_amount)
            .try_div(Decimal::from(collateral.deposited_amount))?;
        // total value times the withdraw percentage gives us withdraw value
        let withdraw_value =
            collateral.market_value.to_dec().try_mul(withdraw_pct)?;

        if withdraw_value > max_withdraw_value {
            msg!(
                "Withdraw value is {}, but it cannot exceed \
                maximum withdraw value {}",
                withdraw_value,
                max_withdraw_value
            );
            return Err(ErrorCode::WithdrawTooLarge.into());
        }

        if withdraw_amount == 0 {
            msg!("Withdraw amount is too small to transfer collateral");
            return Err(ErrorCode::WithdrawTooSmall.into());
        }

        withdraw_amount
    };

    obligation.withdraw(
        withdraw_amount,
        collateral_index,
        accounts.clock.slot,
    )?;
    obligation.last_update.mark_stale();

    let pda_seeds = &[
        &accounts.reserve.lending_market.to_bytes()[..],
        &[lending_market_bump_seed],
    ];
    token::transfer(
        accounts
            .as_withdraw_collateral_context()
            .with_signer(&[&pda_seeds[..]]),
        withdraw_amount,
    )?;

    Ok(())
}

impl<'info> WithdrawObligationCollateral<'info> {
    pub fn as_withdraw_collateral_context(
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
