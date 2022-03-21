use crate::prelude::*;

/// Represents a token and associates it with configuration. Against this token
/// users can borrow the stable coin. That is, users deposit their component
/// token mint and are minted stable coin.
#[account]
#[derive(Default)]
pub struct Component {
    /// Which stable coin root state does this component connect to.
    pub stable_coin: Pubkey,
    /// The mint of the token used as collateral.
    pub mint: Pubkey,
    /// Collateral mint decimals
    pub decimals: u8,
    /// The pubkey of the borrow lending program's reserve. We use this to get
    /// the current USD price (assuming the UAC is USD).
    pub blp_reserve: Pubkey,
    /// Where we store the tokens deposited as collateral. From here they're
    /// withdrawn on repay or liquidation.
    pub freeze_wallet: Pubkey,
    /// Liquidation fees etc are sent here.
    pub fee_wallet: Pubkey,
    pub config: ComponentConfig,
}

#[derive(
    AnchorSerialize,
    AnchorDeserialize,
    Default,
    Debug,
    Copy,
    Clone,
    PartialEq,
    Eq,
)]
pub struct ComponentConfig {
    /// Maximum amount of stable coin borrowed against the given amount of
    /// collateral is scaled down by this ratio. It must be in (0; 1].
    pub max_collateral_ratio: SDecimal,
    /// APR interest
    pub interest: SDecimal,
    /// The percentage that's taken from the borrower based on how much stable
    /// coin they want.
    pub borrow_fee: SDecimal,
    /// Percentage bonus on borrower's collateral that the liquidators get.
    pub liquidation_bonus: SDecimal,
    /// Percentage of how much do we take in fees from the liquidator's
    /// discounted collateral. E.g. if the liquidator earns $10 thanks to the
    /// discount, and this value is 50%, we get $5.
    pub platform_liquidation_fee: SDecimal,
    /// How many more stable coin tokens can be minted with the collateral of
    /// this component.
    ///
    /// The admin can change this allowance at will, e.g. set it to 0 to
    /// disable any further minting. When a user repays their loan and
    /// withdraws their collateral, this gets increased.
    pub mint_allowance: u64,
}

/// Unvalidated config wrapper type. Use [`InputComponentConfig::validate`] to
/// access the inner value.
#[derive(AnchorSerialize, AnchorDeserialize, Debug)]
pub struct InputComponentConfig {
    conf: ComponentConfig,
}

impl InputComponentConfig {
    pub fn validate(self) -> Result<ComponentConfig> {
        let Self { conf } = self;
        conf.validate()?;
        Ok(conf)
    }
}

impl Component {
    /// The component might represent either the liquidity mint, in which case
    /// the market price per component token is the liquidity market price,
    /// or the collateral token mint, in which case we need to first get an
    /// exchange ration from 1 collateral token to X liquidity tokens and then
    /// multiply by the liquidity market price.
    ///
    /// # Important
    /// The output market price is scaled down by decimals. If the mint is SOL,
    /// the output of this function returns USD price for 1 lamport.
    ///
    /// TODO: consider returning a wrapper MarketPrice type to avoid bugs
    pub fn smallest_unit_market_price(
        &self,
        reserve: &borrow_lending::models::Reserve,
    ) -> Result<Decimal> {
        let decimals = 10u64
            .checked_pow(self.decimals as u32)
            .ok_or(ErrorCode::MathOverflow)?;

        if reserve.liquidity.mint == self.mint {
            Ok(reserve.liquidity.market_price.to_dec().try_div(decimals)?)
        } else if reserve.collateral.mint == self.mint {
            let liquidity_amount = reserve
                .collateral_exchange_rate()
                .and_then(|rate| {
                    // since market price is per 1 token of the mint, we want
                    // 1 collateral to X liquidity
                    rate.decimal_collateral_to_liquidity(1u64.into())
                })
                .map_err(Error::from)?;
            liquidity_amount
                .try_mul(reserve.liquidity.market_price.to_dec())?
                .try_div(decimals)
                .map_err(From::from)
        } else {
            msg!(
                "Provided reserve's liquidity ({}) nor collateral ({}) mints \
                match components mint ({})",
                reserve.liquidity.mint,
                reserve.collateral.mint,
                self.mint
            );
            Err(ErrorCode::ComponentReserveMismatch.into())
        }
    }
}

impl ComponentConfig {
    fn validate(&self) -> ProgramResult {
        let interest = self.interest.to_dec();
        if interest.try_floor_u64()? != 0 {
            msg!("Interest must be in range [0; 1)");
            return Err(ErrorCode::InvalidConfig.into());
        }

        let max_collateral_ratio = self.max_collateral_ratio.to_dec();
        if max_collateral_ratio == Decimal::zero()
            || max_collateral_ratio.try_ceil_u64()? != 1
        {
            msg!("Max collateral ratio must be in range (0; 1]");
            return Err(ErrorCode::InvalidConfig.into());
        }

        let borrow_fee = self.borrow_fee.to_dec();
        if borrow_fee.try_floor_u64()? != 0 {
            msg!("Borrow fee must be in range [0; 1)");
            return Err(ErrorCode::InvalidConfig.into());
        }

        let liquidation_bonus = self.liquidation_bonus.to_dec();
        if liquidation_bonus == Decimal::zero()
            || liquidation_bonus.try_floor_u64()? != 0
        {
            msg!("Liquidation fee must be in range (0; 1)");
            return Err(ErrorCode::InvalidConfig.into());
        }

        let platform_liquidation_fee = self.platform_liquidation_fee.to_dec();
        if platform_liquidation_fee.try_floor_u64()? != 0 {
            msg!("Liquidation fee must be in range [0; 1)");
            return Err(ErrorCode::InvalidConfig.into());
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn it_validates_config() {
        let valid_config = ComponentConfig {
            interest: Decimal::from_percent(50u64).into(),
            max_collateral_ratio: Decimal::from_percent(50u64).into(),
            borrow_fee: Decimal::from_percent(50u64).into(),
            liquidation_bonus: Decimal::from_percent(50u64).into(),
            ..Default::default()
        };

        assert_eq!(
            Ok(valid_config),
            InputComponentConfig { conf: valid_config }.validate()
        );

        assert!(ComponentConfig {
            interest: Decimal::from(0u64).into(),
            ..valid_config
        }
        .validate()
        .is_ok());
        assert!(ComponentConfig {
            interest: Decimal::from(100u64).into(),
            ..valid_config
        }
        .validate()
        .is_err());

        assert!(ComponentConfig {
            max_collateral_ratio: Decimal::from(101u64).into(),
            ..valid_config
        }
        .validate()
        .is_err());
        assert!(ComponentConfig {
            max_collateral_ratio: Decimal::from(0u64).into(),
            ..valid_config
        }
        .validate()
        .is_err());

        assert!(ComponentConfig {
            borrow_fee: Decimal::from(101u64).into(),
            ..valid_config
        }
        .validate()
        .is_err());
        assert!(ComponentConfig {
            borrow_fee: Decimal::from(0u64).into(),
            ..valid_config
        }
        .validate()
        .is_ok());

        assert!(ComponentConfig {
            liquidation_bonus: Decimal::from(101u64).into(),
            ..valid_config
        }
        .validate()
        .is_err());
        assert!(ComponentConfig {
            liquidation_bonus: Decimal::from(0u64).into(),
            ..valid_config
        }
        .validate()
        .is_err());
    }

    #[test]
    fn it_calculates_market_price_for_collateral_mint() {
        let mint = Pubkey::new_unique();

        let component = Component {
            mint,
            ..Default::default()
        };

        let reserve = borrow_lending::models::Reserve {
            liquidity: borrow_lending::models::ReserveLiquidity {
                market_price: Decimal::from(5u64).into(),
                available_amount: 20,
                ..Default::default()
            },
            collateral: borrow_lending::models::ReserveCollateral {
                mint_total_supply: 10,
                mint,
                ..Default::default()
            },
            ..Default::default()
        };

        assert_eq!(
            component.smallest_unit_market_price(&reserve),
            Ok(Decimal::from(20u64 * 5 / 10))
        );
    }

    #[test]
    fn it_returns_market_price_for_liquidity_mint() {
        let mint = Pubkey::new_unique();

        let component = Component {
            mint,
            ..Default::default()
        };

        let reserve = borrow_lending::models::Reserve {
            liquidity: borrow_lending::models::ReserveLiquidity {
                mint,
                market_price: Decimal::one().into(),
                ..Default::default()
            },
            ..Default::default()
        };

        assert_eq!(
            component.smallest_unit_market_price(&reserve),
            Ok(Decimal::one())
        );
    }

    #[test]
    fn it_fails_if_neither_collateral_nor_liquidity_mint_match() {
        let component = Component {
            mint: Pubkey::new_unique(),
            ..Default::default()
        };

        let reserve = borrow_lending::models::Reserve {
            ..Default::default()
        };

        assert!(component.smallest_unit_market_price(&reserve).is_err(),);
    }
}
