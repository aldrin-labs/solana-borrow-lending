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
    pub last_interest_accrual_slot: u64,
}
