use crate::prelude::*;

#[account]
pub struct Receipt {
    /// The pubkey of the user who "owns" this receipt.
    pub borrower: Pubkey,
    /// What's the token that's deposited as collateral, including its fee
    /// settings etc.
    pub component: Pubkey,
    /// How much of the collateral token has been deposited. A user can create
    /// a new receipt every time they borrow against the same component, or
    /// they can update the existing receipt by increasing this amount.
    pub collateral_amount: u64,
    /// How much MIM does the user have to repay, this includes borrow fee and
    /// APY interest.
    pub borrowed_amount: SDecimal,
    /// Stable coin interest is APR. We track how much interest has been
    /// payed so far with this value which is increased during repay and
    /// borrow. This allows us to charge the interest on the relevant amount
    /// and at the same time use only one receipt to track all user's borrows
    /// with this type of collateral.
    ///
    /// This amount affects whether we mark receipt as unhealthy. It is repayed
    /// after all borrowed amount is repayed.
    pub interest_amount: SDecimal,
    /// Every time a user interacts with receipt, we first calculate interest.
    /// Since the interest is a simple formulate, we can just take the
    /// difference between the last slot and this slot.
    ///
    /// If set to 0, then the receipt hasn't been used yet to borrow stable
    /// coin.
    pub last_interest_accrual_slot: u64,
}

impl Receipt {
    /// Market price of a single token and how much of the loan must be
    /// over-collateralized. Max collateral ratio is in interval (0; 1].
    pub fn is_healthy(
        &self,
        market_price: Decimal,
        max_collateral_ratio: Decimal,
    ) -> Result<bool> {
        let price = self.collateral_price(market_price)?;
        let owed = self.owed_amount()?;

        price
            .try_mul(max_collateral_ratio)
            .map_err(From::from)
            .map(|max_loan_price| owed <= max_loan_price)
    }

    pub fn owed_amount(&self) -> Result<Decimal> {
        self.borrowed_amount
            .to_dec()
            .try_add(self.interest_amount.to_dec())
            .map_err(From::from)
    }

    pub fn collateral_price(&self, market_price: Decimal) -> Result<Decimal> {
        market_price
            .try_mul(self.collateral_amount)
            .map_err(From::from)
    }

    /// Tries to borrow given amount of stable coin. Fails if the borrow value
    /// would grow over a limit given by the max collateral ratio.
    ///
    /// The stable coin market price is 1.00
    pub fn borrow(
        &mut self,
        config: &ComponentConfiguration,
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
        config: &ComponentConfiguration,
        slot: u64,
        max_amount_to_repay: u64,
    ) -> Result<u64> {
        self.accrue_interest(slot, config.interest.into())?;

        let owed = self.owed_amount()?;
        let max_amount_to_repay_dec = Decimal::from(max_amount_to_repay);
        let borrowed = self.borrowed_amount.to_dec();

        if max_amount_to_repay_dec <= borrowed {
            // 1. max amount is enough to just repay some/all of borrowed
            //      amount, but no interest
            self.borrowed_amount =
                borrowed.try_sub(max_amount_to_repay.into())?.into();
            Ok(max_amount_to_repay)
        } else if max_amount_to_repay_dec < owed {
            // 2. max amount is enough to repay all of borrowed amount and
            //      some of interest
            let remove_from_interest =
                max_amount_to_repay_dec.try_sub(borrowed)?;
            self.borrowed_amount = Decimal::zero().into();
            self.interest_amount = self
                .interest_amount
                .to_dec()
                .try_sub(remove_from_interest)?
                .into();
            Ok(max_amount_to_repay)
        } else {
            // 3. max a mount is enough to repay everything
            self.borrowed_amount = Decimal::zero().into();
            self.interest_amount = Decimal::zero().into();
            Ok(owed.try_ceil_u64()?)
        }
    }

    pub fn accrue_interest(
        &mut self,
        slot: u64,
        interest_rate: Decimal,
    ) -> ProgramResult {
        if slot <= self.last_interest_accrual_slot {
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
