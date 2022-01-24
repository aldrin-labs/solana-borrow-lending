pub use crate::accounts::*;
pub use crate::err::{self, Error, ErrorCode, Result};
pub use crate::math::*;
pub use crate::models::*;
pub use anchor_lang::prelude::*;

pub mod consts {
    use super::PercentageInt;
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
    ///
    /// TBD: https://gitlab.com/crypto_project/clockwork/borrow-lending/-/issues/30
    pub const ORACLE_STALE_AFTER_SLOTS_ELAPSED: u64 = 20;

    /// Collateral tokens are initially valued at a ratio of 1:1
    /// (collateral:liquidity).
    ///
    /// It doesn't really matter what the initial ration is, as math works with
    /// any and the ratio will eventually drift due to interest accrual.
    /// A decision to set it to 1:1 was made on borrow lending catch up call on
    /// 20th December 2021.
    pub const INITIAL_COLLATERAL_RATIO: u64 = 1;

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

    /// Percentage of an obligation that can be repaid during each liquidation
    /// call. After the call, there're fewer borrowed assets than collateral
    /// because the collateral has been sold for liquidity at a discounted
    /// rate.
    pub const LIQUIDATION_CLOSE_FACTOR: PercentageInt = PercentageInt::new(50);

    /// Obligation borrow amount that is small enough to close out.
    pub const LIQUIDATION_CLOSE_AMOUNT: u64 = 2;

    /// > The current implementation sets block time to 800ms. From: https://docs.solana.com/cluster/synchronization
    ///
    /// # Opening
    /// While having as fresh prices as possible for vanilla borrowing is vital,
    /// here we can allow some slippage of a few seconds as a tradeoff. The
    /// tradeoff is transaction size. Simply put, there is no way we can
    /// interact with AMM and touch all those accounts we need, if we are
    /// required to refresh reserves in the same transaction. In order to
    /// implement this feature for more than 2 reserves, this tradeoff is a
    /// must. It's not risky to allow this tradeoff because the funds never
    /// actually reach the borrower possession. If they found a way to exploit
    /// the allowed delay, that would mean they could create their position
    /// with collateral which instead of covering e.g. 1/3 in case of 3x
    /// leverage, would cover less due to a sudden market fluctuation. However,
    /// their position will be liquidated the very next moment and they cannot
    /// run away with the funds because closing a position requires repaying
    /// based on amount, not market price. Therefore, no funds are lost to the
    /// BLp.
    ///
    /// # Closing
    /// It would seem that we don't need to refresh obligation at the first
    /// glance, but we do because we need to calculate latest interest.
    /// However, we only need to do this in the last ~N blocks, not
    /// necessarily in the same transaction. Thanks to that we can ignore
    /// the problem of how many reserves can be refreshed at once in
    /// [`crate::endpoints::leverage_farming::aldrin::close`]
    /// endpoint, and all that matters is how many reserves can be refreshed
    /// at once in [`crate::endpoints::leverage_farming::aldrin::open`]
    /// endpoint.
    pub const MAX_OBLIGATION_REFRESH_BLOCKS_ELAPSED_FOR_LEVERAGED_POSITION:
        u64 = 10;

    pub const MAX_UTILIZATION_RATE: PercentageInt = PercentageInt::new(95);
}
