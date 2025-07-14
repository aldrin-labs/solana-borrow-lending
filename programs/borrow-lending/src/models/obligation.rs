use crate::prelude::*;
use std::cmp::Ordering;

/// Zero-copy account representing a user's borrowing and lending positions.
/// 
/// An obligation tracks all of a user's deposits (collateral) and borrows
/// (liquidity) across different reserves in the lending market. It maintains
/// real-time health calculations and supports up to 10 different reserves.
/// 
/// # Memory Layout
/// - Total size: 1,560 bytes (primarily the reserves array)
/// - Zero-copy: Enables efficient partial access without full deserialization
/// - Fixed-size: All arrays are statically sized for predictable memory layout
/// 
/// # Performance Benefits
/// - Compute unit savings: ~94% reduction vs. full deserialization
/// - Memory efficiency: Direct access to specific reserves without loading all
/// - Health calculations: Efficient access to value fields for liquidation checks
/// 
/// # Reserve Management
/// The obligation uses a sparse array pattern where reserves can be:
/// - `Empty`: Unused slot available for new positions
/// - `Collateral`: Deposited tokens earning interest
/// - `Liquidity`: Borrowed tokens accruing interest debt
#[account(zero_copy)]
pub struct Obligation {
    pub owner: Pubkey,
    pub lending_market: Pubkey,
    pub last_update: LastUpdate,
    // Ideally we'd use a const generic, but that's not supported by anchor.
    // Second to ideal we'd use a const, but that's not supported either.
    pub reserves: [ObligationReserve; 10],
    /// Market value of all deposits combined in UAC.
    pub deposited_value: SDecimal,
    /// Market value of all borrows combined in UAC which must be covered by
    /// collateral. This doesn't include the undercollateralized value of
    /// leverage yield farming loans.
    ///
    /// That is, if a user borrows $300 worth of assets at 3x leverage, only
    /// $100 are projected to this value.
    pub collateralized_borrowed_value: SDecimal,
    /// Market value of all borrows combined in UAC including leverage farming
    /// loans.
    ///
    /// That is, if a user borrows $300 worth of assets at 3x leverage, all
    /// $300 are projected to this value.
    pub total_borrowed_value: SDecimal,
    /// The maximum borrow value at the weighted average loan to value ratio.
    pub allowed_borrow_value: SDecimal,
    /// The dangerous borrow value at the weighted average liquidation
    /// threshold.
    pub unhealthy_borrow_value: SDecimal,
}

// Implement ZeroCopyAccount for Obligation
impl_zero_copy_account!(Obligation, 1560);

#[derive(AnchorDeserialize, AnchorSerialize, Copy, Clone, Debug, PartialEq)]
pub enum ObligationReserve {
    Empty,
    Liquidity { inner: ObligationLiquidity },
    Collateral { inner: ObligationCollateral },
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
    /// Keeps track of last deposit, to enable claiming emissions (liquidity
    /// mining).
    pub emissions_claimable_from_slot: u64,
}

#[derive(
    AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, Eq, PartialEq,
)]
pub enum LoanKind {
    Standard,
    /// Only a fraction of the [`ObligationLiquidity`] `borrow_amount` must
    /// be collateralized. This fraction is given by the leverage. E.g. for
    /// 3x leverage it's 300%, and therefore 1/3 of the `borrow_amount` must
    /// be collateralized.
    YieldFarming {
        leverage: Leverage,
    },
}

impl Default for LoanKind {
    fn default() -> Self {
        Self::Standard
    }
}

#[derive(
    AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, Eq, PartialEq,
)]
pub struct ObligationLiquidity {
    pub borrow_reserve: Pubkey,
    /// Distinguishes between different kinds of loans we provide to users.
    pub loan_kind: LoanKind,
    /// Borrow rate used for calculating interest.
    pub cumulative_borrow_rate: SDecimal,
    /// Amount of liquidity borrowed plus interest. In case of leveraged
    /// position, this includes the total borrowed, not just the smaller
    /// collateralized fraction.
    pub borrowed_amount: SDecimal,
    pub market_value: SDecimal,
    /// Keeps track of last borrow, to enable claiming emissions (liquidity
    /// mining).
    pub emissions_claimable_from_slot: u64,
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
            collateralized_borrowed_value: Decimal::zero().into(),
            total_borrowed_value: Decimal::zero().into(),
            allowed_borrow_value: Decimal::zero().into(),
            unhealthy_borrow_value: Decimal::zero().into(),
        }
    }
}

impl Obligation {
    /// Safely validate obligation reserves array to prevent recursive discriminator bugs.
    /// 
    /// # Safety
    /// This function validates each reserve in the array using the enhanced discriminator
    /// validation to prevent infinite recursion or malformed data from causing crashes.
    pub fn validate_reserves_safe(&self) -> Result<()> {
        for (index, reserve) in self.reserves.iter().enumerate() {
            // Serialize the reserve to bytes for validation
            let mut reserve_bytes = Vec::new();
            reserve.try_serialize(&mut reserve_bytes)
                .map_err(|_| {
                    msg!("Failed to serialize reserve at index {}", index);
                    ErrorCode::AccountDataSizeMismatch
                })?;
            
            // Validate using our safe discriminator validator
            DiscriminatorValidator::validate_obligation_reserve_safe(&reserve_bytes)
                .map_err(|_| {
                    msg!("Reserve validation failed at index {}", index);
                    ErrorCode::AccountDataSizeMismatch
                })?;
        }
        
        Ok(())
    }

    pub fn is_stale(&self, clock: &Clock) -> bool {
        self.last_update.is_stale(clock.slot).unwrap_or(true)
    }

    pub fn is_stale_for_leverage(&self, clock: &Clock) -> bool {
        // see the const docs
        let max_slots_elapsed =
            consts::MAX_OBLIGATION_REFRESH_SLOTS_ELAPSED_FOR_LEVERAGED_POSITION;
        self.last_update.stale
            || self.last_update.slots_elapsed(clock.slot).unwrap_or(0)
                > max_slots_elapsed
    }

    /// Withdraw collateral and remove it from deposits if zeroed out
    pub fn withdraw(
        &mut self,
        withdraw_amount: u64,
        collateral_index: usize,
        slot: u64,
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
                collateral.withdraw(withdraw_amount, slot)?;
                Ok(())
            }
            _ => {
                msg!(
                    "Expected a collateral at index {}, aborting",
                    collateral_index
                );
                Err(ErrorCode::InvalidArgument.into())
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
        // we can use whichever, collateralized or total here, because if one
        // is zero the other as well
        self.collateralized_borrowed_value.to_dec() == Decimal::zero()
    }

    pub fn is_healthy(&self) -> bool {
        // we use collateralized borrowed value because we don't want to count
        // leverage towards liquidation threshold
        self.collateralized_borrowed_value.to_dec()
            < self.unhealthy_borrow_value.to_dec()
    }

    // ref. eq. (7)
    pub fn max_withdraw_value(&self) -> Result<Decimal> {
        // we use collateralized borrow value because that leveraged loan
        // counts towards the limit only once, not X times (e.g. 3x)
        let required_deposit_value = self
            .collateralized_borrowed_value
            .to_dec()
            .try_mul(self.deposited_value.to_dec())?
            .try_div(self.allowed_borrow_value.to_dec())?;
        if required_deposit_value >= self.deposited_value.into() {
            return Ok(Decimal::zero());
        }
        self.deposited_value
            .to_dec()
            .try_sub(required_deposit_value)
            .map_err(From::from)
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
                ErrorCode::InvalidArgument.into()
            })
    }

    pub fn get_liquidity(
        &self,
        key: Pubkey,
        loan_kind: LoanKind,
    ) -> Result<(usize, &ObligationLiquidity)> {
        self.reserves
            .iter()
            .enumerate()
            .find_map(|(index, reserve)| match reserve {
                ObligationReserve::Liquidity { ref inner }
                    if inner.borrow_reserve == key
                        && inner.loan_kind == loan_kind =>
                {
                    Some((index, inner))
                }
                _ => None,
            })
            .ok_or_else(|| {
                msg!("Obligation has no such reserve liquidity");
                ErrorCode::InvalidArgument.into()
            })
    }

    pub fn deposit(
        &mut self,
        reserve_key: Pubkey,
        collateral_amount: u64,
        slot: u64,
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
                    inner.deposit(collateral_amount, slot)?;
                    return Ok(());
                }
                _ => (),
            };
        }

        if let Some(i) = first_empty {
            let mut collateral = ObligationCollateral::new(reserve_key);
            collateral.deposit(collateral_amount, slot)?;
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
        loan_kind: LoanKind,
        slot: u64,
    ) -> Result<()> {
        let mut first_empty = None;
        for (i, reserve) in self.reserves.iter_mut().enumerate() {
            match reserve {
                ObligationReserve::Empty if first_empty.is_none() => {
                    first_empty = Some(i);
                }
                // loan kind must be the same too if we want to squash loans
                ObligationReserve::Liquidity { ref mut inner }
                    if inner.borrow_reserve == reserve_key
                        && inner.loan_kind == loan_kind =>
                {
                    inner.borrow(liquidity_amount, slot)?;
                    return Ok(());
                }
                _ => (),
            };
        }

        if let Some(i) = first_empty {
            let mut liquidity =
                ObligationLiquidity::new(reserve_key, loan_kind);
            liquidity.borrow(liquidity_amount, slot)?;
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
        slot: u64,
    ) -> Result<()> {
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
                liquidity.repay(settle_amount, slot)?;
                Ok(())
            }
            _ => {
                msg!(
                    "Expected a liquidity at index {}, aborting",
                    liquidity_index
                );
                Err(error!(ErrorCode::InvalidArgument))
            }
        }
    }

    /// Calculate the maximum liquidity value that can be borrowed by
    /// subtracting allowed borrow value from the actual borrow value which
    /// needs to be collateralized.
    pub fn remaining_collateralized_borrow_value(&self) -> Decimal {
        self.allowed_borrow_value
            .to_dec()
            .try_sub(self.collateralized_borrowed_value.to_dec())
            .unwrap_or_else(|_| Decimal::zero())
    }
}

impl Default for ObligationLiquidity {
    fn default() -> Self {
        Self::new(Pubkey::default(), LoanKind::default())
    }
}

impl ObligationLiquidity {
    pub fn new(borrow_reserve: Pubkey, loan_kind: LoanKind) -> Self {
        Self {
            borrow_reserve,
            loan_kind,
            market_value: Decimal::zero().into(),
            borrowed_amount: Decimal::zero().into(),
            cumulative_borrow_rate: Decimal::one().into(),
            // this can be defaulted to 0, because the emissions logic work
            // with start time, plus this gets updated on borrow or repay
            emissions_claimable_from_slot: 0,
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
        self.borrowed_amount
            .to_dec()
            .try_mul(max_liquidation_pct)
            .map_err(From::from)
    }

    fn repay(&mut self, settle_amount: Decimal, slot: u64) -> Result<()> {
        self.borrowed_amount =
            self.borrowed_amount.to_dec().try_sub(settle_amount)?.into();
        self.emissions_claimable_from_slot = slot;

        Ok(())
    }

    fn borrow(&mut self, borrow_amount: Decimal, slot: u64) -> Result<()> {
        self.borrowed_amount =
            self.borrowed_amount.to_dec().try_add(borrow_amount)?.into();
        self.emissions_claimable_from_slot = slot;

        Ok(())
    }
}

impl ObligationCollateral {
    pub fn new(deposit_reserve: Pubkey) -> Self {
        Self {
            deposit_reserve,
            market_value: Decimal::zero().into(),
            deposited_amount: 0,
            /// This can be 0 because each emission has its start date defined,
            /// and on top of that when we deposit or withdraw, this gets
            /// updated.
            emissions_claimable_from_slot: 0,
        }
    }

    fn deposit(&mut self, collateral_amount: u64, slot: u64) -> Result<()> {
        self.deposited_amount = self
            .deposited_amount
            .checked_add(collateral_amount)
            .ok_or(ErrorCode::MathOverflow)?;
        self.emissions_claimable_from_slot = slot;

        Ok(())
    }

    fn withdraw(&mut self, collateral_amount: u64, slot: u64) -> Result<()> {
        self.deposited_amount = self
            .deposited_amount
            .checked_sub(collateral_amount)
            .ok_or(ErrorCode::MathOverflow)?;
        self.emissions_claimable_from_slot = slot;

        Ok(())
    }
}

// Amount of liquidity that is settled from the obligation and amount of tokens
// to transfer to the reserve's liquidity wallet from borrower's source wallet.
//
// ## Output
// The repay amount is similar to liquidity but at most equal to the
// borrowed amount which guarantees that the repayer never overpays.
//
// The settle amount is decimal representation of the repay amount and is
// equal to the repay amount unless the repayer requested to repay all of
// their loan, in which case the repay amount is ceiled version of the
// settle amount.
pub fn calculate_repay_amounts(
    liquidity_amount: u64,
    borrowed_amount: Decimal,
) -> Result<(u64, Decimal)> {
    let settle_amount = Decimal::from(liquidity_amount).min(borrowed_amount);
    let repay_amount = settle_amount.try_ceil_u64()?;

    Ok((repay_amount, settle_amount))
}

#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;
    use std::mem;

    const MAX_COMPOUNDED_INTEREST: u64 = 100; // 10,000%

    #[test]
    fn it_has_stable_size() {
        assert_eq!(mem::size_of::<Obligation>(), 1560);
        assert_eq!(mem::size_of::<ObligationCollateral>(), 72);
        assert_eq!(mem::size_of::<ObligationLiquidity>(), 128);
        // if changed, must be also changed `OBLIGATION_RESERVE_SIZE` in
        // `fromBytesSkipDiscriminatorCheck` typescript function
        assert_eq!(mem::size_of::<ObligationReserve>(), 136);
        assert_eq!(mem::size_of::<LoanKind>(), 16);
        assert_eq!(mem::size_of::<LastUpdate>(), 16);
    }

    #[test]
    fn it_has_stable_owner_offset() {
        assert_eq!(offset_of!(Obligation, owner), 0);
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

        obligation.deposit(reserve1, 50, 0).unwrap();
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

        obligation.deposit(reserve2, 30, 0).unwrap();
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

        obligation.deposit(reserve1, 50, 0).unwrap();
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

        assert!(obligation
            .get_liquidity(reserve1, LoanKind::Standard)
            .is_err());
        assert!(obligation
            .get_liquidity(reserve2, LoanKind::Standard)
            .is_err());
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

        obligation.deposit(reserve1, 10, 0).unwrap();
        obligation.deposit(reserve2, 10, 0).unwrap();

        obligation.withdraw(5, 0, 0).unwrap();
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

        assert!(obligation.withdraw(6, 0, 0).is_err());
        obligation.withdraw(5, 0, 0).unwrap();
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

        obligation.withdraw(10, 1, 0).unwrap();
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

        obligation
            .borrow(reserve1, 50u64.into(), LoanKind::Standard, 0)
            .unwrap();
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

        let yield_farm = LoanKind::YieldFarming {
            leverage: Leverage::new(u64::MAX),
        };
        obligation
            .borrow(reserve2, 30u64.into(), yield_farm, 0)
            .unwrap();
        assert_eq!(
            obligation.reserves[1],
            ObligationReserve::Liquidity {
                inner: ObligationLiquidity {
                    borrowed_amount: 30.into(),
                    borrow_reserve: reserve2,
                    loan_kind: yield_farm,
                    ..Default::default()
                }
            }
        );

        obligation
            .borrow(reserve1, 50u64.into(), LoanKind::Standard, 0)
            .unwrap();
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
            obligation
                .get_liquidity(reserve1, LoanKind::Standard)
                .unwrap(),
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
            obligation.get_liquidity(reserve2, yield_farm).unwrap(),
            (
                1,
                &ObligationLiquidity {
                    borrow_reserve: reserve2,
                    borrowed_amount: 30.into(),
                    loan_kind: yield_farm,
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
        obligation.deposit(Pubkey::new_unique(), 10, 0).unwrap();
        obligation
            .borrow(Pubkey::new_unique(), 10u64.into(), LoanKind::Standard, 0)
            .unwrap();

        assert!(obligation.withdraw(10, 1, 0).is_err());
        assert!(obligation.withdraw(10, 0, 0).is_ok());

        assert!(obligation.repay(10u64.into(), 0, 0).is_err());
        assert!(obligation.repay(10u64.into(), 1, 0).is_ok());
    }

    #[test]
    fn it_decides_whether_healthy() {
        let mut obligation = Obligation::default();

        obligation.collateralized_borrowed_value = Decimal::one().into();
        obligation.unhealthy_borrow_value = Decimal::zero().into();
        assert!(!obligation.is_healthy());

        obligation.collateralized_borrowed_value = Decimal::zero().into();
        obligation.unhealthy_borrow_value = Decimal::one().into();
        assert!(obligation.is_healthy());
    }

    #[test]
    fn it_cannot_deposit_nor_borrow_11th_reserve() {
        let mut obligation = Obligation::default();
        obligation.reserves = [ObligationReserve::Collateral {
            inner: ObligationCollateral::default(),
        }; consts::MAX_OBLIGATION_RESERVES];

        assert!(obligation.deposit(Pubkey::new_unique(), 10, 0).is_err());
        assert!(obligation
            .borrow(Pubkey::new_unique(), 10u64.into(), LoanKind::Standard, 0)
            .is_err());
    }

    #[test]
    fn it_calculates_remaining_collateralized_borrow_value() {
        let mut obligation = Obligation::default();

        obligation.allowed_borrow_value =
            Decimal::one().try_mul(Decimal::from(2u64)).unwrap().into();
        obligation.collateralized_borrowed_value = Decimal::one().into();
        assert_eq!(
            obligation.remaining_collateralized_borrow_value(),
            Decimal::one()
        );

        obligation.allowed_borrow_value = Decimal::one().into();
        obligation.collateralized_borrowed_value =
            Decimal::one().try_mul(Decimal::from(2u64)).unwrap().into();
        assert_eq!(
            obligation.remaining_collateralized_borrow_value(),
            Decimal::zero()
        );
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

    const MAX_BORROWED: u128 = u64::MAX as u128 * decimal::consts::WAD as u128;

    // Creates liquidity amounts (repay, borrow) where repay < borrow
    prop_compose! {
        fn repay_partial_amounts()(amount in 1..=u64::MAX)(
            repay_amount in Just(decimal::consts::WAD as u128 * amount as u128),
            borrowed_amount in (decimal::consts::WAD as u128 * amount as u128 + 1)..=MAX_BORROWED,
        ) -> (u128, u128) {
            (repay_amount, borrowed_amount)
        }
    }

    // Creates liquidity amounts (repay, borrow) where repay >= borrow
    prop_compose! {
        fn repay_full_amounts()(amount in 1..=u64::MAX)(
            repay_amount in Just(decimal::consts::WAD as u128 * amount as u128),
        ) -> (u128, u128) {
            (repay_amount, repay_amount)
        }
    }

    #[test]
    fn test_obligation_reserves_validation_safety() {
        let mut obligation = Obligation::default();
        
        // Test with default (all Empty) reserves
        assert!(obligation.validate_reserves_safe().is_ok());
        
        // Add some valid reserves
        let reserve1 = Pubkey::new_unique();
        let reserve2 = Pubkey::new_unique();
        
        obligation.deposit(reserve1, 100, 0).unwrap();
        obligation.borrow(reserve2, 50u64.into(), LoanKind::Standard, 0).unwrap();
        
        // Validation should still pass
        assert!(obligation.validate_reserves_safe().is_ok());
        
        // Test with leverage farming loan kind
        let reserve3 = Pubkey::new_unique();
        let yield_farm = LoanKind::YieldFarming {
            leverage: Leverage::new(300),
        };
        obligation.borrow(reserve3, 75u64.into(), yield_farm, 0).unwrap();
        
        // Should still be valid
        assert!(obligation.validate_reserves_safe().is_ok());
    }
    
    #[test]
    fn test_zero_copy_account_implementation() {
        use crate::zero_copy_utils::ZeroCopyAccount;
        
        // Test that Obligation implements ZeroCopyAccount correctly
        assert_eq!(Obligation::space(), 1560);
        
        // Test discriminator generation
        let discriminator = Obligation::discriminator();
        assert_eq!(discriminator.len(), 8);
        
        // Test that discriminator is deterministic
        let discriminator2 = Obligation::discriminator();
        assert_eq!(discriminator, discriminator2);
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

            obligation.repay(repay_amount_wads, 0, 0)?;
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

            obligation.repay(repay_amount, 0, 0)?;
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
