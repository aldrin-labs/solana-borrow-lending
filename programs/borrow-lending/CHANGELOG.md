# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [4.0.0] - 2022-05-08
### Changed
- Upgraded anchor to `0.24.2` and solana to `1.9.18`.


## [3.2.0] - 2022-03-28

### Changed
- Logic for CPI calls to Aldrin's AMM has been extracted to a crate called
  `cpis` for the purpose of reuse with stable coin program.


## [3.1.0] - 2022-02-21

### Added
- Two endpoints which works directly with Aldrin's AMM and allow us to create a
  reserve with a pools LP token. The LP token is not available in oracle's, but
  its price can be derived from constituent tokens and the amount of minted LP
  tokens. Create a new reserve with `init_reserve_aldrin_unstable_lp_token` and
  then refresh its market price with
  `refresh_reserve_aldrin_unstable_lp_token`.


## [3.0.0] - 2022-02-16

### Changed
- Upgraded from anchor v0.20 to v0.21.
- `FarmingReceipt` is now `AldrinFarmingReceipt`, we dropped `amm` field and
  added `ticket` field. Field `obligation` was renamed to `owner` and `reserve`
  to `association`.

### Added
- Vaults feature endpoints `open_vault_position_on_aldrin` and
  `close_vault_position_on_aldrin`. This feature stakes LP tokens (no borrow)
  and allows the user to take advantage of auto compounding.
- `LendingMarket` has new pubkey field `aldrin_amm`. See below why.

### Fixed
- Closing a leverage position now checks for correct farming receipt. This
  prevents state drift which would otherwise make it hard to find all users
  positions.
- **`CRITICAL`** Endpoint `open_leveraged_farming_position_on_aldrin` takes as
  as an input an executable account for Aldrin's AMM so that we can perform CPI
  and stake the borrowed funds with leverage. However, BLp did not check the
  program ID. Therefore, an attacker could provide their own version of AMM
  which just extracted the leveraged funds, and used some of them as collateral
  to borrow again with leverage. Rinse and repeat. New constraint checks that
  the AMM program ID matches lending market's defined one.


## [2.0.0] - 2022-02-04
### Added
- Account types for liquidity mining: `EmissionStrategy` and
  `ReserveCapSnapshots`.
- Endpoints for liquidity mining: admin endpoints `create_emission`,
  `close_emission`, user endpoint `claim_emission` and admin bot endpoint
  `take_reserve_cap_snapshot`.
- `ObligationCollateral` and `ObligationLiquidity` have a new field to track
  when have they been last updated or claimed. This allows us to calculate how
  many emission tokens is a user eligible for.
- `Reserve` has a new field with a pubkey of the snapshotting account associated
  with it.

### Changed
- When borrowing or repaying, the relevant methods now accept slot as additional
  argument so that their can update `emissions_claimable_from_slot` field.
- The field `compound_bot` on `LendingMarket` was renamed to `admin_bot`.
- Calculation of `SLOTS_PER_YEAR` was changed to be similar to Solend.
  See the discussion at https://github.com/solana-labs/solana-program-library/issues/2825
  for more information.
- `MAX_OBLIGATION_REFRESH_BLOCKS_ELAPSED_FOR_LEVERAGED_POSITION`
  was renamed to `MAX_OBLIGATION_REFRESH_SLOTS_ELAPSED_FOR_LEVERAGED_POSITION`
  because it did in fact represent slots, not blocks. The value was doubled
  with accordance of block being ~2x longer than slots in terms of millis.
- Function for parsing obligation data from TS now includes the newly added
  fields.

## [1.0.0] - 2022-01-24
### Added
- Leverage yield farming endpoints (see README for docs) which `open`, `close`
  and `compound` leveraged position on Aldrin. `compound` endpoint can be also
  use for position without leverage. It's seed agnostic, meaning that there are
  no assumptions made about the PDA which owns the farming ticket. Whereas in
  `open` and `close`, the PDA is always constructed with lending market, reserve,
  obligation and leverage data.
- Condition which prevents any borrow if the reserve's utilization should go
  over 95%.
- `Pubkey` of compound bot and `SDecimal` of minimal collateral value in UAC to
  `LendingMarket` type.
- `ReserveConfig` now has additional `maxLeverage` settings, and also new fee
  `leverageFee`, which at the moment doesn't do anything, because fee logic has
  been removed for now due to compute unit limit.
- `Reserve` has additional `SDecimal` field `accrued_interest` which is a
  monotonically increased UAC value of interest collected on borrows.
- Endpoint to update lending market configuration with `update_lending_market`.
- Endpoint to update reserve configuration with `update_reserve_config`.
- Account `FarmingReceipt` which is created when a new leveraged position is
  opened, and closed when an existing position is closed. It helps us keep track
  of running leveraged positions for UI discovery and liquidation.

### Changed
- `Obligation` is now zero copy. However, anchor doesn't correctly represent
  enum in arrays with zero copy and there still seems to be some offset. Due
  to this issue, we use a _custom_ deserialization function on frontend when
  fetching obligation data. See `fromBytesSkipDiscriminatorCheck` method
  in the `obligation.ts` file.
- Endpoint `repay_obligation_liquidity` now accepts another argument for
  leverage.
- Endpoint `liquidate_obligation` now accepts another argument for leverage.
- Staleness of an oracle account can now be up to 20 blocks, instead of
  previous 5.
- Obligation no longer has `borrowed_value` field. This field has been divided
  into `collateralized_borrow_value` and `total_borrowed_value`. The former is
  UAC of how much must obligation collateral cover. The latter is the overall
  value of the loan. These two will differ only with a leveraged position.

### Removed
- The necessity for reserve refresh when depositing collateral into obligation.


## [0.4.0] - 2021-12-21

### Removed
- The `LendingMarket` account type now longer contains oracle program id. This
  is because it bore no value for correctness. We used it in `init_reserve` to
  check that an account provided as oracle price and product belong to that
  oracle program id. But there still is potential for error by using a wrong
  price account. Therefore, the market owner is still responsible for providing
  correct account. By removing the oracle program id from lending market, we can
  more easily support multiple oracle methods.

### Changed
- `Obligation` order of properties changed to put the owner key as the first
  property. This change makes it easier to filter for BLp accounts belonging
  to a user by reducing the offset to a mere 8 byte hash.
- `ReserveLiquidity` changed property `oracle` type from pubkey to an enum. This
  will allow us to use different oracle systems in future without migrating accounts.

## [0.3.0] - 2021-12-20

### Changed
- Initial reserve's collateral to liquidity ratio was changed to 1:1 from 5:1.

## [0.2.0] - 2021-12-17

### Added
- Flash loan endpoint which allows a tech savvy user to borrow any amount of
  liquidity. Design inspired by
  [Solana labs implementation](https://github.com/solana-labs/solana-program-library/blob/a6a1ce4290ad683e13b9ef1c52d6f32a080a996f/token-lending/program/src/processor.rs#L1521).
- Endpoint to toggle flash loans feature. Flash loans are by default disabled.

## [0.1.1] - 2021-12-14

### Fixed
- A critical bug due to rounding in exchange collateral methods which would
  allow an attacker to steal BTC and ETH reserves. Additional information about
  the bug can be found [here](https://blog.neodyme.io/posts/lending_disclosure)
  and the upstream fix PR is
  [here](https://github.com/solana-labs/solana-program-library/pull/1883/files)

