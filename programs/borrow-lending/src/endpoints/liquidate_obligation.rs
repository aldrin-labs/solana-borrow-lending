//! If the obligation gets unhealthy, that is the collateral is not enough to
//! safely cover the borrows, we allow any block-chain user to repay the
//! obligation in the borrower's stead. The motivation is that the liquidator
//! gets a better deal by multiplying the liquidity market value by a bonus
//! rate. The liquidity with advantageous value is then exchanged for collateral
//! which is transferred to the liquidator's destination wallet.
//!
//! One way to think about this action is as a combination of repay liquidity
//! and withdraw collateral under different market rates.

use crate::prelude::*;
use anchor_spl::token::{self, Token};
use std::cmp::Ordering;

#[derive(Accounts)]
#[instruction(lending_market_bump_seed: u8)]
pub struct LiquidateObligation<'info> {
    /// Any user can call this endpoint.
    #[account(signer)]
    pub liquidator: AccountInfo<'info>,
    /// Liquidator's wallet from which they repay.
    ///
    /// We're sure it belongs to the correct token program because otherwise
    /// token transfer CPI fails.
    #[account(
        mut,
        constraint = source_liquidity_wallet.key() !=
            reserve_liquidity_wallet.key() @ err::acc("Source liq. wallet \
            mustn't eq. reserve's liq. wallet"),
        constraint = source_liquidity_wallet.key() !=
            withdraw_reserve.liquidity.supply @ err::acc("Source liq. wallet \
            mustn't eq. withdraw reserve liq. supply"),
    )]
    pub source_liquidity_wallet: AccountInfo<'info>,
    /// Liquidator's wallet into which they receive collateral.
    ///
    /// We're sure it belongs to the correct token program because otherwise
    /// token transfer CPI fails.
    #[account(
        mut,
        constraint = destination_collateral_wallet.key() !=
            reserve_collateral_wallet.key() @ err::acc("Dest. col. wallet \
            mustn't eq. reserve's col. wallet"),
        constraint = destination_collateral_wallet.key() !=
            repay_reserve.collateral.supply @ err::acc("Dest. col. wallet \
            mustn't eq. repay reserve col. supply"),
    )]
    pub destination_collateral_wallet: AccountInfo<'info>,
    #[account(
        mut,
        constraint = !obligation.is_stale(&clock) @ err::obligation_stale(),
        constraint = !obligation.is_deposited_value_zero()
            @ err::empty_collateral("Collateral deposited value is zero"),
        constraint = !obligation.is_borrowed_value_zero()
            @ err::empty_liquidity("Liquidity deposited value is zero"),
        constraint = !obligation.is_healthy() @ err::obligation_healthy(),
    )]
    pub obligation: Box<Account<'info, Obligation>>,
    /// A reserve from which the obligation borrowed liquidity. The liquidator
    /// will pay from their source liquidity wallet and get a better value
    /// on the liquidity than market value as a reward.
    #[account(
        mut,
        constraint = repay_reserve.lending_market == obligation.lending_market
            @ err::market_mismatch(),
        constraint = !repay_reserve.is_stale(&clock) @ err::reserve_stale(),
    )]
    pub repay_reserve: Box<Account<'info, Reserve>>,
    /// Wallet into which liquidator repays liquidity amount. Associated with
    /// repay reserve.
    ///
    /// We're sure it belongs to correct token program because it's defined in
    /// reserve's config.
    #[account(
        mut,
        constraint = reserve_liquidity_wallet.key() ==
            repay_reserve.liquidity.supply @ err::acc("Reserve liq. wallet \
            must match supply config"),
    )]
    pub reserve_liquidity_wallet: AccountInfo<'info>,
    /// A reserve into which the obligation deposited collateral. The
    /// liquidator will receive collateral into their destination wallet.
    /// Because they get better value than market value on liquidity as a
    /// reward, they earn more collateral and profit.
    #[account(
        mut,
        constraint = withdraw_reserve.lending_market == obligation.lending_market
            @ err::market_mismatch(),
        constraint = !withdraw_reserve.is_stale(&clock) @ err::reserve_stale(),
    )]
    pub withdraw_reserve: Box<Account<'info, Reserve>>,
    /// Wallet from which the liquidator is payed in collateral. Associated
    /// with withdraw reserve.
    ///
    /// We're sure it belongs to correct token program because it's defined in
    /// reserve's config.
    #[account(
        mut,
        constraint = reserve_collateral_wallet.key() ==
            withdraw_reserve.collateral.supply @ err::acc("Reserve col. wallet \
            must match supply config"),
    )]
    pub reserve_collateral_wallet: AccountInfo<'info>,
    #[account(
        seeds = [withdraw_reserve.lending_market.as_ref()],
        bump = lending_market_bump_seed,
    )]
    pub lending_market_pda: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn handle(
    ctx: Context<LiquidateObligation>,
    lending_market_bump_seed: u8,
    liquidity_amount: u64,
) -> ProgramResult {
    let accounts = ctx.accounts;
    msg!(
        "liquidate obligation '{}' amount {} at slot {}",
        accounts.obligation.key(),
        liquidity_amount,
        accounts.clock.slot
    );

    if liquidity_amount == 0 {
        msg!("Liquidity amount provided cannot be zero");
        return Err(ErrorCode::InvalidAmount.into());
    }

    let (collateral_index, collateral) = accounts
        .obligation
        .get_collateral(accounts.withdraw_reserve.key())?;
    // TODO: move this check into the calc function and test it
    if collateral.market_value.to_dec() == Decimal::zero() {
        return Err(err::empty_collateral("Obligation deposit value is zero"));
    }

    let (liquidity_index, liquidity) = accounts
        .obligation
        .get_liquidity(accounts.repay_reserve.key())?;
    // TODO: move this check into the calc function and test it
    if liquidity.market_value.to_dec() == Decimal::zero() {
        return Err(err::empty_liquidity("Obligation borrow value is zero"));
    }

    let LiquidationAmounts {
        settle_amount,
        repay_amount,
        withdraw_amount,
    } = calculate_liquidation_amounts(
        liquidity,
        collateral,
        accounts.obligation.borrowed_value.to_dec(),
        liquidity_amount,
        accounts.withdraw_reserve.config.liquidation_bonus.into(),
    )?;

    // TODO: move these checks into the calc function and test it
    if repay_amount == 0 {
        msg!("Liquidation is too small to transfer liquidity");
        return Err(ErrorCode::LiquidationTooSmall.into());
    }
    if withdraw_amount == 0 {
        msg!("Liquidation is too small to receive collateral");
        return Err(ErrorCode::LiquidationTooSmall.into());
    }

    // the liquidator repayed liquidity
    accounts
        .repay_reserve
        .liquidity
        .repay(repay_amount, settle_amount)?;
    accounts.obligation.repay(settle_amount, liquidity_index)?;

    // and gets collateral in exchange
    accounts
        .obligation
        .withdraw(withdraw_amount, collateral_index)?;

    accounts.obligation.last_update.mark_stale();
    accounts.repay_reserve.last_update.mark_stale();

    token::transfer(accounts.into_repay_liquidity_context(), repay_amount)?;

    let pda_seeds = &[
        &accounts.withdraw_reserve.lending_market.to_bytes()[..],
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

#[derive(Debug, PartialEq, Eq)]
pub struct LiquidationAmounts {
    /// Amount of liquidity that is settled from the obligation. It includes
    /// the amount of loan that was defaulted if collateral is depleted.
    pub settle_amount: Decimal,
    /// Amount that will be repaid as u64
    pub repay_amount: u64,
    /// Amount of collateral to withdraw in exchange for repay amount
    pub withdraw_amount: u64,
}

/// Liquidate some or all of an unhealthy obligation. The amount to liquidate
/// gives us one of two possible maximums. The other is given by eq. (8).
///
/// If the borrowed liquidity is less than `consts::LIQUIDATION_CLOSE_AMOUNT`
/// then it gets liquidated whole. Otherwise eq. (8) tells us that at most
/// `const:LIQUIDATION_CLOSE_FACTOR` (e.g. 50%) can be liquidated at once.
fn calculate_liquidation_amounts(
    liquidity: &ObligationLiquidity,
    collateral: &ObligationCollateral,
    obligation_borrowed_value: Decimal,
    amount_to_liquidate: u64,
    liquidation_bonus: Decimal,
) -> Result<LiquidationAmounts> {
    let col_market_val = collateral.market_value.to_dec();
    let liq_market_val = liquidity.market_value.to_dec();
    let liq_borrowed_amount = liquidity.borrowed_amount.to_dec();
    let bonus_rate = liquidation_bonus.try_add(Decimal::one())?;

    let max_amount = Decimal::from(amount_to_liquidate)
        .min(liquidity.borrowed_amount.to_dec());

    let settle_amount;
    let repay_amount;
    let withdraw_amount;

    // under some small amount we liquidate the whole obligation liquidity
    let is_too_small =
        liq_borrowed_amount <= consts::LIQUIDATION_CLOSE_AMOUNT.into();

    if is_too_small {
        settle_amount = liq_borrowed_amount;

        // give the liquidator a better deal
        let liquidation_value = liq_market_val.try_mul(bonus_rate)?;
        match liquidation_value.cmp(&col_market_val) {
            // liquidation value is more than collateral, withdraw all
            // collateral but only a fraction of liquidity
            Ordering::Greater => {
                let repay_pct = col_market_val.try_div(liquidation_value)?;
                repay_amount = max_amount.try_mul(repay_pct)?.try_ceil_u64()?;
                withdraw_amount = collateral.deposited_amount;
            }
            // withdraw all of liquidity and collateral
            Ordering::Equal => {
                repay_amount = max_amount.try_ceil_u64()?;
                withdraw_amount = collateral.deposited_amount;
            }
            // withdraw only part of collateral but all of liquidity
            Ordering::Less => {
                let withdraw_pct = liquidation_value.try_div(col_market_val)?;
                repay_amount = max_amount.try_floor_u64()?;
                withdraw_amount = Decimal::from(collateral.deposited_amount)
                    .try_mul(withdraw_pct)?
                    .try_floor_u64()?;
            }
        }
    } else {
        // as per method docs, bounded by close factor and liquidator's desired
        // liquidity to repay
        let liquidation_amount = liquidity
            .max_liquidation_amount(obligation_borrowed_value)?
            .min(max_amount);
        // what fraction of liquidity to repay
        let liquidation_pct =
            liquidation_amount.try_div(liq_borrowed_amount)?;
        let liquidation_value = liq_market_val
            .try_mul(liquidation_pct)?
            .try_mul(bonus_rate)?;

        match liquidation_value.cmp(&col_market_val) {
            // liquidity value is greater than value of the collateral,
            // withdraw all of collateral but retain some liquidity
            Ordering::Greater => {
                let repay_pct = col_market_val.try_div(liquidation_value)?;
                settle_amount = liquidation_amount.try_mul(repay_pct)?;
                repay_amount = settle_amount.try_ceil_u64()?;
                withdraw_amount = collateral.deposited_amount;
            }
            // withdraw all of collateral and repay all of liquidity
            Ordering::Equal => {
                settle_amount = liquidation_amount;
                repay_amount = settle_amount.try_ceil_u64()?;
                withdraw_amount = collateral.deposited_amount;
            }
            // there's more collateral in value than liquidity, withdraw only
            // part of collateral but repay all liquidity
            Ordering::Less => {
                let withdraw_pct = liquidation_value.try_div(col_market_val)?;
                settle_amount = liquidation_amount;
                repay_amount = settle_amount.try_floor_u64()?;
                withdraw_amount = Decimal::from(collateral.deposited_amount)
                    .try_mul(withdraw_pct)?
                    .try_floor_u64()?;
            }
        }
    }

    Ok(LiquidationAmounts {
        settle_amount,
        repay_amount,
        withdraw_amount,
    })
}

impl<'info> LiquidateObligation<'info> {
    pub fn into_repay_liquidity_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>> {
        let cpi_accounts = token::Transfer {
            from: self.source_liquidity_wallet.clone(),
            to: self.reserve_liquidity_wallet.clone(),
            authority: self.liquidator.clone(),
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }

    pub fn into_withdraw_collateral_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>> {
        let cpi_accounts = token::Transfer {
            from: self.reserve_collateral_wallet.clone(),
            to: self.destination_collateral_wallet.clone(),
            authority: self.lending_market_pda.clone(),
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // liquidation bonus of 5%
    const B_5P: PercentageInt = PercentageInt::new(5);

    // total borrowed value of the whole obligation, not just one particular
    // liquidity
    const OBL_BORR_VAL: u64 = 1500;

    const AMOUNT_TO_LIQUIDATE: u64 = 100;

    #[test]
    fn test_calculate_liquidation_when_liq_val_less_than_col_val() {
        let mut col = ObligationCollateral::new(Default::default());
        col.deposited_amount = 80u64.into();
        col.market_value = 570u64.into();
        let mut liq = ObligationLiquidity::new(Default::default());
        liq.borrowed_amount = 100u64.into();
        liq.market_value = 500u64.into();

        let r = calculate_liquidation_amounts(
            &liq,
            &col,
            OBL_BORR_VAL.into(),
            AMOUNT_TO_LIQUIDATE,
            B_5P.into(),
        )
        .unwrap();

        assert_eq!(
            r,
            LiquidationAmounts {
                settle_amount: 100u64.into(),
                repay_amount: 100,
                withdraw_amount: 73,
            },
        );
    }

    #[test]
    fn test_calculate_liquidation_when_liq_val_greater_than_col_val() {
        let mut col = ObligationCollateral::new(Default::default());
        col.deposited_amount = 80u64.into();
        col.market_value = 570u64.into();
        let mut liq = ObligationLiquidity::new(Default::default());
        liq.borrowed_amount = 100u64.into();
        liq.market_value = 900u64.into();

        let r = calculate_liquidation_amounts(
            &liq,
            &col,
            OBL_BORR_VAL.into(),
            AMOUNT_TO_LIQUIDATE,
            B_5P.into(),
        )
        .unwrap();

        assert_eq!(
            r,
            LiquidationAmounts {
                settle_amount: Decimal::from(60317460317460317392u128)
                    .try_div(consts::WAD)
                    .unwrap(),
                repay_amount: 61,
                withdraw_amount: 80,
            },
        );
    }

    #[test]
    fn test_calculate_liquidation_when_liq_val_equals_col_val() {
        let mut col = ObligationCollateral::new(Default::default());
        col.deposited_amount = 80u64.into();
        col.market_value = Decimal::from(7875u64).try_div(10).unwrap().into();
        let mut liq = ObligationLiquidity::new(Default::default());
        liq.borrowed_amount = 100u64.into();
        liq.market_value = 800u64.into();

        let r = calculate_liquidation_amounts(
            &liq,
            &col,
            OBL_BORR_VAL.into(),
            AMOUNT_TO_LIQUIDATE,
            B_5P.into(),
        )
        .unwrap();

        assert_eq!(
            r,
            LiquidationAmounts {
                settle_amount: Decimal::from(93750000000000000000u128)
                    .try_div(consts::WAD)
                    .unwrap(),
                repay_amount: 94,
                withdraw_amount: 80,
            },
        );
    }

    #[test]
    fn test_calculate_liquidation_close_amount_when_liq_val_less_than_col_val()
    {
        let mut col = ObligationCollateral::new(Default::default());
        col.deposited_amount = 80u64.into();
        col.market_value = 570u64.into();
        let mut liq = ObligationLiquidity::new(Default::default());
        liq.borrowed_amount =
            Decimal::from(consts::LIQUIDATION_CLOSE_AMOUNT - 1).into();
        liq.market_value = 500u64.into();

        let r = calculate_liquidation_amounts(
            &liq,
            &col,
            OBL_BORR_VAL.into(),
            AMOUNT_TO_LIQUIDATE,
            B_5P.into(),
        )
        .unwrap();

        assert_eq!(
            r,
            LiquidationAmounts {
                settle_amount: 1u64.into(),
                repay_amount: 1,
                withdraw_amount: 73,
            },
        );
    }

    #[test]
    fn test_calculate_liquidation_close_amount_when_liq_val_greater_than_col_val(
    ) {
        let mut col = ObligationCollateral::new(Default::default());
        col.deposited_amount = 7u64.into();
        col.market_value = 10u64.into();
        let mut liq = ObligationLiquidity::new(Default::default());
        liq.borrowed_amount =
            Decimal::from(consts::LIQUIDATION_CLOSE_AMOUNT - 1).into();
        liq.market_value = 500u64.into();

        let r = calculate_liquidation_amounts(
            &liq,
            &col,
            OBL_BORR_VAL.into(),
            AMOUNT_TO_LIQUIDATE,
            B_5P.into(),
        )
        .unwrap();

        assert_eq!(
            r,
            LiquidationAmounts {
                settle_amount: 1u64.into(),
                repay_amount: 1,
                withdraw_amount: 7,
            },
        );
    }

    #[test]
    fn test_calculate_liquidation_close_amount_when_liq_val_equal_to_col_val() {
        let mut col = ObligationCollateral::new(Default::default());
        col.deposited_amount = 50u64.into();
        col.market_value = 105u64.into();
        let mut liq = ObligationLiquidity::new(Default::default());
        liq.borrowed_amount =
            Decimal::from(consts::LIQUIDATION_CLOSE_AMOUNT - 1).into();
        liq.market_value = 100u64.into();

        let r = calculate_liquidation_amounts(
            &liq,
            &col,
            OBL_BORR_VAL.into(),
            AMOUNT_TO_LIQUIDATE,
            B_5P.into(),
        )
        .unwrap();

        assert_eq!(
            r,
            LiquidationAmounts {
                settle_amount: 1u64.into(),
                repay_amount: 1,
                withdraw_amount: 50,
            },
        );
    }
}
