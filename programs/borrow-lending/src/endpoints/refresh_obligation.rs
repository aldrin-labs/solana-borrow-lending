use crate::prelude::*;
use std::collections::BTreeMap;

#[derive(Accounts)]
pub struct RefreshObligation<'info> {
    #[account(mut)]
    pub obligation: Box<Account<'info, Obligation>>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn handle(ctx: Context<RefreshObligation>) -> ProgramResult {
    // Performance assumption: all remaining accounts which are of kind
    // [`Reserve`] are relevant to the rest of this endpoint logic.
    let reserves: BTreeMap<_, _> = ctx
        .remaining_accounts
        .iter()
        .map(|acc| {
            if acc.owner != ctx.program_id {
                msg!("Owner of account '{}' must be this program", acc.key);
                return Err(ProgramError::IllegalOwner.into());
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
    let mut borrowed_value = Decimal::zero();
    let mut allowed_borrow_value = Decimal::zero();
    let mut unhealthy_borrow_value = Decimal::zero();

    for reserve in accounts.obligation.reserves.iter_mut() {
        match reserve {
            ObligationReserve::Empty => (),
            ObligationReserve::Liquidity { inner: liquidity } => {
                let borrow_reserve = get_reserve(
                    &reserves,
                    &liquidity.borrow_reserve,
                    accounts.clock.slot,
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

                borrowed_value =
                    borrowed_value.try_add(updated_market_value)?;
            }
            ObligationReserve::Collateral { inner: collateral } => {
                let deposit_reserve = get_reserve(
                    &reserves,
                    &collateral.deposit_reserve,
                    accounts.clock.slot,
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

                let loan_to_value_rate = Rate::from_percent(
                    deposit_reserve.config.loan_to_value_ratio,
                );
                allowed_borrow_value = allowed_borrow_value.try_add(
                    collateral
                        .market_value
                        .to_dec()
                        .try_mul(loan_to_value_rate)?,
                )?;

                let liquidation_threshold_rate = Rate::from_percent(
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

    accounts.obligation.deposited_value = deposited_value.into();
    accounts.obligation.borrowed_value = borrowed_value.into();
    accounts.obligation.allowed_borrow_value = allowed_borrow_value.into();
    accounts.obligation.unhealthy_borrow_value = unhealthy_borrow_value.into();

    accounts
        .obligation
        .last_update
        .update_slot(accounts.clock.slot);

    Ok(())
}

fn get_reserve<'a>(
    reserves: &'a BTreeMap<Pubkey, Reserve>,
    key: &Pubkey,
    slot: u64,
) -> Result<&'a Reserve> {
    let reserve = reserves.get(key).ok_or_else(|| {
        msg!("No valid account provided for reserve '{}'", key);
        ErrorCode::MissingReserveAccount
    })?;

    if reserve.last_update.is_stale(slot).unwrap_or(true) {
        msg!("Reserve '{}' is stale, please refresh it first");
        return Err(ErrorCode::ReserveStale.into());
    }

    Ok(reserve)
}
