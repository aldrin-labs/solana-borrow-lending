use crate::prelude::*;

#[account]
#[derive(Default)]
pub struct Receipt {
    /// The pubkey of the user who "owns" this receipt.
    pub borrower: Pubkey,
    /// What's the token that's deposited as collateral, including its fee
    /// settings etc.
    pub component: Pubkey,
    /// How much of the collateral token has been deposited. A user can create
    /// a new receipt every time they borrow against the same component, or
    /// they can update the existing receipt by increasing this amount.
    ///
    /// This amount represents in the lowest decimal place representation, ie
    /// it'd be lamports in case of SOL.
    pub collateral_amount: u64,
    /// How much MIM does the user have to repay, this includes borrow fee and
    /// APR interest.
    ///
    /// This amount represents the lowest decimal place of the stable coin. If
    /// the user owes 10 USP and we have 4 decimal places, this value would be
    /// 10k.
    pub borrowed_amount: SDecimal,
    /// Stable coin interest is APR. We track how much interest has been
    /// payed so far with this value which is increased during repay and
    /// borrow. This allows us to charge the interest on the relevant amount
    /// and at the same time use only one receipt to track all user's borrows
    /// with this type of collateral.
    ///
    /// This amount affects whether we mark receipt as unhealthy. It is repayed
    /// after all borrowed amount is repayed. Same as the borrowed amount.
    pub interest_amount: SDecimal,
    /// Every time a user interacts with receipt, we first calculate interest.
    /// Since the interest is a simple formulate, we can just take the
    /// difference between the last slot and this slot.
    ///
    /// If set to 0, then the receipt hasn't been used yet to borrow stable
    /// coin.
    pub last_interest_accrual_slot: u64,
}

#[derive(Debug, PartialEq)]
pub struct Liquidate {
    pub stable_coin_tokens_to_burn: u64,
    pub liquidator_collateral_tokens: u64,
    pub platform_collateral_tokens: u64,
}

impl Receipt {
    /// Market price of a single token and how much of the loan must be
    /// over-collateralized. Max collateral ratio is in interval (0; 1].
    ///
    /// # Important
    /// The provided market must already be adjusted by mint decimals, ie. if
    /// it's SOL, the market price must be for lamports.
    pub fn is_healthy(
        &self,
        market_price: Decimal,
        max_collateral_ratio: Decimal,
    ) -> Result<bool> {
        let owed = self
            .owed_amount()?
            // get it from the smallest decimal place to 1 stable coin token
            .try_mul(smallest_stable_coin_unit_market_price())?;

        let max_loan_price = self
            .collateral_market_value(market_price)?
            .try_mul(max_collateral_ratio)?;

        Ok(owed <= max_loan_price)
    }

    // TODO: consider returning a custom wrapper type to avoid bugs
    pub fn owed_amount(&self) -> Result<Decimal> {
        self.borrowed_amount
            .to_dec()
            .try_add(self.interest_amount.to_dec())
            .map_err(From::from)
    }

    /// # Important
    /// The provided market must already be adjusted by mint decimals, ie. if
    /// it's SOL, the market price must be in lamports.
    pub fn collateral_market_value(
        &self,
        market_price: Decimal,
    ) -> Result<Decimal> {
        market_price
            .try_mul(self.collateral_amount)
            .map_err(From::from)
    }

    /// Tries to borrow given amount of stable coin. Fails if the borrow value
    /// would grow over a limit given by the max collateral ratio.
    ///
    /// # Important
    /// The provided market must already be adjusted by mint decimals, ie. if
    /// it's SOL, the market price must be in lamports.
    pub fn borrow(
        &mut self,
        config: &ComponentConfig,
        slot: u64,
        amount: u64,
        market_price: Decimal,
    ) -> ProgramResult {
        self.accrue_interest(slot, config.interest.into())?;

        let borrow_fee = config.borrow_fee.to_dec().try_mul(amount)?;
        self.borrowed_amount = self
            .borrowed_amount
            .to_dec()
            .try_add(amount.into())?
            .try_add(borrow_fee)?
            .into();

        if self.is_healthy(market_price, config.max_collateral_ratio.into())? {
            Ok(())
        } else {
            msg!("Cannot borrow {} stable coin tokens", amount);
            Err(ErrorCode::BorrowTooLarge.into())
        }
    }

    /// Repays given amount of stable coin tokens. If the given amount to repay
    /// is more than what's owed, then the resulting u64 is going to be less
    /// than the input max amount. Otherwise the two will equal.
    ///
    /// In another words, returned number says how many tokens were actually
    /// used to repay the debt, and that's the number which should be burned
    /// from user's wallet.
    pub fn repay(
        &mut self,
        config: &ComponentConfig,
        slot: u64,
        max_amount_to_repay: Decimal,
    ) -> Result<Decimal> {
        self.accrue_interest(slot, config.interest.into())?;

        let owed = self.owed_amount()?;
        let interest = self.interest_amount.to_dec();

        if max_amount_to_repay <= interest {
            // 1. max amount is enough to just repay some/all of interest
            //      amount, but no borrow
            self.interest_amount =
                interest.try_sub(max_amount_to_repay)?.into();
            Ok(max_amount_to_repay)
        } else if max_amount_to_repay < owed {
            // 2. max amount is enough to repay all of interest amount and
            //      some of borrowed
            let remove_from_borrowed_amount =
                max_amount_to_repay.try_sub(interest)?;
            self.interest_amount = Decimal::zero().into();
            self.borrowed_amount = self
                .borrowed_amount
                .to_dec()
                .try_sub(remove_from_borrowed_amount)?
                .into();
            Ok(max_amount_to_repay)
        } else {
            // 3. max a mount is enough to repay everything
            self.borrowed_amount = Decimal::zero().into();
            self.interest_amount = Decimal::zero().into();
            Ok(owed)
        }
    }

    /// Repays user's loan by calculating how many stable coin tokens to burn
    /// (and removing that amount from the receipt) and calculates how much
    /// collateral (at a discounted price) should be given in return (and
    /// deducts the collateral from the receipt.)
    ///
    /// # Important
    /// The provided market must already be adjusted by mint decimals, ie. if
    /// it's SOL, the market price must be in lamports.
    pub fn liquidate(
        &mut self,
        config: &ComponentConfig,
        slot: u64,
        market_price: Decimal,
    ) -> Result<Liquidate> {
        if self.is_healthy(market_price, config.max_collateral_ratio.into())? {
            msg!(
                "Cannot liquidate healthy receipt, \
                owed amount is {} UAC and collateral is {} UAC",
                self.owed_amount()?
                    .try_mul(smallest_stable_coin_unit_market_price())?,
                self.collateral_market_value(market_price)?
            );
            return Err(ErrorCode::CannotLiquidateHealthyReceipt.into());
        }

        let discounted_market_price = market_price.try_sub(
            market_price.try_mul(config.liquidation_bonus.to_dec())?,
        )?;

        // repay the loan with at most value of the collateral in stable coin
        //
        // while 1 stable coin's market price = Decimal::one(), we work with the
        // smallest denomination which is given by the number of decimal places
        let max_repay_uac = Decimal::from(self.collateral_amount)
            .try_mul(discounted_market_price)?;
        let stable_coin_tokens_liquidated = self.repay(
            config,
            slot,
            // we must scale it because repay works with the smallest unit,
            // which is given by the decimal places
            max_repay_uac.try_div(smallest_stable_coin_unit_market_price())?,
        )?;

        // give the liquidator the tokens at a discounted price
        let eligible_collateral_tokens = stable_coin_tokens_liquidated
            // must be scaled down because the repay function returns the
            // smallest denomination, while we work with UAC here
            .try_mul(smallest_stable_coin_unit_market_price())?
            .try_div(discounted_market_price)?
            .try_floor_u64()?
            .max(1);
        // but some of those will go to the admin
        let platform_cut = Decimal::from(eligible_collateral_tokens)
            .try_mul(
                config
                    .platform_liquidation_fee
                    .to_dec()
                    .try_mul(config.liquidation_bonus.to_dec())?,
            )?
            .try_round_u64()?;

        // and takes those tokens from the user
        self.collateral_amount = self
            .collateral_amount
            .checked_sub(eligible_collateral_tokens)
            .ok_or(ErrorCode::MathOverflow)?;

        Ok(Liquidate {
            stable_coin_tokens_to_burn: stable_coin_tokens_liquidated
                .try_ceil_u64()?,
            liquidator_collateral_tokens: eligible_collateral_tokens
                .checked_sub(platform_cut)
                .ok_or(ErrorCode::MathOverflow)?,
            platform_collateral_tokens: platform_cut,
        })
    }

    pub fn accrue_interest(
        &mut self,
        slot: u64,
        interest_rate: Decimal,
    ) -> ProgramResult {
        if self.last_interest_accrual_slot == 0 {
            self.last_interest_accrual_slot = slot;
            return Ok(());
        } else if slot <= self.last_interest_accrual_slot {
            return Ok(());
        }

        let accrue_for_slots = slot - self.last_interest_accrual_slot;

        self.interest_amount = self
            .interest_amount
            .to_dec()
            .try_add(
                self.borrowed_amount
                    .to_dec()
                    .try_mul(interest_rate)?
                    .try_div(borrow_lending::prelude::consts::SLOTS_PER_YEAR)?
                    .try_mul(accrue_for_slots)?,
            )?
            .into();

        self.last_interest_accrual_slot = slot;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;

    #[test]
    fn it_calculates_whether_receipt_is_healthy() {
        let receipt = Receipt {
            collateral_amount: 2,
            borrowed_amount: Decimal::from(2u64)
                .try_div(smallest_stable_coin_unit_market_price())
                .unwrap()
                .into(),
            interest_amount: Decimal::from(1u64)
                .try_div(smallest_stable_coin_unit_market_price())
                .unwrap()
                .into(),
            ..Default::default()
        };

        assert_eq!(
            receipt.owed_amount(),
            Ok(Decimal::from(3u64)
                .try_div(smallest_stable_coin_unit_market_price())
                .unwrap())
        );

        // (5 * 2) * 0.9 > 3
        assert_eq!(
            Ok(true),
            receipt.is_healthy(5u64.into(), Decimal::from_percent(90u64))
        );

        // (5 * 2) * 0.1 < 3
        assert_eq!(
            Ok(false),
            receipt.is_healthy(5u64.into(), Decimal::from_percent(10u64))
        );

        // (100 * 2) * 0.1 > 3
        assert_eq!(
            Ok(true),
            receipt.is_healthy(100u64.into(), Decimal::from_percent(10u64))
        );
    }

    #[test]
    fn it_borrows() {
        let last_interest_accrual_slot = 100;

        let config = ComponentConfig {
            interest: Decimal::from_percent(50u64).into(),
            borrow_fee: Decimal::from_percent(10u64).into(),
            max_collateral_ratio: Decimal::from_percent(90u64).into(),
            ..Default::default()
        };

        let mut receipt = Receipt {
            collateral_amount: 100,
            interest_amount: Decimal::one().into(),
            borrowed_amount: Decimal::one().into(),
            last_interest_accrual_slot,
            ..Default::default()
        };

        // first let's see how it acts when we skip interest accrual
        let owed_before =
            receipt.owed_amount().unwrap().try_round_u64().unwrap();
        receipt
            .borrow(
                &config,
                last_interest_accrual_slot,
                50,
                Decimal::from(100u64),
            )
            .unwrap();
        assert_eq!(
            receipt.owed_amount().unwrap(),
            Decimal::from(
                50u64 // borrow amount
            + 5 // borrow fee
            + owed_before
            )
        );

        // now let's accrue interest
        let owed_before =
            receipt.owed_amount().unwrap().try_round_u64().unwrap();
        receipt
            .borrow(
                &config,
                last_interest_accrual_slot
                    + borrow_lending::prelude::consts::SLOTS_PER_YEAR,
                50,
                Decimal::from(1_000u64),
            )
            .unwrap();
        assert_eq!(
            receipt.owed_amount().unwrap().try_round_u64(),
            Decimal::from(
                50u64 // borrow amount
                + 5 // borrow fee
                + owed_before / 2 // interest is 50%
                + owed_before
            )
            .try_round_u64()
        );
        assert_eq!(
            receipt.last_interest_accrual_slot,
            last_interest_accrual_slot
                + borrow_lending::prelude::consts::SLOTS_PER_YEAR
        );

        // cannot borrow if unhealthy
        let mut receipt = Receipt {
            collateral_amount: 100,
            interest_amount: Decimal::zero().into(),
            borrowed_amount: Decimal::zero().into(),
            last_interest_accrual_slot,
            ..Default::default()
        };
        assert_eq!(
            receipt.borrow(
                &config,
                receipt.last_interest_accrual_slot,
                150_000000,
                Decimal::from(1u64),
            ),
            Err(ErrorCode::BorrowTooLarge.into())
        );
    }

    #[test]
    fn it_repays() {
        let last_interest_accrual_slot = 100;

        let config = ComponentConfig {
            interest: Decimal::from_percent(50u64).into(),
            max_collateral_ratio: Decimal::from_percent(90u64).into(),
            ..Default::default()
        };

        let mut receipt = Receipt {
            collateral_amount: 100,
            interest_amount: Decimal::from(90u64).into(),
            borrowed_amount: Decimal::from(10u64).into(),
            last_interest_accrual_slot,
            ..Default::default()
        };

        assert_eq!(
            receipt.repay(&config, last_interest_accrual_slot, 75u64.into()),
            Ok(75u64.into())
        );
        assert_eq!(receipt.interest_amount.to_dec().try_round_u64(), Ok(15));
        assert_eq!(receipt.borrowed_amount.to_dec().try_round_u64(), Ok(10));

        assert_eq!(
            receipt.repay(&config, last_interest_accrual_slot, 20u64.into()),
            Ok(20u64.into())
        );
        assert_eq!(receipt.borrowed_amount.to_dec().try_round_u64(), Ok(5));
        assert_eq!(receipt.interest_amount.to_dec().try_round_u64(), Ok(0));

        assert_eq!(
            receipt.repay(&config, last_interest_accrual_slot, u64::MAX.into()),
            Ok(5u64.into())
        );
        assert_eq!(receipt.interest_amount.to_dec().try_round_u64(), Ok(0));
        assert_eq!(receipt.borrowed_amount.to_dec().try_round_u64(), Ok(0));

        receipt.borrowed_amount = Decimal::from(100u64).into();
        receipt.interest_amount = Decimal::from(1u64).into();
        assert_eq!(
            receipt
                .repay(
                    &config,
                    last_interest_accrual_slot
                        + borrow_lending::prelude::consts::SLOTS_PER_YEAR,
                    1_000u64.into()
                )
                .unwrap()
                .try_round_u64()
                .unwrap(),
            100u64 // borrowed amount set before the call
                + 100 / 2 // interest is 50%
                + 1 // interest set before the call
        );
        assert_eq!(receipt.interest_amount.to_dec().try_round_u64(), Ok(0));
        assert_eq!(receipt.borrowed_amount.to_dec().try_round_u64(), Ok(0));
    }

    #[test]
    fn it_liquidates_position_where_collateral_is_worth_more() {
        let last_interest_accrual_slot = 100;

        let config = ComponentConfig {
            interest: Decimal::from_percent(50u64).into(),
            liquidation_bonus: Decimal::from_percent(10u64).into(),
            platform_liquidation_fee: Decimal::from_percent(50u64).into(),
            ..Default::default()
        };

        let mut receipt = Receipt {
            collateral_amount: 100,
            interest_amount: Decimal::from(10_000000u64).into(),
            borrowed_amount: Decimal::from(90_000000u64).into(),
            last_interest_accrual_slot,
            ..Default::default()
        };

        let market_price = Decimal::from(2u64);

        assert_eq!(
            Ok(Liquidate {
                // interest + borrowed
                stable_coin_tokens_to_burn: 100_000000,
                // (interest + borrow) / market_price * fee
                liquidator_collateral_tokens: 52,
                platform_collateral_tokens: 3,
            }),
            receipt.liquidate(
                &config,
                last_interest_accrual_slot,
                market_price
            )
        );
        assert_eq!(receipt.collateral_amount, 45);
        assert_eq!(receipt.borrowed_amount.to_dec(), Decimal::zero());
        assert_eq!(receipt.interest_amount.to_dec(), Decimal::zero());
    }

    #[test]
    fn it_liquidates_position_where_collateral_is_worth_less() {
        let last_interest_accrual_slot = 100;

        let config = ComponentConfig {
            liquidation_bonus: Decimal::from_percent(10u64).into(),
            platform_liquidation_fee: Decimal::from_percent(50u64).into(),
            ..Default::default()
        };

        let mut receipt = Receipt {
            collateral_amount: 10,
            interest_amount: Decimal::from(10_000000u64).into(),
            borrowed_amount: Decimal::from(90_000000u64).into(),
            last_interest_accrual_slot,
            ..Default::default()
        };

        let market_price = Decimal::from(2u64);

        assert_eq!(
            Ok(Liquidate {
                // collateral amount * fee
                stable_coin_tokens_to_burn: 18_000000,
                // collateral amount
                liquidator_collateral_tokens: 9,
                platform_collateral_tokens: 1,
            }),
            receipt.liquidate(
                &config,
                last_interest_accrual_slot,
                market_price
            )
        );
        assert_eq!(receipt.collateral_amount, 0);
        assert_eq!(receipt.interest_amount.to_dec(), Decimal::zero());
        assert_eq!(
            receipt.borrowed_amount.to_dec(),
            Decimal::from(90_000000u64 - 8_000000)
        );
    }

    proptest! {
        #[test]
        fn it_proptests_is_healthy(
            collateral_amount in 0..=u64::MAX,
            borrowed_amount in 0..=u64::MAX,
            interest_amount in 0..=u64::MAX,
            market_price in 0..=u64::MAX,
            ratio in 1..=100u64,
        ) {
            let receipt = Receipt {
                collateral_amount,
                borrowed_amount: Decimal::from(borrowed_amount).into(),
                interest_amount: Decimal::from(interest_amount).into(),
                ..Default::default()
            };

            if borrowed_amount.checked_add(interest_amount).is_some() {
                let owed = receipt.owed_amount().unwrap();
                assert_eq!(
                    owed,
                    Decimal::from(borrowed_amount + interest_amount)
                );

                let collateral_market_price =
                    Decimal::from(market_price).try_div(1_000).unwrap();
                if let Ok(total_collateral_market_price) =
                    collateral_market_price
                        .try_mul(Decimal::from(collateral_amount))
                {
                    // (collateral_amount * market_price) * col_to_loan >
                    // borrowed
                    assert_eq!(
                        Ok(total_collateral_market_price
                            .try_mul(Decimal::from_percent(ratio))
                            .unwrap()
                            >= owed),
                        receipt.is_healthy(
                            collateral_market_price,
                            Decimal::from_percent(ratio)
                        )
                    );
                }
            }
        }
    }
}
