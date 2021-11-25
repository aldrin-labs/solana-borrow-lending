use crate::prelude::*;
use std::cmp::Ordering;

#[account]
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

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq)]
pub struct ObligationCollateral {
    pub deposit_reserve: Pubkey,
    pub deposited_amount: u64,
    pub market_value: SDecimal,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq)]
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
