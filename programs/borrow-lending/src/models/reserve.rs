use crate::prelude::*;
use std::convert::{TryFrom, TryInto};

/// Lending market reserve account. It's associated a reserve token wallet
/// account where the tokens that borrowers will want to borrow and funders will
/// want to lent are.
#[account]
pub struct Reserve {
    pub lending_market: Pubkey,
    /// Last slot when rates were updated. Helps us ensure that we're working
    /// with fresh prices.
    pub last_update: LastUpdate,
    pub liquidity: ReserveLiquidity,
    pub collateral: ReserveCollateral,
    pub config: ReserveConfig,
}

#[derive(
    AnchorSerialize, AnchorDeserialize, Clone, Debug, Default, PartialEq,
)]
pub struct ReserveConfig {
    ///  TODO
    pub optimal_utilization_rate: PercentageInt,
    /// Target ratio of the value of borrows to deposits. TODO
    ///
    /// Set to 0 to disable use as a collateral.
    pub loan_to_value_ratio: PercentageInt,
    /// Bonus a liquidator gets when repaying part of an unhealthy obligation.
    pub liquidation_bonus: PercentageInt,
    /// Loan to value ratio at which an obligation can be liquidated. For
    /// example, if the loan is worth more than 1.2x collateral, then
    /// proceed with liquidation. In such case this value would be 20.
    pub liquidation_threshold: PercentageInt,
    /// Min borrow APY TODO
    pub min_borrow_rate: u8,
    /// Optimal (utilization) borrow APY TODO
    pub optimal_borrow_rate: u8,
    /// Max borrow APY TODO
    pub max_borrow_rate: u8,
    /// Program owner fees separate from gains due to interest accrual.
    pub fees: ReserveFees,
}

/// Unvalidated config wrapper type. Use [`InputReserveConfig::validate`] to
/// access the inner value.
#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InputReserveConfig {
    conf: ReserveConfig,
}

/// Additional fee information on a reserve.
///
/// These exist separately from interest accrual fees, and are specifically for
/// the program owner and frontend host. The fees are paid out as a percentage
/// of liquidity token amounts during repayments and liquidations.
#[derive(
    AnchorSerialize, AnchorDeserialize, Clone, Debug, Default, PartialEq,
)]
pub struct ReserveFees {
    /// Fee assessed on [`crate::endpoints::BorrowObligationLiquidity`],
    /// expressed as a Wad. Must be between 0 and 10^18, such that 10^18 =
    /// 1.
    ///
    /// # Examples
    /// 1% = 10_000_000_000_000_000
    /// 0.01% (1 basis point) = 100_000_000_000_000
    /// 0.00001% (Aave borrow fee) = 100_000_000_000
    pub borrow_fee: SDecimal,
    /// Fee for flash loan, expressed as a Wad.
    /// 0.3% (Aave flash loan fee) = 3_000_000_000_000_000
    pub flash_loan_fee: SDecimal,
    /// Amount of fee going to host account, if provided in liquidate and repay
    pub host_fee: PercentageInt,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq)]
pub struct ReserveLiquidity {
    pub mint: Pubkey,
    pub mint_decimals: u8,
    pub supply: Pubkey,
    pub fee_receiver: Pubkey,
    pub oracle: Pubkey,
    pub available_amount: u64,
    /// How much liquidity (with precision on 18 digit) is currently borrowed.
    /// The total liquidity supply is `borrowed_amount` + `available_amount`.
    pub borrowed_amount: SDecimal,
    /// TODO: explain how this works
    pub cumulative_borrow_rate: SDecimal,
    /// Reserve liquidity market price in universal asset currency
    pub market_price: SDecimal,
}

impl Default for ReserveLiquidity {
    fn default() -> Self {
        // implemented by hand to avoid call stack limit in recursive
        // [`Default`] calls
        Self {
            available_amount: 0,
            borrowed_amount: Decimal::zero().into(),
            cumulative_borrow_rate: Decimal::one().into(),
            mint: Pubkey::default(),
            mint_decimals: 0,
            supply: Pubkey::default(),
            fee_receiver: Pubkey::default(),
            oracle: Pubkey::default(),
            market_price: Decimal::zero().into(),
        }
    }
}

#[derive(
    AnchorSerialize, AnchorDeserialize, Clone, Debug, Default, PartialEq,
)]
pub struct ReserveCollateral {
    pub mint: Pubkey,
    /// Used for exchange rate calculation. Copy of the value from the
    /// [`anchor_spl::token::Mint`] which allows us to avoid including
    /// that account in some transactions to save space.
    pub mint_total_supply: u64,
    pub supply: Pubkey,
}

#[derive(Clone, Copy, Debug)]
pub struct CollateralExchangeRate(Rate);

impl Validate for ReserveConfig {
    fn validate(&self) -> Result<()> {
        if *self.optimal_utilization_rate > 100 {
            msg!("Optimal utilization rate must be in range [0, 100]");
            return Err(ErrorCode::InvalidConfig.into());
        }
        if *self.loan_to_value_ratio >= 100 {
            msg!("Loan to value ratio must be in range [0, 100)");
            return Err(ErrorCode::InvalidConfig.into());
        }
        if *self.liquidation_bonus > 100 {
            msg!("Liquidation bonus must be in range [0, 100]");
            return Err(ErrorCode::InvalidConfig.into());
        }
        if *self.liquidation_threshold <= *self.loan_to_value_ratio
            || *self.liquidation_threshold > 100
        {
            msg!("Liquidation threshold must be in range (LTV, 100]");
            return Err(ErrorCode::InvalidConfig.into());
        }
        if self.optimal_borrow_rate < self.min_borrow_rate {
            msg!("Optimal borrow rate must be >= min borrow rate");
            return Err(ErrorCode::InvalidConfig.into());
        }
        if self.optimal_borrow_rate > self.max_borrow_rate {
            msg!("Optimal borrow rate must be <= max borrow rate");
            return Err(ErrorCode::InvalidConfig.into());
        }
        let borrow_fee = self.fees.borrow_fee.to_dec();
        if borrow_fee >= Decimal::one() {
            msg!(
                "Borrow fee must be in range [0, {}), got {}",
                Decimal::one(),
                borrow_fee
            );
            return Err(ErrorCode::InvalidConfig.into());
        }
        if self.fees.flash_loan_fee.to_dec() >= Decimal::one() {
            msg!("Flash loan fee must be in range [0, {})", Decimal::one());
            return Err(ErrorCode::InvalidConfig.into());
        }
        if *self.fees.host_fee > 100 {
            msg!("Host fee percentage must be in range [0, 100]");
            return Err(ErrorCode::InvalidConfig.into());
        }

        Ok(())
    }
}

impl Reserve {
    /// Record deposited liquidity and return amount of collateral tokens to
    /// mint in exchange for it.
    pub fn deposit_liquidity(&mut self, liquidity_amount: u64) -> Result<u64> {
        let collateral_amount = self
            .collateral_exchange_rate()?
            .liquidity_to_collateral(liquidity_amount)?;

        self.liquidity.deposit(liquidity_amount)?;
        self.collateral.mint(collateral_amount)?;

        Ok(collateral_amount)
    }

    /// Funder wants to get back their liquidity by giving over collateral
    /// tokens. Calculate how much liquidity they should get and burn the
    /// tokens. Must be called in conjunction with
    /// [`anchor_spl::token::burn`].
    pub fn redeem_collateral(&mut self, collateral_amount: u64) -> Result<u64> {
        let collateral_exchange_rate = self.collateral_exchange_rate()?;
        let liquidity_amount = collateral_exchange_rate
            .collateral_to_liquidity(collateral_amount)?;

        self.collateral.burn(collateral_amount)?;
        self.liquidity.withdraw(liquidity_amount)?;

        Ok(liquidity_amount)
    }

    pub fn collateral_exchange_rate(&self) -> Result<CollateralExchangeRate> {
        let total_liquidity = self.liquidity.total_supply()?;
        self.collateral.exchange_rate(total_liquidity)
    }

    /// Update borrow rate and accrue interest based on how much of the funds
    /// are presently borrowed.
    pub fn accrue_interest(&mut self, current_slot: u64) -> ProgramResult {
        let slots_elapsed = self.last_update.slots_elapsed(current_slot)?;
        if slots_elapsed > 0 {
            let current_borrow_rate = self.current_borrow_rate()?;
            self.liquidity
                .compound_interest(current_borrow_rate, slots_elapsed)?;
        }
        Ok(())
    }

    /// ref. eq. (3)
    pub fn current_borrow_rate(&self) -> Result<Rate> {
        let utilization_rate = self.liquidity.utilization_rate()?;
        let optimal_utilization_rate =
            Rate::from_percent(self.config.optimal_utilization_rate);
        let low_utilization = utilization_rate < optimal_utilization_rate;

        // if R_u < R*_u
        if low_utilization || *self.config.optimal_utilization_rate == 100 {
            let normalized_rate =
                utilization_rate.try_div(optimal_utilization_rate)?;
            let min_rate = Rate::from_percent(self.config.min_borrow_rate);
            let rate_range = Rate::from_percent(
                self.config
                    .optimal_borrow_rate
                    .checked_sub(self.config.min_borrow_rate)
                    .ok_or(ErrorCode::MathOverflow)?,
            );

            Ok(normalized_rate.try_mul(rate_range)?.try_add(min_rate)?)
        } else {
            let normalized_rate = utilization_rate
                .try_sub(optimal_utilization_rate)?
                .try_div(Rate::from_percent(
                    100u8
                        .checked_sub(
                            self.config.optimal_utilization_rate.into(),
                        )
                        .ok_or(ErrorCode::MathOverflow)?,
                ))?;
            let min_rate = Rate::from_percent(self.config.optimal_borrow_rate);
            let rate_range = Rate::from_percent(
                self.config
                    .max_borrow_rate
                    .checked_sub(self.config.optimal_borrow_rate)
                    .ok_or(ErrorCode::MathOverflow)?,
            );

            Ok(normalized_rate.try_mul(rate_range)?.try_add(min_rate)?)
        }
    }
}

impl ReserveLiquidity {
    /// Calculate the total reserve supply including active loans.
    pub fn total_supply(&self) -> Result<Decimal> {
        Decimal::from(self.available_amount)
            .try_add(self.borrowed_amount.into())
    }

    pub fn deposit(&mut self, liquidity_amount: u64) -> Result<()> {
        self.available_amount = self
            .available_amount
            .checked_add(liquidity_amount)
            .ok_or(ErrorCode::MathOverflow)?;
        Ok(())
    }

    /// ref. eq. (1)
    pub fn utilization_rate(&self) -> Result<Rate> {
        let total_supply = self.total_supply()?;
        if total_supply == Decimal::zero() {
            return Ok(Rate::zero());
        }
        Decimal::from(self.borrowed_amount)
            .try_div(total_supply)?
            .try_into()
    }

    pub fn withdraw(&mut self, liquidity_amount: u64) -> Result<()> {
        if liquidity_amount > self.available_amount {
            msg!("Withdraw amount cannot exceed available amount");
            return Err(ProgramError::InsufficientFunds.into());
        }
        self.available_amount = self
            .available_amount
            .checked_sub(liquidity_amount)
            .ok_or(ErrorCode::MathOverflow)?;
        Ok(())
    }

    fn compound_interest(
        &mut self,
        current_borrow_rate: Rate,
        slots_elapsed: u64,
    ) -> Result<()> {
        // ref. eq. (4)
        let slot_interest_rate =
            current_borrow_rate.try_div(consts::SLOTS_PER_YEAR)?;
        let compounded_interest_rate = Rate::one()
            .try_add(slot_interest_rate)?
            .try_pow(slots_elapsed)?;

        // ref. eq. (5)
        self.borrowed_amount = Rate::try_from(self.borrowed_amount)?
            .try_mul(compounded_interest_rate)?
            .into();

        // TODO: explain
        self.cumulative_borrow_rate =
            Rate::try_from(self.cumulative_borrow_rate)?
                .try_mul(compounded_interest_rate)?
                .into();

        Ok(())
    }
}

impl ReserveCollateral {
    /// You would call this method after calling [`anchor_spl::token::mint_to`].
    fn mint(&mut self, collateral_amount: u64) -> Result<()> {
        self.mint_total_supply = self
            .mint_total_supply
            .checked_add(collateral_amount)
            .ok_or(ErrorCode::MathOverflow)?;
        Ok(())
    }

    // ref. eq. (2)
    fn exchange_rate(
        &self,
        total_liquidity: Decimal,
    ) -> Result<CollateralExchangeRate> {
        let rate = if self.mint_total_supply == 0
            || total_liquidity == Decimal::zero()
        {
            Rate::from_scaled_val(consts::INITIAL_COLLATERAL_RATE)
        } else {
            let mint_total_supply = Decimal::from(self.mint_total_supply);
            Rate::try_from(mint_total_supply.try_div(total_liquidity)?)?
        };

        Ok(CollateralExchangeRate(rate))
    }

    pub fn burn(&mut self, collateral_amount: u64) -> Result<()> {
        self.mint_total_supply = self
            .mint_total_supply
            .checked_sub(collateral_amount)
            .ok_or(ErrorCode::MathOverflow)?;
        Ok(())
    }
}

impl CollateralExchangeRate {
    pub fn liquidity_to_collateral(
        &self,
        liquidity_amount: u64,
    ) -> Result<u64> {
        self.0.try_mul(liquidity_amount)?.try_round_u64()
    }

    pub fn collateral_to_liquidity(
        &self,
        collateral_amount: u64,
    ) -> Result<u64> {
        Decimal::from(collateral_amount)
            .try_div(self.0)?
            .try_round_u64()
    }

    pub fn decimal_collateral_to_liquidity(
        &self,
        collateral_amount: Decimal,
    ) -> Result<Decimal> {
        collateral_amount.try_div(self.0)
    }
}

impl InputReserveConfig {
    pub fn validate(self) -> Result<ReserveConfig> {
        let Self { conf } = self;
        conf.validate()?;
        Ok(conf)
    }
}
