use crate::prelude::*;
use std::collections::BTreeMap;

#[derive(Accounts)]
pub struct RefreshObligation<'info> {
    #[account(mut)]
    pub obligation: AccountLoader<'info, Obligation>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn handle(ctx: Context<RefreshObligation>) -> Result<()> {
    msg!(
        "refresh obligation '{}' at slot {}",
        ctx.accounts.obligation.key(),
        ctx.accounts.clock.slot
    );

    // Performance assumption: all remaining accounts which are of kind
    // [`Reserve`] are relevant to the rest of this endpoint logic.
    let reserves: BTreeMap<_, _> = ctx
        .remaining_accounts
        .iter()
        .map(|acc| {
            if acc.owner != ctx.program_id {
                msg!("Owner of account '{}' must be this program", acc.key);
                return Err(ErrorCode::IllegalOwner.into());
            }

            let mut data: &[u8] = &acc.try_borrow_data()?;
            let reserve =
                Reserve::try_deserialize(&mut data).map_err(|err| {
                    msg!("Reserve account '{}' contains invalid data", acc.key);
                    err
                })?;

            Ok((acc.key(), reserve))
        })
        .collect::<Result<_>>()?;

    let accounts = ctx.accounts;

    let mut deposited_value = Decimal::zero();
    // borrow value which must be covered by collateral, doesn't include
    // leverage multiplier
    let mut collateralized_borrowed_value = Decimal::zero();
    // total borrowed assets from reserve funds including leverage multiplier
    let mut total_borrowed_value = Decimal::zero();
    let mut allowed_borrow_value = Decimal::zero();
    let mut unhealthy_borrow_value = Decimal::zero();

    let mut obligation = accounts.obligation.load_mut()?;

    for reserve in obligation.reserves.iter_mut() {
        match reserve {
            ObligationReserve::Empty => (),
            ObligationReserve::Liquidity { inner: liquidity } => {
                let borrow_reserve = get_reserve(
                    &accounts.clock,
                    &reserves,
                    &liquidity.borrow_reserve,
                )?;

                liquidity.accrue_interest(
                    borrow_reserve.liquidity.cumulative_borrow_rate.into(),
                )?;

                let decimals = 10u64
                    .checked_pow(borrow_reserve.liquidity.mint_decimals as u32)
                    .ok_or(ErrorCode::MathOverflow)?;

                let updated_market_value =
                    Decimal::from(liquidity.borrowed_amount)
                        .try_mul(Decimal::from(
                            borrow_reserve.liquidity.market_price,
                        ))?
                        .try_div(decimals)?;
                liquidity.market_value = updated_market_value.into();

                match liquidity.loan_kind {
                    LoanKind::Standard => {
                        collateralized_borrowed_value =
                            collateralized_borrowed_value
                                .try_add(updated_market_value)?;
                    }
                    LoanKind::YieldFarming { leverage } => {
                        // For example user borrows $600 at 3x leverage, which
                        // is 300%. Then 600 / 300 * 100 = $200 must be
                        // collateralized.
                        collateralized_borrowed_value =
                            collateralized_borrowed_value.try_add(
                                updated_market_value
                                    .try_div(Decimal::from(leverage))?,
                            )?;
                    }
                }

                total_borrowed_value =
                    total_borrowed_value.try_add(updated_market_value)?;
            }
            ObligationReserve::Collateral { inner: collateral } => {
                let deposit_reserve = get_reserve(
                    &accounts.clock,
                    &reserves,
                    &collateral.deposit_reserve,
                )?;

                let decimals = 10u64
                    .checked_pow(deposit_reserve.liquidity.mint_decimals as u32)
                    .ok_or(ErrorCode::MathOverflow)?;

                let updated_market_value = deposit_reserve
                    .collateral_exchange_rate()?
                    .decimal_collateral_to_liquidity(
                        collateral.deposited_amount.into(),
                    )?
                    .try_mul(Decimal::from(
                        deposit_reserve.liquidity.market_price,
                    ))?
                    .try_div(decimals)?;

                collateral.market_value = updated_market_value.into();

                deposited_value =
                    deposited_value.try_add(updated_market_value)?;

                let loan_to_value_rate = Decimal::from_percent(
                    deposit_reserve.config.loan_to_value_ratio,
                );
                allowed_borrow_value = allowed_borrow_value.try_add(
                    collateral
                        .market_value
                        .to_dec()
                        .try_mul(loan_to_value_rate)?,
                )?;

                // ref. eq. (9)
                let liquidation_threshold_rate = Decimal::from_percent(
                    deposit_reserve.config.liquidation_threshold,
                );
                unhealthy_borrow_value = unhealthy_borrow_value.try_add(
                    collateral
                        .market_value
                        .to_dec()
                        .try_mul(liquidation_threshold_rate)?,
                )?;
            }
        }
    }

    obligation.deposited_value = deposited_value.into();
    obligation.allowed_borrow_value = allowed_borrow_value.into();
    obligation.unhealthy_borrow_value = unhealthy_borrow_value.into();
    obligation.total_borrowed_value = total_borrowed_value.into();
    obligation.collateralized_borrowed_value =
        collateralized_borrowed_value.into();

    obligation.last_update.update_slot(accounts.clock.slot);

    Ok(())
}

fn get_reserve<'a>(
    clock: &Clock,
    reserves: &'a BTreeMap<Pubkey, Reserve>,
    key: &Pubkey,
) -> Result<&'a Reserve> {
    let reserve = reserves.get(key).ok_or_else(|| {
        msg!("No valid account provided for reserve '{}'", key);
        ErrorCode::MissingReserveAccount
    })?;

    if reserve.is_stale(clock) {
        msg!(
            "Reserve '{}' is stale by {:?} slots",
            key,
            reserve.last_update.slots_elapsed(clock.slot).ok()
        );
        return Err(ErrorCode::ReserveStale.into());
    }

    Ok(reserve)
}
