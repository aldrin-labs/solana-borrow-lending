pub use crate::accounts::*;
pub use crate::err::{self, ErrorCode};
pub use crate::math::*;
pub use crate::models::*;
pub use anchor_lang::prelude::*;

pub mod consts {
    use anchor_lang::solana_program::clock::{
        DEFAULT_TICKS_PER_SECOND, DEFAULT_TICKS_PER_SLOT, SECONDS_PER_DAY,
    };

    /// Scale of precision.
    pub const SCALE: usize = 18;

    /// Identity
    pub const WAD: u64 = 1_000_000_000_000_000_000;

    pub const HALF_WAD: u64 = WAD / 2;

    pub const PERCENT_SCALER: u64 = 10_000_000_000_000_000;

    /// Number of slots to consider market prices stale after.
    pub const MARKET_STALE_AFTER_SLOTS_ELAPSED: u64 = 1;

    /// Number of slots to consider oracle provided info stale after.
    pub const ORACLE_STALE_AFTER_SLOTS_ELAPSED: u64 = 5;

    /// Collateral tokens are initially valued at a ratio of 5:1
    /// (collateral:liquidity) TODO: why?
    pub const INITIAL_COLLATERAL_RATIO: u64 = 5;

    pub const INITIAL_COLLATERAL_RATE: u64 = INITIAL_COLLATERAL_RATIO * WAD;

    /// The compound interest is calculated by defining the period to be one
    /// slot. However, the borrow rate is defined as per year. So we estimate
    /// the number of slots a year to use in our math.
    pub const SLOTS_PER_YEAR: u64 = DEFAULT_TICKS_PER_SECOND
        / DEFAULT_TICKS_PER_SLOT
        * SECONDS_PER_DAY
        * 365;

    /// How many borrows from unique reserves + collaterals to unique reserves
    /// can an obligation have at most.
    ///
    /// It'd be amazing to have this as const generic type. However, before that
    /// can be done, three things have to be implemented upstream:
    /// - <https://github.com/project-serum/anchor/issues/617>
    /// - <https://github.com/project-serum/anchor/issues/632>
    /// - borsh "const-generics" feature must be exported
    pub const MAX_OBLIGATION_RESERVES: usize = 10;
}
