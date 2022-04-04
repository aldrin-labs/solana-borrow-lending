use crate::prelude::*;

#[account]
pub struct DegenStrategy {
    /// The account which has authority to call admin endpoints such as
    /// updating the interest ratio between aUST and UST.
    pub admin: Pubkey,
    /// The stable coin which is associated with this degen strategy. This is
    /// also what determines the admin bot account which has privileges to
    /// update the interest bearing's token ratio and move funds.
    pub stable_coin: Pubkey,
    /// The address of the wallet in which we store UST funds.
    pub ust_wallet: Pubkey,
    /// The current ratio between UST and aUST. If 1 UST = 2 aUST, then this
    /// value will be 2. This value is periodically updated by an admin bot.
    pub aust_ratio: SDecimal,
    /// If user gives us 100 UST with 4x leverage, we mint 300 USP which are
    /// swapped into UST, so in the end there are 400 UST to work with. This
    /// value limits the leverage user can use.
    pub max_leverage: SDecimal,
    /// Because not all the UST funds which users deposit are actually staked
    /// in anchor, but only some fraction (e.g. 90%), we need to scale down
    /// the earns per user by this fraction, otherwise we'd run out of UST.
    ///
    /// # Example
    /// If user deposited 100 UST which were equal to 100 aUST and after 5
    /// days, 100 aUST is worth 110 UST, then the user is eligible for
    /// `100 + earned_interest_penalty * (110 - 100)` UST.
    pub earned_interest_penalty: SDecimal,
}
