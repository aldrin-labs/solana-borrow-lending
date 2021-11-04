use crate::prelude::*;
use std::convert::TryFrom;

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
    /// Fee assessed on [`BorrowObligationLiquidity`], expressed as a Wad. Must
    /// be between 0 and 10^18, such that 10^18 = 1.
    ///
    /// # Examples
    /// 1% = 10_000_000_000_000_000
    /// 0.01% (1 basis point) = 100_000_000_000_000
    /// 0.00001% (Aave borrow fee) = 100_000_000_000
    pub borrow_fee: Wads,
    /// Fee for flash loan, expressed as a Wad.
    /// 0.3% (Aave flash loan fee) = 3_000_000_000_000_000
    pub flash_loan_fee: Wads,
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
    /// TODO: explain how this works
    pub borrowed_amount_wads: Wads,
    /// TODO: explain how this works
    pub cumulative_borrow_rate_wads: Wads,
    /// Reserve liquidity market price in universal asset currency
    pub market_price: Wads,
}

impl Default for ReserveLiquidity {
    fn default() -> Self {
        // implemented by hand to avoid call stack limit in recursive
        // [`Default`] calls
        Self {
            available_amount: 0,
            borrowed_amount_wads: Decimal::zero().into(),
            cumulative_borrow_rate_wads: Decimal::one().into(),
            mint: Pubkey::default(),
            mint_decimals: 0,
            supply: Pubkey::default(),
            fee_receiver: Pubkey::default(),
            oracle: Pubkey::default(),
            market_price: Wads { wad: [0; 3] },
        }
    }
}

#[derive(
    AnchorSerialize, AnchorDeserialize, Clone, Debug, Default, PartialEq,
)]
pub struct ReserveCollateral {
    pub mint: Pubkey,
    /// Used for exchange rate calculation.
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
        if self.fees.borrow_fee.to_dec() >= Decimal::one() {
            msg!("Borrow fee must be in range [0, {})", consts::WAD);
            return Err(ErrorCode::InvalidConfig.into());
        }
        if self.fees.flash_loan_fee.to_dec() >= Decimal::one() {
            msg!("Flash loan fee must be in range [0, {})", consts::WAD);
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

    pub fn collateral_exchange_rate(&self) -> Result<CollateralExchangeRate> {
        let total_liquidity = self.liquidity.total_supply()?;
        self.collateral.exchange_rate(total_liquidity)
    }
}

impl ReserveLiquidity {
    /// Calculate the total reserve supply including active loans.
    pub fn total_supply(&self) -> Result<Decimal> {
        Decimal::from(self.available_amount)
            .try_add(self.borrowed_amount_wads.into())
    }

    pub fn deposit(&mut self, liquidity_amount: u64) -> Result<()> {
        self.available_amount = self
            .available_amount
            .checked_add(liquidity_amount)
            .ok_or(ErrorCode::MathOverflow)?;
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
}

impl CollateralExchangeRate {
    pub fn liquidity_to_collateral(
        &self,
        liquidity_amount: u64,
    ) -> Result<u64> {
        self.0.try_mul(liquidity_amount)?.try_round_u64()
    }
}

impl InputReserveConfig {
    pub fn validate(self) -> Result<ReserveConfig> {
        let Self { conf } = self;
        conf.validate()?;
        Ok(conf)
    }
}
