use crate::prelude::*;

/// Lending market reserve account. It's associated a reserve token wallet
/// account where the tokens that borrowers will want to borrow and funders will
/// want to lent are.
#[account]
#[derive(Debug, Default)]
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
#[cfg_attr(
    feature = "serde",
    derive(serde_crate::Serialize, serde_crate::Deserialize),
    serde(crate = "serde_crate")
)]
#[cfg_attr(feature = "serde", serde(rename_all = "camelCase"))]
pub struct ReserveConfig {
    /// Utilization rate is an indicator of the availability of capital in the
    /// pool. The interest rate model is used to manage liquidity risk through
    /// user incentivises to support liquidity:
    /// * When capital is available: low interest rates to encourage loans.
    /// * When capital is scarce: high interest rates to encourage repayments
    ///   of loans and additional deposits.
    ///
    /// Liquidity risk materializes when utilization is high, its becomes more
    /// problematic as  gets closer to 100%. To tailor the model to this
    /// constraint, the interest rate curve is split in two parts around an
    /// optimal utilization rate. Before the slope is small, after it starts
    /// rising sharply. See eq. (3) for more information.
    pub optimal_utilization_rate: PercentageInt,
    /// LTV is the ratio between the maximum allowed borrow value and the
    /// collateral value. Set to 0 to disable use as a collateral.
    ///
    /// ## Example
    /// Say that a user deposit 100 USD worth of SOL, according to the
    /// currently LTV of 85% for Solana the users are able to borrow up to 85
    /// USD worth of assets.
    pub loan_to_value_ratio: PercentageInt,
    /// Bonus a liquidator gets when repaying part of an unhealthy obligation.
    /// This percentage will be used to multiply the liquidity value, so it
    /// must be lower than 100%.
    ///
    /// ## Example
    /// If the user has put in 100 USD worth of SOL and borrow 85 USD. If the
    /// value of the borrowed asset has reached 90 USD. The liquidator can
    /// comes in and pay 50 USD worth of SOL and it will be able to get back 50
    /// * (1 + 2%) =  51 USD worth of SOL.
    pub liquidation_bonus: PercentageInt,
    /// Loan to value ratio at which an obligation can be liquidated.
    ///
    /// In another words, liquidation threshold is the ratio between borrow
    /// amount and the collateral value at which the users are subject to
    /// liquidation.
    ///
    /// ## Example
    /// Say that a user deposit 100 USD worth of SOL and borrow 85 USD worth of
    /// assets, according to the currently liquidation threshold of 90%, the
    /// user is subject to liquidation if the value of the assets that they
    /// borrow has increased 90 USD.
    pub liquidation_threshold: PercentageInt,
    /// Min borrow APY TODO
    pub min_borrow_rate: PercentageInt,
    /// Optimal (utilization) borrow APY TODO
    pub optimal_borrow_rate: PercentageInt,
    /// Max borrow APY TODO
    pub max_borrow_rate: PercentageInt,
    /// Program owner fees separate from gains due to interest accrual.
    pub fees: ReserveFees,
}

/// Unvalidated config wrapper type. Use [`InputReserveConfig::validate`] to
/// access the inner value.
#[derive(AnchorSerialize, AnchorDeserialize, Debug)]
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
#[cfg_attr(
    feature = "serde",
    derive(serde_crate::Serialize, serde_crate::Deserialize),
    serde(crate = "serde_crate")
)]
#[cfg_attr(feature = "serde", serde(rename_all = "camelCase"))]
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
    /// Amount of fee going to host account, if provided in liquidate and
    /// repay.
    pub host_fee: PercentageInt,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq)]
pub struct ReserveLiquidity {
    pub mint: Pubkey,
    pub mint_decimals: u8,
    pub supply: Pubkey,
    pub fee_receiver: Pubkey,
    pub oracle: Oracle,
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
            oracle: Oracle::default(),
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
pub struct CollateralExchangeRate(Decimal);

#[derive(Debug)]
pub struct FeesCalculation {
    /// Loan origination fee
    pub borrow_fee: u64,
    /// Host fee portion of origination fee
    pub host_fee: u64,
}

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
        if *self.optimal_borrow_rate < *self.min_borrow_rate {
            msg!("Optimal borrow rate must be >= min borrow rate");
            return Err(ErrorCode::InvalidConfig.into());
        }
        if *self.optimal_borrow_rate > *self.max_borrow_rate {
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
    pub fn is_stale(&self, clock: &Clock) -> bool {
        self.last_update.is_stale(clock.slot).unwrap_or(true)
    }

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
    pub fn current_borrow_rate(&self) -> Result<Decimal> {
        let utilization_rate = self.liquidity.utilization_rate()?;
        let optimal_utilization_rate =
            Decimal::from_percent(self.config.optimal_utilization_rate);
        let low_utilization = utilization_rate < optimal_utilization_rate;

        // if R_u < R*_u
        if low_utilization || *self.config.optimal_utilization_rate == 100 {
            let normalized_rate =
                utilization_rate.try_div(optimal_utilization_rate)?;
            let min_rate = Decimal::from_percent(self.config.min_borrow_rate);
            let rate_range = Decimal::from_percent(
                self.config
                    .optimal_borrow_rate
                    .checked_sub(*self.config.min_borrow_rate)
                    .ok_or(ErrorCode::MathOverflow)?,
            );

            Ok(normalized_rate.try_mul(rate_range)?.try_add(min_rate)?)
        } else {
            let normalized_rate = utilization_rate
                .try_sub(optimal_utilization_rate)?
                .try_div(Decimal::from_percent(
                    100u8
                        .checked_sub(
                            self.config.optimal_utilization_rate.into(),
                        )
                        .ok_or(ErrorCode::MathOverflow)?,
                ))?;
            let min_rate =
                Decimal::from_percent(self.config.optimal_borrow_rate);
            let rate_range = Decimal::from_percent(
                self.config
                    .max_borrow_rate
                    .checked_sub(*self.config.optimal_borrow_rate)
                    .ok_or(ErrorCode::MathOverflow)?,
            );

            Ok(normalized_rate.try_mul(rate_range)?.try_add(min_rate)?)
        }
    }

    pub fn borrow_amount_with_fees(
        &self,
        borrow_amount: u64,
        max_borrow_value: Decimal,
    ) -> Result<(Decimal, FeesCalculation)> {
        let decimals = 10u64
            .checked_pow(self.liquidity.mint_decimals as u32)
            .ok_or(ErrorCode::MathOverflow)?;

        let fees =
            self.config.fees.borrow_fees(Decimal::from(borrow_amount))?;

        let borrow_amount =
            Decimal::from(borrow_amount).try_add(fees.borrow_fee.into())?;
        let borrow_value = borrow_amount
            .try_mul(self.liquidity.market_price.to_dec())?
            .try_div(decimals)?;
        if borrow_value > max_borrow_value {
            msg!(
                "Borrow value ({}) cannot exceed maximum borrow value ({})",
                borrow_value,
                max_borrow_value
            );
            return Err(ErrorCode::BorrowTooLarge.into());
        }

        Ok((borrow_amount, fees))
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
    pub fn utilization_rate(&self) -> Result<Decimal> {
        let total_supply = self.total_supply()?;
        if total_supply == Decimal::zero() {
            Ok(Decimal::zero())
        } else {
            Ok(Decimal::from(self.borrowed_amount).try_div(total_supply)?)
        }
    }

    pub fn withdraw(&mut self, liquidity_amount: u64) -> Result<()> {
        if liquidity_amount > self.available_amount {
            msg!("Withdraw amount cannot exceed available amount");
            return Err(err::insufficient_funds(
                liquidity_amount,
                self.available_amount,
            )
            .into());
        }
        self.available_amount = self
            .available_amount
            .checked_sub(liquidity_amount)
            .ok_or(ErrorCode::MathOverflow)?;
        Ok(())
    }

    /// Add repay amount to available liquidity and subtract settle amount from
    /// total borrows.
    pub fn repay(
        &mut self,
        repay_amount: u64,
        settle_amount: Decimal,
    ) -> ProgramResult {
        self.available_amount = self
            .available_amount
            .checked_add(repay_amount)
            .ok_or(ErrorCode::MathOverflow)?;
        self.borrowed_amount = self
            .borrowed_amount
            .to_dec()
            .try_sub(settle_amount)
            // small discrepancies can occur on small timelines (borrow and
            // repay between few slots) when repaying last loan between the
            // reserve's immediate cumulative borrow and obligation's borrowed
            // amount
            //
            // this prevents those tiny results from rendering an obligation
            // problematic to repay due to overflow errors
            .unwrap_or_else(|_| Decimal::zero())
            .into();

        Ok(())
    }

    fn compound_interest(
        &mut self,
        current_borrow_rate: Decimal,
        slots_elapsed: u64,
    ) -> Result<()> {
        // ref. eq. (4)
        let slot_interest_rate =
            current_borrow_rate.try_div(consts::SLOTS_PER_YEAR)?;
        let compounded_interest_rate = Decimal::one()
            .try_add(slot_interest_rate)?
            .try_pow(slots_elapsed)?;

        // ref. eq. (5)
        self.borrowed_amount = self
            .borrowed_amount
            .to_dec()
            .try_mul(compounded_interest_rate)?
            .into();

        // TODO: explain
        self.cumulative_borrow_rate = self
            .cumulative_borrow_rate
            .to_dec()
            .try_mul(compounded_interest_rate)?
            .into();

        Ok(())
    }

    /// Subtract borrow amount from available liquidity and add to borrows.
    pub fn borrow(&mut self, borrow_decimal: Decimal) -> Result<()> {
        let borrow_amount = borrow_decimal.try_floor_u64()?;
        if borrow_amount > self.available_amount {
            msg!("Borrow amount cannot exceed available amount");
            return Err(err::insufficient_funds(
                borrow_amount,
                self.available_amount,
            )
            .into());
        }

        self.available_amount = self
            .available_amount
            .checked_sub(borrow_amount)
            .ok_or(ErrorCode::MathOverflow)?;
        self.borrowed_amount = self
            .borrowed_amount
            .to_dec()
            .try_add(borrow_decimal)?
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
            Decimal::from_scaled_val(consts::INITIAL_COLLATERAL_RATE.into())
        } else {
            let mint_total_supply = Decimal::from(self.mint_total_supply);
            mint_total_supply.try_div(total_liquidity)?
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
        self.0.try_mul(liquidity_amount)?.try_floor_u64()
    }

    pub fn collateral_to_liquidity(
        &self,
        collateral_amount: u64,
    ) -> Result<u64> {
        Decimal::from(collateral_amount)
            .try_div(self.0)?
            .try_floor_u64()
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

    pub fn new(conf: ReserveConfig) -> Self {
        Self { conf }
    }
}

impl ReserveFees {
    pub fn flash_loan_fee(&self, borrow_amount: Decimal) -> Result<u64> {
        // no host fees on flash loans as its a developer dedicated action
        let host_fee_rate = Decimal::zero();

        self.calculate(borrow_amount, self.flash_loan_fee.into(), host_fee_rate)
            .map(|fees| fees.borrow_fee)
    }

    /// Calculate the owner and host fees on borrow
    fn borrow_fees(&self, borrow_amount: Decimal) -> Result<FeesCalculation> {
        let host_fee_rate = Decimal::from_percent(self.host_fee);
        self.calculate(borrow_amount, self.borrow_fee.into(), host_fee_rate)
    }

    fn calculate(
        &self,
        borrow_amount: Decimal,
        borrow_fee_rate: Decimal,
        host_fee_rate: Decimal,
    ) -> Result<FeesCalculation> {
        if borrow_fee_rate > Decimal::zero() && borrow_amount > Decimal::zero()
        {
            let need_to_assess_host_fee = host_fee_rate > Decimal::zero();
            let minimum_fee = if need_to_assess_host_fee {
                2 // 1 token to owner, 1 to host
            } else {
                1 // 1 token to owner, nothing else
            };

            // Calculate fee to be added to borrow: fee = max(amount * rate,
            // minimum_fee)
            let borrow_fee = borrow_amount
                .try_mul(borrow_fee_rate)?
                .try_round_u64()?
                .max(minimum_fee);

            if Decimal::from(borrow_fee) >= borrow_amount {
                msg!(
                    "Borrow amount is too small to receive liquidity after fees"
                );
                return Err(ErrorCode::BorrowTooSmall.into());
            }

            let host_fee = if need_to_assess_host_fee {
                host_fee_rate.try_mul(borrow_fee)?.try_round_u64()?.max(1)
            } else {
                0
            };

            Ok(FeesCalculation {
                borrow_fee,
                host_fee,
            })
        } else {
            Ok(FeesCalculation {
                borrow_fee: 0,
                host_fee: 0,
            })
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;
    use std::cmp::Ordering;

    #[cfg(feature = "serde")]
    #[test]
    fn it_deserializes_config_from_json() {
        assert!(serde_json::from_str::<ReserveConfig>(
            r#"{
              "optimalUtilizationRate": { "percent": 50 },
              "loanToValueRatio": { "percent": 90 },
              "liquidationBonus": { "percent": 2 },
              "liquidationThreshold": { "percent": 96 },
              "minBorrowRate": { "percent": 1 },
              "optimalBorrowRate": { "percent": 5 },
              "maxBorrowRate": { "percent": 10 },
              "fees": {
                "borrowFee": { "u192": [10000000000000000, 0, 0] },
                "flashLoanFee": { "u192": [1000000000000000, 0, 0] },
                "hostFee": { "percent": 2 }
              }
            }"#
        )
        .is_ok());
    }

    #[test]
    fn it_borrows_reserve_liquidity() {
        let mut liq = ReserveLiquidity::default();
        liq.available_amount = 50;

        assert!(liq.borrow(51u64.into()).is_err());
        assert!(liq.borrow(25u64.into()).is_ok());
        assert_eq!(liq.available_amount, 25);
        assert_eq!(liq.borrowed_amount.to_dec(), 25u64.into());
    }

    #[test]
    fn it_repays_reserve_liquidity() {
        let mut liq = ReserveLiquidity::default();
        liq.available_amount = 50u64;
        liq.borrowed_amount = Decimal::from(20u64).into();

        assert!(liq.repay(5u64, Decimal::from(5u64)).is_ok());
        assert_eq!(Decimal::from(15u64), liq.borrowed_amount.into());

        assert!(liq.repay(5u64, Decimal::from(40u64)).is_ok());
        assert_eq!(Decimal::zero(), liq.borrowed_amount.into());
    }

    #[test]
    fn test_borrow_amount_with_fees() {
        let mut reserve = Reserve::default();

        reserve.liquidity.market_price =
            Decimal::one().try_mul(Decimal::from(35u64)).unwrap().into();
        reserve.config.fees.borrow_fee = Decimal::from_percent(70u8).into();

        let (
            borrow,
            FeesCalculation {
                borrow_fee,
                host_fee,
            },
        ) = reserve.borrow_amount_with_fees(10, 1000u64.into()).unwrap();
        assert_eq!(host_fee, 0);
        assert_eq!(borrow_fee, 7);
        assert_eq!(borrow, Decimal::from(17u64));

        reserve.config.fees.host_fee = 30u8.into();
        let (
            borrow,
            FeesCalculation {
                borrow_fee,
                host_fee,
            },
        ) = reserve.borrow_amount_with_fees(10, 1000u64.into()).unwrap();
        assert_eq!(host_fee, 2);
        assert_eq!(borrow_fee, 7);
        assert_eq!(borrow, Decimal::from(17u64));

        assert!(reserve.borrow_amount_with_fees(10, 100u64.into()).is_err());
    }

    #[test]
    fn test_deposit_liquidity() {
        let mut reserve = Reserve::default();

        assert_eq!(
            reserve.deposit_liquidity(10).unwrap(),
            10 * consts::INITIAL_COLLATERAL_RATIO
        );
        assert_eq!(
            reserve.deposit_liquidity(12).unwrap(),
            12 * consts::INITIAL_COLLATERAL_RATIO
        );
    }

    #[test]
    fn it_cannot_redeem_non_existent_collateral() {
        let mut reserve = Reserve::default();

        assert!(reserve.redeem_collateral(10).is_err());
    }

    #[test]
    fn it_deposits_liquidity_and_redeems_collateral() {
        let mut reserve = Reserve::default();

        assert_eq!(
            reserve.deposit_liquidity(100).unwrap(),
            100 * consts::INITIAL_COLLATERAL_RATIO
        );
        assert_eq!(
            reserve.redeem_collateral(10).unwrap(),
            10 / consts::INITIAL_COLLATERAL_RATIO
        );
        assert_eq!(
            reserve.redeem_collateral(21).unwrap(),
            21 / consts::INITIAL_COLLATERAL_RATIO
        );
    }

    #[test]
    fn it_returns_reserve_as_stale() {
        let mut reserve = Reserve::default();

        let mut clock = Clock::default();
        clock.slot = 10;

        reserve.last_update.update_slot(10);
        assert!(!reserve.is_stale(&clock));

        reserve.last_update.update_slot(9);
        assert!(reserve.is_stale(&clock));

        reserve.last_update.update_slot(11);
        assert!(reserve.is_stale(&clock)); // overflow
    }

    #[test]
    fn it_validates_conf() {
        let conf = valid_conf();
        assert!(conf.validate().is_ok());

        let mut conf = valid_conf();
        conf.liquidation_threshold = conf.loan_to_value_ratio;
        assert!(conf.validate().is_err());
        conf.liquidation_threshold = (*conf.loan_to_value_ratio - 1).into();
        assert!(conf.validate().is_err());
        conf.liquidation_threshold = (*conf.loan_to_value_ratio + 1).into();
        assert!(conf.validate().is_ok());

        let mut conf = valid_conf();
        conf.optimal_utilization_rate = 0.into();
        assert!(conf.validate().is_ok());
        conf.optimal_utilization_rate = 100.into();
        assert!(conf.validate().is_ok());
        conf.optimal_utilization_rate = 101.into();
        assert!(conf.validate().is_err());

        let mut conf = valid_conf();
        conf.liquidation_threshold = 100.into();
        conf.loan_to_value_ratio = 0.into();
        assert!(conf.validate().is_ok());
        conf.loan_to_value_ratio = 99.into();
        assert!(conf.validate().is_ok());
        conf.loan_to_value_ratio = 100.into();
        assert!(conf.validate().is_err());
        conf.loan_to_value_ratio = 101.into();
        assert!(conf.validate().is_err());

        let mut conf = valid_conf();
        conf.liquidation_bonus = 0.into();
        assert!(conf.validate().is_ok());
        conf.liquidation_bonus = 100.into();
        assert!(conf.validate().is_ok());
        conf.liquidation_bonus = 101.into();
        assert!(conf.validate().is_err());

        let mut conf = valid_conf();
        conf.optimal_borrow_rate = 50.into();
        conf.max_borrow_rate = 49.into();
        assert!(conf.validate().is_err());
        conf.optimal_borrow_rate = conf.max_borrow_rate;
        assert!(conf.validate().is_ok());

        let mut conf = valid_conf();
        conf.max_borrow_rate = 90.into();
        conf.optimal_borrow_rate = 50.into();
        conf.min_borrow_rate = 51.into();
        assert!(conf.validate().is_err());
        conf.optimal_borrow_rate = conf.min_borrow_rate;
        assert!(conf.validate().is_ok());

        let mut conf = valid_conf();
        conf.fees.host_fee = 0.into();
        assert!(conf.validate().is_ok());
        conf.fees.host_fee = 100.into();
        assert!(conf.validate().is_ok());
        conf.fees.host_fee = 101.into();
        assert!(conf.validate().is_err());

        let mut conf = valid_conf();
        conf.fees.borrow_fee = Decimal::one()
            .try_add(Decimal::from_percent(50))
            .unwrap()
            .into();
        assert!(conf.validate().is_err());
        conf.fees.borrow_fee = Decimal::one()
            .try_sub(Decimal::from_percent(50))
            .unwrap()
            .into();
        assert!(conf.validate().is_ok());

        let mut conf = valid_conf();
        conf.fees.flash_loan_fee = Decimal::one()
            .try_add(Decimal::from_percent(50))
            .unwrap()
            .into();
        assert!(conf.validate().is_err());
        conf.fees.flash_loan_fee = Decimal::one()
            .try_sub(Decimal::from_percent(50))
            .unwrap()
            .into();
        assert!(conf.validate().is_ok());
    }

    #[test]
    fn borrow_fee_calculation_min_host() {
        let fees = ReserveFees {
            borrow_fee: Decimal::from_percent(1).into(),
            host_fee: 20.into(),
            ..Default::default()
        };

        // only 2 tokens borrowed, get error
        assert!(fees.borrow_fees(Decimal::from(2u64)).is_err());

        // only 1 token borrowed, get error
        assert!(fees.borrow_fees(Decimal::one()).is_err());

        // 0 amount borrowed, 0 fee
        let FeesCalculation {
            host_fee,
            borrow_fee,
        } = fees.borrow_fees(Decimal::zero()).unwrap();
        assert_eq!(borrow_fee, 0);
        assert_eq!(host_fee, 0);
    }

    #[test]
    fn test_borrow_fee_calculation_min_no_host() {
        let fees = ReserveFees {
            borrow_fee: Decimal::from_percent(1).into(),
            ..Default::default()
        };

        // only 2 tokens borrowed, ok
        let FeesCalculation {
            host_fee,
            borrow_fee,
        } = fees.borrow_fees(Decimal::from(2u64)).unwrap();
        assert_eq!(borrow_fee, 1);
        assert_eq!(host_fee, 0);

        // only 1 token borrowed, get error
        assert!(fees.borrow_fees(Decimal::one()).is_err());

        // 0 amount borrowed, 0 fee
        let FeesCalculation {
            host_fee,
            borrow_fee,
        } = fees.borrow_fees(Decimal::zero()).unwrap();
        assert_eq!(borrow_fee, 0);
        assert_eq!(host_fee, 0);
    }

    #[test]
    fn test_borrow_fee_calculation_host() {
        let fees = ReserveFees {
            borrow_fee: Decimal::from_percent(1).into(),
            host_fee: 20.into(),
            ..Default::default()
        };

        let FeesCalculation {
            host_fee,
            borrow_fee,
        } = fees.borrow_fees(Decimal::from(1000u64)).unwrap();

        assert_eq!(borrow_fee, 10); // 1% of 1000
        assert_eq!(host_fee, 2); // 20% of 10
    }

    #[test]
    fn test_borrow_fee_calculation_no_host() {
        let fees = ReserveFees {
            borrow_fee: Decimal::from_percent(1).into(),
            ..Default::default()
        };

        let FeesCalculation {
            host_fee,
            borrow_fee,
        } = fees.borrow_fees(Decimal::from(1000u64)).unwrap();

        assert_eq!(borrow_fee, 10); // 1% of 1000
        assert_eq!(host_fee, 0); // 0 host fee
    }

    fn valid_conf() -> ReserveConfig {
        ReserveConfig {
            loan_to_value_ratio: 20.into(),
            liquidation_threshold: 50.into(),
            ..Default::default()
        }
    }

    const MAX_LIQUIDITY: u64 = u64::MAX / 5;

    // Creates rates (min, opt, max) where 0 <= min <= opt <= max <= MAX
    prop_compose! {
        fn borrow_rates()(optimal_rate in 0..=u8::MAX)(
            min_rate in 0..=optimal_rate,
            optimal_rate in Just(optimal_rate),
            max_rate in optimal_rate..=u8::MAX,
        ) -> (u8, u8, u8) {
            (min_rate, optimal_rate, max_rate)
        }
    }

    // Creates rates (threshold, ltv) where 2 <= threshold <= 100 and threshold
    // <= ltv <= 1,000%
    prop_compose! {
        fn unhealthy_rates()(threshold in 2..=100u8)(
            ltv_rate in threshold as u64..=1000u64,
            threshold in Just(threshold),
        ) -> (Decimal, u8) {
            (
                Decimal::from_scaled_val(
                    ltv_rate as u128 * consts::PERCENT_SCALER as u128
                ),
                threshold,
            )
        }
    }

    // Creates a range of reasonable token conversion rates
    prop_compose! {
        fn token_conversion_rate()(
            conversion_rate in 1..=u16::MAX,
            invert_conversion_rate: bool,
        ) -> Decimal {
            let conversion_rate = Decimal::from(conversion_rate as u64);
            if invert_conversion_rate {
                Decimal::one().try_div(conversion_rate).unwrap()
            } else {
                conversion_rate
            }
        }
    }

    // Creates a range of reasonable collateral exchange rates
    prop_compose! {
        fn collateral_exchange_rate_range()(percent in 1..=500u64)
            -> CollateralExchangeRate
        {
            CollateralExchangeRate(
                Decimal::from_scaled_val((percent * consts::PERCENT_SCALER) as u128)
            )
        }
    }

    proptest! {
        #[test]
        fn test_current_borrow_rate(
            total_liquidity in 0..=MAX_LIQUIDITY,
            borrowed_percent in 0..=consts::WAD,
            optimal_utilization_rate in 0..=100u8,
            (min_borrow_rate, optimal_borrow_rate, max_borrow_rate)
                    in borrow_rates()
        ) {
            let borrowed_amount = Decimal::from(total_liquidity)
                .try_mul(Decimal::from_scaled_val(borrowed_percent as u128))?;
            let reserve = Reserve {
                liquidity: ReserveLiquidity {
                    borrowed_amount: borrowed_amount.into(),
                    available_amount: (total_liquidity
                        - borrowed_amount.try_round_u64()?)
                    .into(),
                    ..Default::default()
                },
                config: ReserveConfig {
                    optimal_utilization_rate: optimal_utilization_rate.into(),
                    min_borrow_rate: min_borrow_rate.into(),
                    optimal_borrow_rate: optimal_borrow_rate.into(),
                    max_borrow_rate: max_borrow_rate.into(),
                    ..Default::default()
                },
                ..Default::default()
            };

            let current_borrow_rate = reserve.current_borrow_rate()?;
            assert!(current_borrow_rate >= Decimal::from_percent(min_borrow_rate));
            assert!(current_borrow_rate <= Decimal::from_percent(max_borrow_rate));

            let optimal_borrow_rate = Decimal::from_percent(optimal_borrow_rate);
            let current_rate = reserve.liquidity.utilization_rate()?;
            match current_rate.cmp(&Decimal::from_percent(optimal_utilization_rate))
            {
                Ordering::Less => {
                    if min_borrow_rate == *reserve.config.optimal_borrow_rate {
                        assert_eq!(current_borrow_rate, optimal_borrow_rate);
                    } else {
                        assert!(current_borrow_rate < optimal_borrow_rate);
                    }
                }
                Ordering::Equal => {
                    assert!(current_borrow_rate == optimal_borrow_rate)
                }
                Ordering::Greater => {
                    if max_borrow_rate == *reserve.config.optimal_borrow_rate {
                        assert_eq!(current_borrow_rate, optimal_borrow_rate);
                    } else {
                        assert!(current_borrow_rate > optimal_borrow_rate);
                    }
                }
            }
        }

        #[test]
        fn test_current_utilization_rate(
            total_liquidity in 0..=MAX_LIQUIDITY,
            borrowed_percent in 0..=consts::WAD,
        ) {
            let borrowed_amount = Decimal::from(total_liquidity)
                .try_mul(Decimal::from_scaled_val(borrowed_percent as u128))?;
            let liquidity = ReserveLiquidity {
                borrowed_amount: borrowed_amount.into(),
                available_amount: (total_liquidity
                    - borrowed_amount.try_round_u64()?)
                .into(),
                ..Default::default()
            };

            let current_rate = liquidity.utilization_rate()?;
            assert!(current_rate <= Decimal::one());
        }

        #[test]
        fn test_collateral_exchange_rate(
            total_liquidity in 0..=MAX_LIQUIDITY,
            borrowed_percent in 0..=consts::WAD,
            collateral_multiplier in consts::WAD..=(5 * consts::WAD),
            borrow_rate in 0..=u8::MAX
        ) {
            let borrowed_liquidity = Decimal::from(total_liquidity)
                .try_mul(Decimal::from_scaled_val(borrowed_percent as u128))?;
            let available_liquidity =
                total_liquidity - borrowed_liquidity.try_round_u64()?;
            let mint_total_supply = Decimal::from(total_liquidity)
                .try_mul(Decimal::from_scaled_val(collateral_multiplier as u128))?
                .try_round_u64()?;

            let mut reserve = Reserve {
                collateral: ReserveCollateral {
                    mint_total_supply,
                    ..Default::default()
                },
                liquidity: ReserveLiquidity {
                    borrowed_amount: borrowed_liquidity.into(),
                    available_amount: available_liquidity.into(),
                    ..Default::default()
                },
                config: ReserveConfig {
                    min_borrow_rate: borrow_rate.into(),
                    optimal_borrow_rate: borrow_rate.into(),
                    optimal_utilization_rate: 100.into(),
                    ..Default::default()
                },
                ..Default::default()
            };

            let exchange_rate = reserve.collateral_exchange_rate()?;
            assert!(
                exchange_rate.0.to_scaled_val().unwrap()
                    <= 5u128 * consts::WAD as u128
            );

            // After interest accrual, total liquidity increases
            // and collateral are worth more
            reserve.accrue_interest(5)?;

            let new_exchange_rate = reserve.collateral_exchange_rate()?;
            if borrow_rate > 0
                && total_liquidity > 0
                && borrowed_percent > 0
                && collateral_multiplier > 0
            {
                assert!(new_exchange_rate.0 < exchange_rate.0);
            } else {
                assert_eq!(new_exchange_rate.0, exchange_rate.0);
            }
        }

        #[test]
        fn test_compound_interest(
            slots_elapsed in 0..=consts::SLOTS_PER_YEAR,
            borrow_rate in 0..=u8::MAX,
        ) {
            let mut reserve = Reserve::default();
            let borrow_rate = Decimal::from_percent(borrow_rate);

            // Simulate assuming that interest is
            // compounded at least once a year
            let years = 10;
            for _ in 0..years {
                reserve
                    .liquidity
                    .compound_interest(borrow_rate, slots_elapsed)?;
                reserve
                    .liquidity
                    .cumulative_borrow_rate
                    .to_dec()
                    .to_scaled_val()?;
            }
        }

        #[test]
        fn test_reserve_accrue_interest(
            slots_elapsed in 2..=consts::SLOTS_PER_YEAR,
            borrowed_liquidity in 0..=u64::MAX,
            borrow_rate in 0..=u8::MAX)
        {
            let borrowed_amount = Decimal::from(borrowed_liquidity);
            let mut reserve = Reserve {
                liquidity: ReserveLiquidity {
                    borrowed_amount: borrowed_amount.into(),
                    ..Default::default()
                },
                config: ReserveConfig {
                    max_borrow_rate: borrow_rate.into(),
                    ..Default::default()
                },
                ..Default::default()
            };

            reserve.accrue_interest(slots_elapsed)?;

            if borrow_rate > 0 && slots_elapsed > 0 {
                assert!(
                    reserve.liquidity.borrowed_amount.to_dec() > borrowed_amount
                );
            } else {
                assert!(
                    reserve.liquidity.borrowed_amount.to_dec() == borrowed_amount
                );
            }
        }

        #[test]
        fn test_borrow_fee_calculation(
            borrow_fee in 0..consts::WAD,
            host_fee in 0..=100u8,
            borrow_amount in 3..=u64::MAX
        ) {
            let fees = ReserveFees {
                borrow_fee: Decimal::from_scaled_val(borrow_fee.into()).into(),
                flash_loan_fee: Default::default(),
                host_fee: host_fee.into(),
            };
            let FeesCalculation {
                borrow_fee,
                host_fee,
            } = fees.borrow_fees(Decimal::from(borrow_amount))?;

            // The total fee can't be greater than the amount borrowed, as long
            // as amount borrowed is greater than 2.
            // At a borrow amount of 2, we can get a total fee of 2 if a host
            // fee is also specified.
            assert!(borrow_fee <= borrow_amount);

            // the host fee can't be greater than the total fee
            assert!(host_fee <= borrow_fee);

            // for all fee rates greater than 0, we must have some fee
            if borrow_fee > 0 {
                assert!(borrow_fee > 0);
            }

            if host_fee == 100 {
                // if the host fee percentage is maxed at 100%, it should get
                // all the fee
                assert_eq!(host_fee, borrow_fee);
            }

            // if there's a host fee and some borrow fee, host fee must be
            // greater than 0
            if host_fee > 0 && borrow_fee > 0 {
                assert!(host_fee > 0);
            } else {
                assert_eq!(host_fee, 0);
            }
        }
    }
}
