pub use crate::accounts::*;
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
}

#[error]
pub enum ErrorCode {
    #[msg("Provided owner does not match the market owner")]
    InvalidMarketOwner, // 300
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
    #[msg("Reserve account needs to be refreshed")]
    ReserveStale,
}

pub mod err {
    use super::*;

    pub fn acc(msg: impl AsRef<str>) -> ProgramError {
        msg!("[InvalidAccountInput] {}", msg.as_ref());

        ProgramError::InvalidAccountData
    }

    pub fn reserve_stale() -> ProgramError {
        msg!("[ReserveStale] Account needs to be refreshed");

        ErrorCode::ReserveStale.into()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use anchor_lang::solana_program::program_error::ProgramError;

    #[test]
    fn test_error_conversion() {
        assert_eq!(
            ProgramError::Custom(300),
            ErrorCode::InvalidMarketOwner.into()
        );
    }
}
