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

        price.try_mul(max_collateral_ratio).map_err(From::from).map(
            |max_loan_price| self.borrowed_amount.to_dec() <= max_loan_price,
        )
    }

    pub fn collateral_price(&self, market_price: Decimal) -> Result<Decimal> {
        market_price
            .try_mul(self.collateral_amount)
            .map_err(From::from)
    }
}
