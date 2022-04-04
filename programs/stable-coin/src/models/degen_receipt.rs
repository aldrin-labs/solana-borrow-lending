use crate::prelude::*;

#[account(Derive)]
pub use DegenReceipt {
    /// The user who opened this position.
    pub borrower: Pubkey,
    /// The associated strategy account.
    pub degen_strategy: Pubkey,
    /// The user comes with certain amount of UST to this strategy. We convert
    /// those to aUST using the latest ratio at the moment of deposit.
    pub deposited_aust: u64,
    /// If user comes to our strategy with 100 UST and 4x leverage, this value
    /// would be 300 UST converted to aUST using the latest ratio at the moment
    /// of deposit.
    pub borrowed_aust: u64,
    /// What's the ratio that's been used to convert from UST to aUST.
    pub aust_ratio_at_creation: SDecimal,
}
