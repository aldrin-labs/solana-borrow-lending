pub use crate::accounts::*;
pub use crate::math::*;
pub use crate::models::*;
pub use anchor_lang::prelude::*;

pub mod consts {
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
}

#[error]
pub enum ErrorCode {
    #[msg("Provided owner does not match the market owner")]
    InvalidMarketOwner,
    #[msg("Operation would result in an overflow")]
    MathOverflow,
    #[msg("Provided configuration isn't in the right format or range")]
    InvalidConfig,
    #[msg("Provided oracle configuration isn't in the right format or range")]
    InvalidOracleConfig,
    #[msg(
        "Cannot read oracle Pyth data because they have an unexpected format"
    )]
    InvalidOracleDataLayout,
    #[msg("Provided amount is in invalid range")]
    InvalidAmount,
    #[msg("Provided accounts don't satisfy requirements")]
    InvalidAccountInput,
    #[msg("Operation cannot be performed due to insufficient funds")]
    InsufficientFunds,
}
