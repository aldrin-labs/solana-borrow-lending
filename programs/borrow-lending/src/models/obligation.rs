use crate::prelude::*;
use std::cmp::Ordering;

#[account]
#[repr(C)]
pub struct Obligation {
    pub last_update: LastUpdate,
    pub lending_market: Pubkey,
    pub owner: Pubkey,
    // Ideally we'd use a const generic, but that's not supported by anchor.
    // Second to ideal we'd use a const, but that's not supported either.
    pub reserves: [ObligationReserve; 10],
    /// Market value of deposits
    pub deposited_value: SDecimal,
    /// Market value of borrows
    pub borrowed_value: SDecimal,
    /// The maximum borrow value at the weighted average loan to value ratio.
    pub allowed_borrow_value: SDecimal,
    /// The dangerous borrow value at the weighted average liquidation
    /// threshold.
    pub unhealthy_borrow_value: SDecimal,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq)]
pub enum ObligationReserve {
    Empty,
    Collateral { inner: ObligationCollateral },
    Liquidity { inner: ObligationLiquidity },
}

#[derive(
    AnchorSerialize,
    AnchorDeserialize,
    Clone,
    Copy,
    Debug,
    Eq,
    PartialEq,
    Default,
)]
pub struct ObligationCollateral {
    pub deposit_reserve: Pubkey,
    pub deposited_amount: u64,
    pub market_value: SDecimal,
}

#[derive(
    AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, Eq, PartialEq,
)]
pub struct ObligationLiquidity {
    pub borrow_reserve: Pubkey,
    /// Borrow rate used for calculating interest.
    pub cumulative_borrow_rate: SDecimal,
    /// Amount of liquidity borrowed plus interest.
    pub borrowed_amount: SDecimal,
    pub market_value: SDecimal,
}

impl Default for ObligationReserve {
    fn default() -> Self {
        Self::Empty
    }
}

impl Default for Obligation {
    fn default() -> Self {
        Self {
            // this will compile err if the const doesn't match the hard coded
            // number in the struct
            reserves: [ObligationReserve::Empty;
                consts::MAX_OBLIGATION_RESERVES],
            last_update: LastUpdate::default(),
            lending_market: Pubkey::default(),
            owner: Pubkey::default(),
            deposited_value: Decimal::zero().into(),
            borrowed_value: Decimal::zero().into(),
            allowed_borrow_value: Decimal::zero().into(),
            unhealthy_borrow_value: Decimal::zero().into(),
        }
    }
}

impl Obligation {
    pub fn is_stale(&self, clock: &Clock) -> bool {
        self.last_update.is_stale(clock.slot).unwrap_or(true)
    }

    /// Withdraw collateral and remove it from deposits if zeroed out
    pub fn withdraw(
        &mut self,
        withdraw_amount: u64,
        collateral_index: usize,
    ) -> Result<()> {
        match &mut self.reserves[collateral_index] {
            ObligationReserve::Collateral { inner: collateral }
                if collateral.deposited_amount == withdraw_amount =>
            {
                self.reserves[collateral_index] = ObligationReserve::Empty;
                Ok(())
            }
            ObligationReserve::Collateral {
                inner: ref mut collateral,
            } => {
                collateral.withdraw(withdraw_amount)?;
                Ok(())
            }
            _ => {
                msg!(
                    "Expected a collateral at index {}, aborting",
                    collateral_index
                );
                Err(ProgramError::InvalidArgument.into())
            }
        }
    }

    pub fn has_borrows(&self) -> bool {
        self.reserves.iter().any(|reserve| {
            matches!(reserve, ObligationReserve::Liquidity { .. })
        })
    }

    pub fn has_deposits(&self) -> bool {
        self.reserves.iter().any(|reserve| {
            matches!(reserve, ObligationReserve::Collateral { .. })
        })
    }

    pub fn is_deposited_value_zero(&self) -> bool {
        self.deposited_value.to_dec() == Decimal::zero()
    }

    pub fn is_borrowed_value_zero(&self) -> bool {
        self.borrowed_value.to_dec() == Decimal::zero()
    }

    pub fn is_healthy(&self) -> bool {
        self.borrowed_value.to_dec() < self.unhealthy_borrow_value.to_dec()
    }

    // ref. eq. (7)
    pub fn max_withdraw_value(&self) -> Result<Decimal> {
        let required_deposit_value = self
            .borrowed_value
            .to_dec()
            .try_mul(self.deposited_value.to_dec())?
            .try_div(self.allowed_borrow_value.to_dec())?;
        if required_deposit_value >= self.deposited_value.into() {
            return Ok(Decimal::zero());
        }
        self.deposited_value
            .to_dec()
            .try_sub(required_deposit_value)
    }

    pub fn get_collateral(
        &self,
        key: Pubkey,
    ) -> Result<(usize, &ObligationCollateral)> {
        self.reserves
            .iter()
            .enumerate()
            .find_map(|(index, reserve)| match reserve {
                ObligationReserve::Collateral { ref inner }
                    if inner.deposit_reserve == key =>
                {
                    Some((index, inner))
                }
                _ => None,
            })
            .ok_or_else(|| {
                msg!("Obligation has no such reserve collateral");
                ProgramError::InvalidArgument.into()
            })
    }

    pub fn get_liquidity(
        &self,
        key: Pubkey,
    ) -> Result<(usize, &ObligationLiquidity)> {
        self.reserves
            .iter()
            .enumerate()
            .find_map(|(index, reserve)| match reserve {
                ObligationReserve::Liquidity { ref inner }
                    if inner.borrow_reserve == key =>
                {
                    Some((index, inner))
                }
                _ => None,
            })
            .ok_or_else(|| {
                msg!("Obligation has no such reserve liquidity");
                ProgramError::InvalidArgument.into()
            })
    }

    pub fn deposit(
        &mut self,
        reserve_key: Pubkey,
        collateral_amount: u64,
    ) -> Result<()> {
        let mut first_empty = None;
        for (i, reserve) in self.reserves.iter_mut().enumerate() {
            match reserve {
                ObligationReserve::Empty if first_empty.is_none() => {
                    first_empty = Some(i);
                }
                ObligationReserve::Collateral { ref mut inner }
                    if inner.deposit_reserve == reserve_key =>
                {
                    inner.deposit(collateral_amount)?;
                    return Ok(());
                }
                _ => (),
            };
        }

        if let Some(i) = first_empty {
            let mut collateral = ObligationCollateral::new(reserve_key);
            collateral.deposit(collateral_amount)?;
            self.reserves[i] =
                ObligationReserve::Collateral { inner: collateral };

            Ok(())
        } else {
            msg!(
                "Cannot add another reserve because limit of {} \
                has been reached",
                self.reserves.len()
            );
            Err(ErrorCode::ObligationReserveLimit.into())
        }
    }

    pub fn borrow(
        &mut self,
        reserve_key: Pubkey,
        liquidity_amount: Decimal,
    ) -> Result<()> {
        let mut first_empty = None;
        for (i, reserve) in self.reserves.iter_mut().enumerate() {
            match reserve {
                ObligationReserve::Empty if first_empty.is_none() => {
                    first_empty = Some(i);
                }
                ObligationReserve::Liquidity { ref mut inner }
                    if inner.borrow_reserve == reserve_key =>
                {
                    inner.borrow(liquidity_amount)?;
                    return Ok(());
                }
                _ => (),
            };
        }

        if let Some(i) = first_empty {
            let mut liquidity = ObligationLiquidity::new(reserve_key);
            liquidity.borrow(liquidity_amount)?;
            self.reserves[i] =
                ObligationReserve::Liquidity { inner: liquidity };

            Ok(())
        } else {
            msg!(
                "Cannot add another reserve because limit of {} \
                has been reached",
                self.reserves.len()
            );
            Err(ErrorCode::ObligationReserveLimit.into())
        }
    }

    /// Repay liquidity and remove it from borrows if zeroed out
    pub fn repay(
        &mut self,
        settle_amount: Decimal,
        liquidity_index: usize,
    ) -> ProgramResult {
        match &mut self.reserves[liquidity_index] {
            ObligationReserve::Liquidity { inner: liquidity }
                if liquidity.borrowed_amount.to_dec() == settle_amount =>
            {
                self.reserves[liquidity_index] = ObligationReserve::Empty;
                Ok(())
            }
            ObligationReserve::Liquidity {
                inner: ref mut liquidity,
            } => {
                liquidity.repay(settle_amount)?;
                Ok(())
            }
            _ => {
                msg!(
                    "Expected a liquidity at index {}, aborting",
                    liquidity_index
                );
                Err(ProgramError::InvalidArgument)
            }
        }
    }

    /// Calculate the maximum liquidity value that can be borrowed by
    /// subtracting allowed borrow value from actual borrow value.
    pub fn remaining_borrow_value(&self) -> Decimal {
        self.allowed_borrow_value
            .to_dec()
            .try_sub(self.borrowed_value.to_dec())
            .unwrap_or_else(|_| Decimal::zero())
    }
}

impl Default for ObligationLiquidity {
    fn default() -> Self {
        Self::new(Pubkey::default())
    }
}

impl ObligationLiquidity {
    pub fn new(borrow_reserve: Pubkey) -> Self {
        Self {
            borrow_reserve,
            market_value: Decimal::zero().into(),
            borrowed_amount: Decimal::zero().into(),
            cumulative_borrow_rate: Decimal::one().into(),
        }
    }

    /// ref. eq. (6)
    pub fn accrue_interest(
        &mut self,
        cumulative_borrow_rate: Decimal,
    ) -> Result<()> {
        let prev_cumulative_borrow_rate: Decimal =
            self.cumulative_borrow_rate.into();
        match cumulative_borrow_rate.cmp(&prev_cumulative_borrow_rate) {
            Ordering::Less => {
                msg!("Interest rate cannot be negative");
                return Err(ErrorCode::NegativeInterestRate.into());
            }
            Ordering::Equal => {}
            Ordering::Greater => {
                let compounded_interest_rate: Decimal = cumulative_borrow_rate
                    .try_div(prev_cumulative_borrow_rate)?;

                self.borrowed_amount = self
                    .borrowed_amount
                    .to_dec()
                    .try_mul(compounded_interest_rate)?
                    .into();
                self.cumulative_borrow_rate = cumulative_borrow_rate.into();
            }
        }

        Ok(())
    }

    /// Calculate the maximum liquidation amount for a given liquidity.
    ///
    /// ref. eq. (8)
    pub fn max_liquidation_amount(
        &self,
        obligation_borrowed_value: Decimal,
    ) -> Result<Decimal> {
        let max_liquidation_value = obligation_borrowed_value
            .try_mul(Decimal::from_percent(consts::LIQUIDATION_CLOSE_FACTOR))?
            .min(self.market_value.to_dec());
        let max_liquidation_pct =
            max_liquidation_value.try_div(self.market_value.to_dec())?;
        self.borrowed_amount.to_dec().try_mul(max_liquidation_pct)
    }

    fn repay(&mut self, settle_amount: Decimal) -> Result<()> {
        self.borrowed_amount =
            self.borrowed_amount.to_dec().try_sub(settle_amount)?.into();

        Ok(())
    }

    fn borrow(&mut self, borrow_amount: Decimal) -> Result<()> {
        self.borrowed_amount =
            self.borrowed_amount.to_dec().try_add(borrow_amount)?.into();

        Ok(())
    }
}

impl ObligationCollateral {
    pub fn new(deposit_reserve: Pubkey) -> Self {
        Self {
            deposit_reserve,
            market_value: Decimal::zero().into(),
            deposited_amount: 0,
        }
    }

    fn deposit(&mut self, collateral_amount: u64) -> Result<()> {
        self.deposited_amount = self
            .deposited_amount
            .checked_add(collateral_amount)
            .ok_or(ErrorCode::MathOverflow)?;

        Ok(())
    }

    fn withdraw(&mut self, collateral_amount: u64) -> Result<()> {
        self.deposited_amount = self
            .deposited_amount
            .checked_sub(collateral_amount)
            .ok_or(ErrorCode::MathOverflow)?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;

    const MAX_COMPOUNDED_INTEREST: u64 = 100; // 10,000%

    #[test]
    fn it_has_stable_owner_offset() {
        assert_eq!(offset_of!(Obligation, owner), 48);
    }

    #[test]
    fn it_fails_if_wrong_input_to_accrue_interest() {
        assert!(ObligationLiquidity {
            cumulative_borrow_rate: Decimal::zero().into(),
            ..Default::default()
        }
        .accrue_interest(Decimal::one())
        .is_err());

        assert!(ObligationLiquidity {
            cumulative_borrow_rate: Decimal::from(2u64).into(),
            ..Default::default()
        }
        .accrue_interest(Decimal::one())
        .is_err());

        assert!(ObligationLiquidity {
            cumulative_borrow_rate: Decimal::one().into(),
            borrowed_amount: Decimal::from(u64::MAX).into(),
            ..Default::default()
        }
        .accrue_interest(Decimal::from(10 * MAX_COMPOUNDED_INTEREST))
        .is_err());
    }

    #[test]
    fn it_defaults_to_obligation_reserve() {
        assert_eq!(ObligationReserve::default(), ObligationReserve::Empty);
        let obligation = Obligation::default();
        obligation
            .reserves
            .iter()
            .for_each(|r| assert_eq!(r, &ObligationReserve::Empty));

        assert!(!obligation.has_borrows());
        assert!(!obligation.has_deposits());
        assert!(obligation.is_deposited_value_zero());
        assert!(obligation.is_borrowed_value_zero());
        assert!(obligation.max_withdraw_value().is_err());
    }

    #[test]
    fn it_deposits_collateral() {
        let reserve1 = Pubkey::new_unique();
        let reserve2 = Pubkey::new_unique();
        let mut obligation = Obligation::default();

        obligation.deposit(reserve1, 50).unwrap();
        assert_eq!(
            obligation.reserves[0],
            ObligationReserve::Collateral {
                inner: ObligationCollateral {
                    deposited_amount: 50,
                    deposit_reserve: reserve1,
                    ..Default::default()
                }
            }
        );

        obligation.deposit(reserve2, 30).unwrap();
        assert_eq!(
            obligation.reserves[1],
            ObligationReserve::Collateral {
                inner: ObligationCollateral {
                    deposited_amount: 30,
                    deposit_reserve: reserve2,
                    ..Default::default()
                }
            }
        );

        obligation.deposit(reserve1, 50).unwrap();
        assert_eq!(
            obligation.reserves[0],
            ObligationReserve::Collateral {
                inner: ObligationCollateral {
                    deposited_amount: 100,
                    deposit_reserve: reserve1,
                    ..Default::default()
                }
            }
        );

        assert!(obligation.get_liquidity(reserve1).is_err());
        assert!(obligation.get_liquidity(reserve2).is_err());
        assert_eq!(
            obligation.get_collateral(reserve1).unwrap(),
            (
                0,
                &ObligationCollateral {
                    deposit_reserve: reserve1,
                    deposited_amount: 100,
                    ..Default::default()
                }
            )
        );
        assert_eq!(
            obligation.get_collateral(reserve2).unwrap(),
            (
                1,
                &ObligationCollateral {
                    deposit_reserve: reserve2,
                    deposited_amount: 30,
                    ..Default::default()
                }
            )
        );
    }

    #[test]
    fn it_withdraws_collateral() {
        let reserve1 = Pubkey::new_unique();
        let reserve2 = Pubkey::new_unique();
        let mut obligation = Obligation::default();

        obligation.deposit(reserve1, 10).unwrap();
        obligation.deposit(reserve2, 10).unwrap();

        obligation.withdraw(5, 0).unwrap();
        assert_eq!(
            obligation.reserves[0],
            ObligationReserve::Collateral {
                inner: ObligationCollateral {
                    deposited_amount: 5,
                    deposit_reserve: reserve1,
                    ..Default::default()
                }
            }
        );
        assert_eq!(
            obligation.reserves[1],
            ObligationReserve::Collateral {
                inner: ObligationCollateral {
                    deposited_amount: 10,
                    deposit_reserve: reserve2,
                    ..Default::default()
                }
            }
        );

        assert!(obligation.withdraw(6, 0).is_err());
        obligation.withdraw(5, 0).unwrap();
        assert_eq!(obligation.reserves[0], ObligationReserve::Empty);
        assert_eq!(
            obligation.reserves[1],
            ObligationReserve::Collateral {
                inner: ObligationCollateral {
                    deposited_amount: 10,
                    deposit_reserve: reserve2,
                    ..Default::default()
                }
            }
        );

        obligation.withdraw(10, 1).unwrap();
        obligation
            .reserves
            .iter()
            .for_each(|r| assert_eq!(r, &ObligationReserve::Empty));
    }

    #[test]
    fn it_borrows_liquidity() {
        let reserve1 = Pubkey::new_unique();
        let reserve2 = Pubkey::new_unique();
        let mut obligation = Obligation::default();

        obligation.borrow(reserve1, 50u64.into()).unwrap();
        assert_eq!(
            obligation.reserves[0],
            ObligationReserve::Liquidity {
                inner: ObligationLiquidity {
                    borrowed_amount: 50.into(),
                    borrow_reserve: reserve1,
                    ..Default::default()
                }
            }
        );

        obligation.borrow(reserve2, 30u64.into()).unwrap();
        assert_eq!(
            obligation.reserves[1],
            ObligationReserve::Liquidity {
                inner: ObligationLiquidity {
                    borrowed_amount: 30.into(),
                    borrow_reserve: reserve2,
                    ..Default::default()
                }
            }
        );

        obligation.borrow(reserve1, 50u64.into()).unwrap();
        assert_eq!(
            obligation.reserves[0],
            ObligationReserve::Liquidity {
                inner: ObligationLiquidity {
                    borrowed_amount: 100.into(),
                    borrow_reserve: reserve1,
                    ..Default::default()
                }
            }
        );

        assert!(obligation.get_collateral(reserve1).is_err());
        assert!(obligation.get_collateral(reserve2).is_err());
        assert_eq!(
            obligation.get_liquidity(reserve1).unwrap(),
            (
                0,
                &ObligationLiquidity {
                    borrow_reserve: reserve1,
                    borrowed_amount: 100.into(),
                    ..Default::default()
                }
            )
        );
        assert_eq!(
            obligation.get_liquidity(reserve2).unwrap(),
            (
                1,
                &ObligationLiquidity {
                    borrow_reserve: reserve2,
                    borrowed_amount: 30.into(),
                    ..Default::default()
                }
            )
        );
    }

    #[test]
    fn it_returns_obligation_as_stale() {
        let mut obligation = Obligation::default();

        let mut clock = Clock::default();
        clock.slot = 10;

        obligation.last_update.update_slot(10);
        assert!(!obligation.is_stale(&clock));

        obligation.last_update.update_slot(9);
        assert!(obligation.is_stale(&clock));

        obligation.last_update.update_slot(11);
        assert!(obligation.is_stale(&clock)); // overflow
    }

    #[test]
    fn it_fails_to_withdraw_liquidity_or_repay_collateral() {
        let mut obligation = Obligation::default();
        obligation.deposit(Pubkey::new_unique(), 10).unwrap();
        obligation
            .borrow(Pubkey::new_unique(), 10u64.into())
            .unwrap();

        assert!(obligation.withdraw(10, 1).is_err());
        assert!(obligation.withdraw(10, 0).is_ok());

        assert!(obligation.repay(10u64.into(), 0).is_err());
        assert!(obligation.repay(10u64.into(), 1).is_ok());
    }

    #[test]
    fn it_decides_whether_healthy() {
        let mut obligation = Obligation::default();

        obligation.borrowed_value = Decimal::one().into();
        obligation.unhealthy_borrow_value = Decimal::zero().into();
        assert!(!obligation.is_healthy());

        obligation.borrowed_value = Decimal::zero().into();
        obligation.unhealthy_borrow_value = Decimal::one().into();
        assert!(obligation.is_healthy());
    }

    #[test]
    fn it_cannot_deposit_nor_borrow_11th_reserve() {
        let mut obligation = Obligation::default();
        obligation.reserves = [ObligationReserve::Collateral {
            inner: ObligationCollateral::default(),
        }; consts::MAX_OBLIGATION_RESERVES];

        assert!(obligation.deposit(Pubkey::new_unique(), 10).is_err());
        assert!(obligation
            .borrow(Pubkey::new_unique(), 10u64.into())
            .is_err());
    }

    #[test]
    fn it_calculates_remaining_borrow_value() {
        let mut obligation = Obligation::default();

        obligation.allowed_borrow_value =
            Decimal::one().try_mul(Decimal::from(2u64)).unwrap().into();
        obligation.borrowed_value = Decimal::one().into();
        assert_eq!(obligation.remaining_borrow_value(), Decimal::one());

        obligation.allowed_borrow_value = Decimal::one().into();
        obligation.borrowed_value =
            Decimal::one().try_mul(Decimal::from(2u64)).unwrap().into();
        assert_eq!(obligation.remaining_borrow_value(), Decimal::zero());
    }

    // Creates rates (r1, r2) where 0 < r1 <= r2 <= 100*r1
    prop_compose! {
        fn cumulative_rates()(rate in 1..=u128::MAX)(
            current_rate in Just(rate),
            max_new_rate in rate..=rate.saturating_mul(MAX_COMPOUNDED_INTEREST as u128),
        ) -> (u128, u128) {
            (current_rate, max_new_rate)
        }
    }

    const MAX_BORROWED: u128 = u64::MAX as u128 * consts::WAD as u128;

    // Creates liquidity amounts (repay, borrow) where repay < borrow
    prop_compose! {
        fn repay_partial_amounts()(amount in 1..=u64::MAX)(
            repay_amount in Just(consts::WAD as u128 * amount as u128),
            borrowed_amount in (consts::WAD as u128 * amount as u128 + 1)..=MAX_BORROWED,
        ) -> (u128, u128) {
            (repay_amount, borrowed_amount)
        }
    }

    // Creates liquidity amounts (repay, borrow) where repay >= borrow
    prop_compose! {
        fn repay_full_amounts()(amount in 1..=u64::MAX)(
            repay_amount in Just(consts::WAD as u128 * amount as u128),
        ) -> (u128, u128) {
            (repay_amount, repay_amount)
        }
    }

    proptest! {
        #[test]
        fn repay_partial(
            (repay_amount, borrowed_amount) in repay_partial_amounts(),
        ) {
            let borrowed =
                Decimal::from_scaled_val(borrowed_amount);
            let repay_amount_wads = Decimal::from_scaled_val(repay_amount);
            let mut obligation = Obligation::default();
            obligation.reserves[0] = ObligationReserve::Liquidity {
                inner: ObligationLiquidity {
                    borrowed_amount: borrowed.into(),
                    ..Default::default()
                }
            };

            obligation.repay(repay_amount_wads, 0)?;
            assert!(
                matches!(
                    obligation.reserves[0],
                    ObligationReserve::Liquidity {
                        inner: ObligationLiquidity {
                            borrowed_amount,
                            ..
                        }
                    }
                    if borrowed > borrowed_amount.into()
                        && Decimal::zero() < borrowed_amount.into()
                )
            );
        }

        #[test]
        fn repay_full(
            (repay_amount, borrowed_amount) in repay_full_amounts(),
        ) {
            let borrowed = Decimal::from_scaled_val(borrowed_amount);
            let repay_amount = Decimal::from_scaled_val(repay_amount);
            let mut obligation = Obligation::default();
            obligation.reserves[0] = ObligationReserve::Liquidity {
                inner: ObligationLiquidity {
                    borrowed_amount: borrowed.into(),
                    ..Default::default()
                }
            };

            obligation.repay(repay_amount, 0)?;
            assert_eq!(obligation.reserves[0], ObligationReserve::Empty);
        }

        #[test]
        fn accrue_interest(
            (current_borrow_rate, new_borrow_rate) in cumulative_rates(),
            borrowed_amount in 0..=u64::MAX,
        ) {
            let cumulative_borrow_rate = Decimal::one()
                .try_add(Decimal::from_scaled_val(current_borrow_rate))?;
            let borrowed = Decimal::from(borrowed_amount);
            let mut liquidity = ObligationLiquidity {
                cumulative_borrow_rate: cumulative_borrow_rate.into(),
                borrowed_amount: borrowed.into(),
                ..Default::default()
            };

            let next_cumulative_borrow_rate = Decimal::one()
                .try_add(Decimal::from_scaled_val(new_borrow_rate))?;
            liquidity.accrue_interest(next_cumulative_borrow_rate)?;

            if next_cumulative_borrow_rate > cumulative_borrow_rate {
                assert!(borrowed < liquidity.borrowed_amount.into());
            } else {
                assert!(borrowed == liquidity.borrowed_amount.into());
            }
        }
    }
}
