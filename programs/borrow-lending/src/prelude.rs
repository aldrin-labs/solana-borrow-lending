pub use crate::accounts::*;
pub use crate::err::{self, ErrorCode};
pub use crate::math::{self, *};
pub use crate::models::{self, *};
pub use anchor_lang::prelude::*;

pub mod consts {
    use super::PercentageInt;
    use anchor_lang::solana_program::clock::SECONDS_PER_DAY;

    /// Number of slots to consider market prices stale after.
    pub const MARKET_STALE_AFTER_SLOTS_ELAPSED: u64 = 1;

    /// Number of slots to consider oracle provided info stale after.
    ///
    /// TBD: <https://gitlab.com/crypto_project/perk/borrow-lending/-/issues/30>
    pub const ORACLE_STALE_AFTER_SLOTS_ELAPSED: u64 = 20;

    /// Collateral tokens are initially valued at a ratio of 1:1
    /// (collateral:liquidity).
    ///
    /// It doesn't really matter what the initial ration is, as math works with
    /// any and the ratio will eventually drift due to interest accrual.
    /// A decision to set it to 1:1 was made on borrow lending catch up call on
    /// 20th December 2021.
    pub const INITIAL_COLLATERAL_RATIO: u64 = 1;
    pub const INITIAL_COLLATERAL_RATE: u64 =
        INITIAL_COLLATERAL_RATIO * decimal::consts::WAD;

    /// A slot should be ~400ms, but most of the time it fluctuates up to 600ms
    /// so on average we get 2 slots a second. One can confirm that average
    /// tends to be 2 slots a second on the
    /// [explorer](https://explorer.solana.com).
    pub const SLOTS_PER_SECOND: u64 = 2;
    /// The compound interest is calculated by defining the period to be one
    /// slot. However, the borrow rate is defined as per year. So we estimate
    /// the number of slots a year to use in our math.
    ///
    /// Due to an integer division issue, this is the same value as in the
    /// [solana teams implementation][solana-spl] and in the [Solend][solend].
    ///
    /// [solana-spl]: https://github.com/solana-labs/solana-program-library/blob/c781067b2b3196e883304de03f9fe131e698cb03/token-lending/program/src/state/mod.rs#L33
    /// [solend]: https://github.com/solendprotocol/solana-program-library/blob/920a44995d73bba8598841b07258061f29c2b1eb/token-lending/program/src/state/mod.rs#L30
    pub const SLOTS_PER_YEAR: u64 = SLOTS_PER_SECOND * SECONDS_PER_DAY * 365;

    /// We give the user up to 1 week to collect their emissions from previous
    /// liquidity mining period.
    pub const SLOTS_PER_WEEK: u64 = SLOTS_PER_SECOND * SECONDS_PER_DAY * 7;

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

    /// > The minimum slot time is 400ms. \ From: <https://solanabeach.io/glossary>
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
    /// However, we only need to do this in the last ~N slots, not
    /// necessarily in the same transaction. Thanks to that we can ignore
    /// the problem of how many reserves can be refreshed at once in
    /// [`crate::endpoints::amm::aldrin::close_leveraged_position_on_aldrin`]
    /// endpoint, and all that matters is how many reserves can be refreshed
    /// at once in
    /// [`crate::endpoints::amm::aldrin::open_leveraged_position_on_aldrin`]
    /// endpoint.
    pub const MAX_OBLIGATION_REFRESH_SLOTS_ELAPSED_FOR_LEVERAGED_POSITION: u64 =
        20;

    pub const MAX_UTILIZATION_RATE: PercentageInt = PercentageInt::new(95);

    /// How many snapshots into the past do we hold. Since snapshots are a
    /// ring buffer, eventually we will be overwriting it.
    ///
    /// If we take a snapshot once an hour, this takes ~41 days to repeat.
    pub const SNAPSHOTS_COUNT: usize = 1000;

    /// How many different mints can be emitted for 1 reserve.
    pub const EMISSION_TOKENS_COUNT: usize = 5;
}
