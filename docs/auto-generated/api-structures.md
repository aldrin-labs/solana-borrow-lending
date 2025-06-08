# API Structures Reference
Comprehensive reference for all data structures used in the protocol.
## Account Structures
### LendingMarket
**Location**: `models/lending_market.rs:1`
**Attributes**: `account, derive(Default)`
**Size Calculation**:
```rust
292
```
**Fields**:
- `owner: Pubkey`
- `enable_flash_loans: bool`
- `admin_bot: Pubkey` - endpoint, the take reserve cap snapshot endpoint, etc.
- `aldrin_amm: Pubkey` - for vaults.
- `leveraged_compound_fee: PercentageInt` - compounding leveraged position.
- `vault_compound_fee: PercentageInt` - How much of the collected reward is claimed on vault's compounding.
- `min_collateral_uac_value_for_leverage: SDecimal` - UAC must be at least this much.
- `currency: UniversalAssetCurrency`
- `_padding: [u64; 16]` - implementation for values larger than 32.

### AldrinFarmingReceipt
**Location**: `models/farming_receipt.rs:9`
**Attributes**: `account`
**Fields**:
- `owner: Pubkey` - wallet pubkey in case of vaults.
- `association: Pubkey` - the AMM pool pubkey in case of vaults.
- `ticket: Pubkey` - The pubkey of the farming ticket this receipt represents.
- `leverage: Leverage` - This will is 1x in case of vaults.

## Data Structures
### ReserveCap
**Location**: `models/emissions.rs:3`
We define how many tokens per slot should be distributed in total, meaning
that all users together are eligible for this many tokens per slot. Each
user will get a fraction of this amount based on their reserve pool
participation. This is separated for lenders and borrowers.
Some of these tokens can be empty, which will is presented by using
[`Pubkey::default`] as the emitted token's wallet.

This number must be equal to [`consts::EMISSION_TOKENS_COUNT`]. The
unit tests will fail if it doesn't. Unfortunately, anchor currently
doesn't support const parametrization, so we must hard code this.
If a loan/deposit was opened before this slot, it will provide no
additional emitted tokens.
No emissions are given beyond this slot.
User must wait at least this long to claim their emitted rewards.
Wallet which BLp has access to and distributes tokens from.
Translates to APR for borrow
Translates to APR for deposit
Zero-copy account for reserve capacity snapshots using ring buffer pattern.

This structure maintains a time-series of reserve capacity data to enable
efficient emissions calculations and historical analysis. The ring buffer
allows constant-time insertions and efficient time-range queries.

# Memory Layout
- Total size: ~24KB (1000 snapshots × 24 bytes each + metadata)
- Alignment: 8-byte aligned for optimal performance
- Zero-copy: Enables direct memory access without deserialization

# Performance Benefits
- Compute unit savings: ~97% reduction vs. full deserialization
- Memory efficiency: No heap allocations for time-series data
- Query optimization: Binary search over time ranges
What's the last snapshot index to consider valid. When the buffer tip
reaches [`consts::SNAPSHOTS_COUNT`], it is set to 0 again and now the
queue of snapshots starts at index 1. With next call, the tip is set to
1 and queue starts at index 2.

There's a special scenario to consider which is the first population of
the ring buffer. We check the slot at the last index of the buffer and
if the slot is equal to zero, that means that we haven't done the first
rotation around the buffer yet. And therefore if the tip is at N, in
this special case the beginning is on index 0 and not N + 1.
Must equal to [`consts::SNAPSHOTS_COUNT`]. The unit tests will fail if
it doesn't.
How many tokens were deposited to the reserve supply or borrowed. We floor
u192 to u64 because 1 token doesn't change anything in large numbers terms,
and not storing u192 means we can store thrice as many snapshots in the same
amount of space.

TBD: to minimize this, we could store the total as u64 and then a u8
fraction of utilization rate percent (e.g 0 = 0%, 128 = 50%, 255 = 100%),
but that would require more computation units
**Fields**:
- `available_amount: u64`
- `borrowed_amount: u64`
- `slot: u64`

### TakeReserveCapSnapshot
**Location**: `endpoints/emit/take_reserve_cap_snapshot.rs:6`
**Attributes**: `derive(Accounts)`
**Fields**:
- `caller: Signer<'info>`
- `lending_market: Account<'info`
- `reserve: Account<'info`
- `snapshots: AccountLoader<'info`
- `clock: Sysvar<'info`

## Configuration Structures
### UpdateReserveConfig
**Location**: `endpoints/update_reserve_config.rs:1`
**Attributes**: `derive(Accounts)`
**Fields**:
- `owner: Signer<'info>` - The entity which created the [`LendingMarket`].
- `lending_market: Account<'info`
- `reserve: Account<'info`

## Other Structures
### RingBufferIterator
**Location**: `zero_copy_utils.rs:4`
Trait for zero-copy structures to provide consistent space calculation
and validation utilities.
Calculate the required space for this account type.
This should match the actual memory layout size.
Validate that the account data matches expected size and alignment.
Get the discriminator for this account type (first 8 bytes).
Helper trait for ring buffer operations used in zero-copy structures.
Get the current tip (write position) of the ring buffer.
Get the buffer array.
Get mutable buffer array.
Calculate the number of valid entries in the ring buffer.
Check if the ring buffer has wrapped around.
Get an iterator over valid entries in chronological order.
Push a new entry to the ring buffer, advancing the tip.
Advance the tip to the next position, wrapping if necessary.
Iterator for ring buffer entries in chronological order.

### LastUpdate
**Location**: `models/last_update.rs:1`
**Attributes**: `derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, Default)`
**Fields**:
- `slot: u64`
- `stale: bool`

### Pool
**Location**: `models/aldrin_amm.rs:8`
We don't even have all the fields on the struct, everything beyond the
field we need has been removed. The order must stay the same. See
<https://gitlab.com/crypto_project/defi/ammv2/-/blob/ba6de902a6571081c90fe6d89aca364d9a485375/programs/mm-farming-pool-product-only/src/lib.rs#L561>
**Fields**:
- `lp_token_freeze_vault: Pubkey`
- `pool_mint: Pubkey`
- `base_token_vault: Pubkey`
- `base_token_mint: Pubkey`
- `quote_token_vault: Pubkey`
- `quote_token_mint: Pubkey`

### ObligationLiquidity
**Location**: `models/obligation.rs:4`
Zero-copy account representing a user's borrowing and lending positions.

An obligation tracks all of a user's deposits (collateral) and borrows
(liquidity) across different reserves in the lending market. It maintains
real-time health calculations and supports up to 10 different reserves.

# Memory Layout
- Total size: 1,560 bytes (primarily the reserves array)
- Zero-copy: Enables efficient partial access without full deserialization
- Fixed-size: All arrays are statically sized for predictable memory layout

# Performance Benefits
- Compute unit savings: ~94% reduction vs. full deserialization
- Memory efficiency: Direct access to specific reserves without loading all
- Health calculations: Efficient access to value fields for liquidation checks

# Reserve Management
The obligation uses a sparse array pattern where reserves can be:
- `Empty`: Unused slot available for new positions
- `Collateral`: Deposited tokens earning interest
- `Liquidity`: Borrowed tokens accruing interest debt
Market value of all deposits combined in UAC.
Market value of all borrows combined in UAC which must be covered by
collateral. This doesn't include the undercollateralized value of
leverage yield farming loans.

That is, if a user borrows $300 worth of assets at 3x leverage, only
$100 are projected to this value.
Market value of all borrows combined in UAC including leverage farming
loans.

That is, if a user borrows $300 worth of assets at 3x leverage, all
$300 are projected to this value.
The maximum borrow value at the weighted average loan to value ratio.
The dangerous borrow value at the weighted average liquidation
threshold.
Keeps track of last deposit, to enable claiming emissions (liquidity
mining).
Only a fraction of the [`ObligationLiquidity`] `borrow_amount` must
be collateralized. This fraction is given by the leverage. E.g. for
3x leverage it's 300%, and therefore 1/3 of the `borrow_amount` must
be collateralized.
**Fields**:
- `borrow_reserve: Pubkey`
- `loan_kind: LoanKind` - Distinguishes between different kinds of loans we provide to users.
- `cumulative_borrow_rate: SDecimal` - Borrow rate used for calculating interest.
- `borrowed_amount: SDecimal` - collateralized fraction.
- `market_value: SDecimal`
- `emissions_claimable_from_slot: u64` - mining).

### FeesCalculation
**Location**: `models/reserve.rs:4`
Lending market reserve account. It's associated a reserve token wallet
account where the tokens that borrowers will want to borrow and funders will
want to lent are.
Account which holds recent history of deposited + borrowed funds of the
reserve.
Last slot when rates were updated. Helps us ensure that we're working
with fresh prices.
Utilization rate is an indicator of the availability of capital in the
pool. The interest rate model is used to manage liquidity risk through
user incentivises to support liquidity:
* When capital is available: low interest rates to encourage loans.
* When capital is scarce: high interest rates to encourage repayments
of loans and additional deposits.

Liquidity risk materializes when utilization is high, its becomes more
problematic as  gets closer to 100%. To tailor the model to this
constraint, the interest rate curve is split in two parts around an
optimal utilization rate. Before the slope is small, after it starts
rising sharply. See eq. (3) for more information.
LTV is the ratio between the maximum allowed borrow value and the
collateral value. Set to 0 to disable use as a collateral.

## Example
Say that a user deposit 100 USD worth of SOL, according to the
currently LTV of 85% for Solana the users are able to borrow up to 85
USD worth of assets.
Bonus a liquidator gets when repaying part of an unhealthy obligation.
This percentage will be used to multiply the liquidity value, so it
must be lower than 100%.

## Example
If the user has put in 100 USD worth of SOL and borrow 85 USD. If the
value of the borrowed asset has reached 90 USD. The liquidator can
comes in and pay 50 USD worth of SOL and it will be able to get back 50
* (1 + 2%) =  51 USD worth of SOL.
Loan to value ratio at which an obligation can be liquidated.

In another words, liquidation threshold is the ratio between borrow
amount and the collateral value at which the users are subject to
liquidation.

## Example
Say that a user deposit 100 USD worth of SOL and borrow 85 USD worth of
assets, according to the currently liquidation threshold of 90%, the
user is subject to liquidation if the value of the assets that they
borrow has increased 90 USD.
Min borrow APY, that is interest rate cannot be less than this.
Optimal borrow APY is "y graph" value of the borrow model where
utilization rate equals optimal utilization rate.
Max borrow APY, that is interest rate cannot grow over this.
Maximum leverage yield farming position. I.e. 300 means 3x.
Program owner fees separate from gains due to interest accrual.
Unvalidated config wrapper type. Use [`InputReserveConfig::validate`] to
access the inner value.
Additional fee information on a reserve.

These exist separately from interest accrual fees, and are specifically for
the program owner and frontend host. The fees are paid out as a percentage
of liquidity token amounts during repayments and liquidations.
Fee assessed on [`crate::endpoints::BorrowObligationLiquidity`],
expressed as a Wad. Must be between 0 and 10^18, such that 10^18 =
1.

# Examples
1% = 10_000_000_000_000_000
0.01% (1 basis point) = 100_000_000_000_000
0.00001% (Aave borrow fee) = 100_000_000_000
Similar to borrow fee, but applies to leverage yield farming.

# Important
The first release of LYF will not contain logic to charge leverage fee
because of compute unit limit. This value is left in the config for
future releases.
Fee for flash loan, expressed as a Wad.
0.3% (Aave flash loan fee) = 3_000_000_000_000_000
Amount of fee going to host account, if provided in liquidate and
repay.
Available amount of liquidity to borrow. This is in the smallest unit
depending on decimal places of the token. I.e. this would be lamports
in case of SOL reserve or satoshis in case of BTC reserve.
How much liquidity (with precision on 18 digit) is currently borrowed.
The total liquidity supply is `borrowed_amount` + `available_amount`.
This is in the smallest unit depending on decimal places of the token.
I.e. this would be lamports in case of SOL reserve or satoshis in case
of BTC reserve.
Read the [Compound whitepaper](https://compound.finance/documents/Compound.Whitepaper.pdf) section "3.2.1 Market Dynamics".
Reserve liquidity market price in universal asset currency
Used for exchange rate calculation. Copy of the value from the
[`anchor_spl::token::Mint`] which allows us to avoid including
that account in some transactions to save space.
**Fields**:
- `borrow_fee: u64` - Loan origination fee
- `host_fee: u64` - Host fee portion of origination fee

### SDecimal
**Location**: `math/sdecimal.rs:4`
We use storable decimal (hence [`SDecimal`]) when storing stuff into account
because at the moment Anchor's IDL TS library doesn't work with tuple
structs. That's why we cannot just use [`Decimal`].

The number is encoded as three u64s in little-endian. To create a
[`BN`][web3-bn] from the inner value you can use following typescript
method:

```typescript
type U64 = BN;
type U192 = [U64, U64, U64];

function u192ToBN(u192: U192): BN {
return new BN(
[
...u192[0].toArray("le", 8),
...u192[1].toArray("le", 8),
...u192[2].toArray("le", 8),
],
"le"
);
}
```

[web3-bn]: https://web3js.readthedocs.io/en/v1.5.2/web3-utils.html#bn

### Leverage
**Location**: `math/mod.rs:7`
Number in range [0; 100]
Leverage is given as a percentage value, for example to achieve 3x leverage
you should submit percent: 300.
**Fields**:
- `percent: u64`

### DepositObligationCollateral
**Location**: `endpoints/deposit_obligation_collateral.rs:11`
**Attributes**: `derive(Accounts)`
**Fields**:
- `borrower: Signer<'info>`
- `obligation: AccountLoader<'info`
- `reserve: Box<Account<'info`
- `source_collateral_wallet: AccountInfo<'info>`
- `destination_collateral_wallet: AccountInfo<'info>`
- `token_program: Program<'info`
- `clock: Sysvar<'info`

### SetLendingMarketOwner
**Location**: `endpoints/set_lending_market_owner.rs:1`
**Attributes**: `derive(Accounts)`
**Fields**:
- `owner: Signer<'info>`
- `new_owner: AccountInfo<'info>` - CHECK: UNSAFE_CODES.md#signer
- `lending_market: Account<'info`

### InitObligation
**Location**: `endpoints/init_obligation.rs:1`
**Attributes**: `derive(Accounts)`
**Fields**:
- `owner: Signer<'info>`
- `lending_market: Box<Account<'info`
- `obligation: AccountLoader<'info`
- `clock: Sysvar<'info`

### UpdateLendingMarket
**Location**: `endpoints/update_lending_market.rs:3`
**Attributes**: `derive(Accounts)`
**Fields**:
- `owner: Signer<'info>`
- `admin_bot: AccountInfo<'info>` - CHECK: UNSAFE_CODES.md#signer
- `lending_market: Account<'info`

### LiquidateObligation
**Location**: `endpoints/liquidate_obligation.rs:13`
**Attributes**: `derive(Accounts), instruction(lending_market_bump_seed: u8)`
**Fields**:
- `liquidator: Signer<'info>` - Any user can call this endpoint.
- `source_liquidity_wallet: AccountInfo<'info>`
- `destination_collateral_wallet: AccountInfo<'info>`
- `obligation: AccountLoader<'info`
- `repay_reserve: Box<Account<'info`
- `reserve_liquidity_wallet: AccountInfo<'info>`
- `withdraw_reserve: Box<Account<'info`
- `reserve_collateral_wallet: AccountInfo<'info>`
- `lending_market_pda: AccountInfo<'info>`
- `token_program: Program<'info`
- `clock: Sysvar<'info`

### BorrowObligationLiquidity
**Location**: `endpoints/borrow_obligation_liquidity.rs:11`
**Attributes**: `derive(Accounts), instruction(lending_market_bump_seed: u8)`
**Fields**:
- `borrower: Signer<'info>`
- `obligation: AccountLoader<'info`
- `reserve: Box<Account<'info`
- `lending_market_pda: AccountInfo<'info>`
- `source_liquidity_wallet: AccountInfo<'info>`
- `destination_liquidity_wallet: AccountInfo<'info>`
- `fee_receiver: AccountInfo<'info>`
- `token_program: Program<'info`
- `clock: Sysvar<'info`

### RepayObligationLiquidity
**Location**: `endpoints/repay_obligation_liquidity.rs:12`
**Attributes**: `derive(Accounts)`
**Fields**:
- `repayer: Signer<'info>` - Presumably `obligation.owner` but doesn't have to be.
- `obligation: AccountLoader<'info`
- `reserve: Box<Account<'info`
- `source_liquidity_wallet: AccountInfo<'info>`
- `destination_liquidity_wallet: AccountInfo<'info>`
- `token_program: Program<'info`
- `clock: Sysvar<'info`

### ToggleFlashLoans
**Location**: `endpoints/toggle_flash_loans.rs:4`
**Attributes**: `derive(Accounts)`
**Fields**:
- `owner: Signer<'info>`
- `lending_market: Account<'info`

### RefreshReserve
**Location**: `endpoints/refresh_reserve.rs:2`
**Attributes**: `derive(Accounts)`
**Fields**:
- `reserve: Account<'info`
- `oracle_price: AccountInfo<'info>`
- `clock: Sysvar<'info`

### RefreshObligation
**Location**: `endpoints/refresh_obligation.rs:2`
**Attributes**: `derive(Accounts)`
**Fields**:
- `obligation: AccountLoader<'info`
- `clock: Sysvar<'info`

### InitLendingMarket
**Location**: `endpoints/init_lending_market.rs:5`
**Attributes**: `derive(Accounts)`
**Fields**:
- `owner: Signer<'info>`
- `admin_bot: AccountInfo<'info>` - CHECK: UNSAFE_CODES.md#signer
- `aldrin_amm: AccountInfo<'info>`
- `lending_market: Account<'info`

### WithdrawObligationCollateral
**Location**: `endpoints/withdraw_obligation_collateral.rs:7`
**Attributes**: `derive(Accounts), instruction(lending_market_bump_seed: u8)`
**Fields**:
- `borrower: Signer<'info>`
- `obligation: AccountLoader<'info`
- `reserve: Box<Account<'info`
- `lending_market_pda: AccountInfo<'info>`
- `source_collateral_wallet: AccountInfo<'info>`
- `destination_collateral_wallet: AccountInfo<'info>`
- `token_program: Program<'info`
- `clock: Sysvar<'info`

### FlashLoan
**Location**: `endpoints/flash_loan.rs:14`
**Attributes**: `derive(Accounts), instruction(lending_market_bump_seed: u8)`
**Fields**:
- `lending_market: Box<Account<'info`
- `lending_market_pda: AccountInfo<'info>`
- `reserve: Box<Account<'info`
- `source_liquidity_wallet: Box<Account<'info`
- `destination_liquidity_wallet: AccountInfo<'info>`
- `fee_receiver: AccountInfo<'info>`
- `target_program: AccountInfo<'info>`
- `token_program: Program<'info`
- `clock: Sysvar<'info`

### RedeemReserveCollateral
**Location**: `endpoints/redeem_reserve_collateral.rs:13`
**Attributes**: `derive(Accounts), instruction(lending_market_bump_seed: u8, liquidity_amount: u64)`
**Fields**:
- `funder: Signer<'info>`
- `destination_liquidity_wallet: Account<'info`
- `lending_market_pda: AccountInfo<'info>`
- `reserve: Account<'info`
- `reserve_collateral_mint: AccountInfo<'info>`
- `source_collateral_wallet: AccountInfo<'info>`
- `reserve_liquidity_wallet: AccountInfo<'info>`
- `token_program: Program<'info`
- `clock: Sysvar<'info`

### InitReserve
**Location**: `endpoints/init_reserve.rs:9`
**Attributes**: `derive(Accounts), instruction(lending_market_bump_seed: u8, liquidity_amount: u64)`
**Fields**:
- `owner: Signer<'info>` - The entity which created the [`LendingMarket`].
- `funder: Signer<'info>` - owner.
- `lending_market_pda: AccountInfo<'info>`
- `lending_market: Box<Account<'info`
- `reserve: Box<Account<'info`
- `oracle_product: AccountInfo<'info>`
- `oracle_price: AccountInfo<'info>` - CHECK: UNSAFE_CODES.md#constraints
- `source_liquidity_wallet: Account<'info`
- `destination_collateral_wallet: AccountInfo<'info>`
- `reserve_liquidity_wallet: AccountInfo<'info>`
- `reserve_liquidity_mint: Account<'info`
- `reserve_liquidity_fee_recv_wallet: AccountInfo<'info>`
- `reserve_collateral_mint: AccountInfo<'info>`
- `reserve_collateral_wallet: AccountInfo<'info>`
- `snapshots: AccountLoader<'info`
- `token_program: Program<'info` - create liquidity token wallet and transfer liquidity into it.
- `clock: Sysvar<'info` - Helps us determine freshness of the oracle price estimate.
- `rent: AccountInfo<'info>` - CHECK: UNSAFE_CODES.md#wallet

### DepositReserveLiquidity
**Location**: `endpoints/deposit_reserve_liquidity.rs:2`
**Attributes**: `derive(Accounts), instruction(lending_market_bump_seed: u8, liquidity_amount: u64)`
**Fields**:
- `funder: Signer<'info>`
- `source_liquidity_wallet: Account<'info`
- `lending_market_pda: AccountInfo<'info>`
- `reserve: Account<'info`
- `reserve_collateral_mint: AccountInfo<'info>`
- `destination_collateral_wallet: AccountInfo<'info>`
- `reserve_liquidity_wallet: AccountInfo<'info>`
- `token_program: Program<'info`
- `clock: Sysvar<'info`

### ClaimEmission
**Location**: `endpoints/emit/claim_emission.rs:22`
**Attributes**: `derive(Accounts), instruction(lending_market_bump_seed: u8)`
**Fields**:
- `caller: Signer<'info>` - Owner of the obligation
- `lending_market: Account<'info`
- `reserve: Box<Account<'info`
- `snapshots: AccountLoader<'info`
- `obligation: AccountLoader<'info`
- `lending_market_pda: AccountInfo<'info>`
- `emission: Account<'info`
- `token_program: Program<'info`
- `clock: Sysvar<'info`

### CloseEmission
**Location**: `endpoints/emit/close_emission.rs:8`
**Attributes**: `derive(Accounts), instruction(lending_market_bump_seed: u8)`
**Fields**:
- `owner: Signer<'info>`
- `lending_market: Account<'info`
- `lending_market_pda: AccountInfo<'info>`
- `emissions: Account<'info`
- `token_program: Program<'info`
- `clock: Sysvar<'info`

### CreateEmission
**Location**: `endpoints/emit/create_emission.rs:10`
**Attributes**: `derive(Accounts), instruction(lending_market_bump_seed: u8)`
**Fields**:
- `owner: Signer<'info>`
- `lending_market: Box<Account<'info`
- `lending_market_pda: AccountInfo<'info>`
- `reserve: Box<Account<'info`
- `emission: Account<'info`
- `token_program: Program<'info`

### CompoundPositionOnAldrin
**Location**: `endpoints/amm/aldrin/compound_position_on_aldrin.rs:16`
**Attributes**: `derive(Accounts)`
**Fields**:
- `lending_market: Box<Account<'info`
- `caller: Signer<'info>`
- `farming_ticket_owner_pda: AccountInfo<'info>` - CHECK: UNSAFE_CODES.md#signer
- `amm_program: AccountInfo<'info>`
- `pool: AccountInfo<'info>`
- `pool_signer: AccountInfo<'info>` - CHECK: UNSAFE_CODES.md#amm
- `pool_mint: Box<Account<'info`
- `base_token_vault: Box<Account<'info`
- `base_token_reserve: Box<Account<'info`
- `quote_token_vault: Box<Account<'info`
- `quote_token_reserve: Box<Account<'info`
- `caller_lp_wallet: Box<Account<'info`
- `caller_farm_wallet: Box<Account<'info`
- `farming_state: AccountInfo<'info>` - CHECK: UNSAFE_CODES.md#amm
- `farming_calc: AccountInfo<'info>`
- `new_farming_ticket: AccountInfo<'info>`
- `farming_snapshots: AccountInfo<'info>` - CHECK: UNSAFE_CODES.md#amm
- `farm_token_vault: Box<Account<'info`
- `farm_token_reserve: Box<Account<'info`
- `lp_token_freeze_vault: AccountInfo<'info>`
- `token_program: Program<'info`
- `clock: Sysvar<'info`
- `rent: AccountInfo<'info>` - CHECK: UNSAFE_CODES.md#amm

### InitReserveAldrinUnstableLpToken
**Location**: `endpoints/amm/aldrin/init_reserve_aldrin_unstable_lp_token.rs:16`
**Attributes**: `derive(Accounts), instruction(lending_market_bump_seed: u8, liquidity_amount: u64)`
**Fields**:
- `owner: Signer<'info>` - The entity which created the [`LendingMarket`].
- `funder: Signer<'info>` - owner.
- `lending_market_pda: AccountInfo<'info>`
- `lending_market: Box<Account<'info`
- `reserve: Box<Account<'info`
- `pool: AccountInfo<'info>`
- `oracle_product: AccountInfo<'info>`
- `oracle_price: AccountInfo<'info>` - CHECK: UNSAFE_CODES.md#constraints
- `source_liquidity_wallet: Account<'info`
- `destination_collateral_wallet: AccountInfo<'info>`
- `reserve_liquidity_wallet: AccountInfo<'info>`
- `reserve_liquidity_mint: Account<'info` - This is the AMM LP mint.
- `reserve_liquidity_fee_recv_wallet: AccountInfo<'info>`
- `reserve_collateral_mint: AccountInfo<'info>`
- `reserve_collateral_wallet: AccountInfo<'info>`
- `snapshots: AccountLoader<'info`
- `token_program: Program<'info` - create liquidity token wallet and transfer liquidity into it.
- `clock: Sysvar<'info` - Helps us determine freshness of the oracle price estimate.
- `rent: AccountInfo<'info>` - CHECK: UNSAFE_CODES.md#constraints

### RefreshReserveAldrinUnstableLpToken
**Location**: `endpoints/amm/aldrin/refresh_reserve_aldrin_unstable_lp_token.rs:3`
**Attributes**: `derive(Accounts)`
**Fields**:
- `reserve: Account<'info`
- `oracle_price: AccountInfo<'info>`
- `vault: Account<'info`
- `pool_mint: Account<'info`
- `clock: Sysvar<'info`

### OpenLeveragedPositionOnAldrin
**Location**: `endpoints/amm/aldrin/open_leveraged_position_on_aldrin.rs:33`
Contains market pubkey, obligation pubkey, reserve pubkey, leverage and bump
seed.
**Fields**:
- `lending_market: Box<Account<'info`
- `borrower: Signer<'info>`
- `obligation: AccountLoader<'info`
- `reserve: Box<Account<'info`
- `lending_market_pda: AccountInfo<'info>`
- `reserve_liquidity_wallet: AccountInfo<'info>`
- `market_obligation_pda: AccountInfo<'info>`
- `farming_receipt: Box<Account<'info`
- `amm_program: AccountInfo<'info>`
- `pool: AccountInfo<'info>` - CHECK: UNSAFE_CODES.md#amm
- `pool_signer: AccountInfo<'info>` - CHECK: UNSAFE_CODES.md#amm
- `pool_mint: AccountInfo<'info>`
- `base_token_vault: Box<Account<'info`
- `quote_token_vault: Box<Account<'info`
- `fee_pool_wallet: AccountInfo<'info>`
- `borrower_base_wallet: Box<Account<'info`
- `borrower_quote_wallet: Box<Account<'info`
- `borrower_lp_wallet: Box<Account<'info`
- `farming_state: AccountInfo<'info>` - CHECK: UNSAFE_CODES.md#amm
- `farming_ticket: AccountInfo<'info>`
- `lp_token_freeze_vault: AccountInfo<'info>`
- `token_program: Program<'info`
- `clock: Sysvar<'info`
- `rent: AccountInfo<'info>` - CHECK: UNSAFE_CODES.md#amm

### CloseLeveragedPositionOnAldrin
**Location**: `endpoints/amm/aldrin/close_leveraged_position_on_aldrin.rs:32`
**Attributes**: `derive(Accounts), instruction(
    market_obligation_bump_seed: u8,
    leverage: Leverage,
)`
**Fields**:
- `lending_market: Box<Account<'info`
- `caller: Signer<'info>`
- `obligation: AccountLoader<'info`
- `reserve: Box<Account<'info`
- `reserve_liquidity_wallet: AccountInfo<'info>`
- `market_obligation_pda: AccountInfo<'info>`
- `farming_receipt: Account<'info`
- `amm_program: AccountInfo<'info>`
- `pool: AccountInfo<'info>`
- `pool_signer: AccountInfo<'info>` - CHECK: UNSAFE_CODES.md#amm
- `pool_mint: AccountInfo<'info>`
- `base_token_vault: Box<Account<'info`
- `quote_token_vault: Box<Account<'info`
- `caller_base_wallet: Box<Account<'info`
- `caller_quote_wallet: Box<Account<'info`
- `caller_lp_wallet: Box<Account<'info`
- `caller_sol_wallet: AccountInfo<'info>`
- `fee_base_wallet: AccountInfo<'info>`
- `fee_quote_wallet: AccountInfo<'info>`
- `farming_state: AccountInfo<'info>` - CHECK: UNSAFE_CODES.md#amm
- `farming_ticket: AccountInfo<'info>`
- `farming_snapshots: AccountInfo<'info>` - CHECK: UNSAFE_CODES.md#amm
- `lp_token_freeze_vault: AccountInfo<'info>`
- `fee_pool_wallet: AccountInfo<'info>`
- `token_program: Program<'info`
- `clock: Sysvar<'info`
- `rent: AccountInfo<'info>` - CHECK: UNSAFE_CODES.md#amm

### OpenVaultPositionOnAldrin
**Location**: `endpoints/amm/aldrin/open_vault_position_on_aldrin.rs:5`
Contains caller pubkey, reserve pubkey and bump seed.
**Fields**:
- `lending_market: Box<Account<'info`
- `caller: Signer<'info>`
- `farming_ticket_owner_pda: AccountInfo<'info>`
- `farming_receipt: Account<'info`
- `amm_program: AccountInfo<'info>`
- `pool: AccountInfo<'info>` - CHECK: UNSAFE_CODES.md#amm
- `caller_lp_wallet: AccountInfo<'info>`
- `farming_state: AccountInfo<'info>` - CHECK: UNSAFE_CODES.md#amm
- `farming_ticket: AccountInfo<'info>`
- `lp_token_freeze_vault: AccountInfo<'info>`
- `token_program: Program<'info`
- `clock: Sysvar<'info`
- `rent: AccountInfo<'info>` - CHECK: UNSAFE_CODES.md#amm

### CloseVaultPositionOnAldrin
**Location**: `endpoints/amm/aldrin/close_vault_position_on_aldrin.rs:3`
**Attributes**: `derive(Accounts), instruction(bump_seed: u8)`
**Fields**:
- `caller: Signer<'info>`
- `farming_ticket_owner_pda: AccountInfo<'info>`
- `farming_receipt: Account<'info`
- `amm_program: AccountInfo<'info>`
- `pool: AccountInfo<'info>`
- `pool_signer: AccountInfo<'info>` - CHECK: UNSAFE_CODES.md#amm
- `caller_lp_wallet: AccountInfo<'info>`
- `farming_state: AccountInfo<'info>` - CHECK: UNSAFE_CODES.md#amm
- `farming_ticket: AccountInfo<'info>`
- `farming_snapshots: AccountInfo<'info>` - CHECK: UNSAFE_CODES.md#amm
- `lp_token_freeze_vault: AccountInfo<'info>`
- `token_program: Program<'info`
- `clock: Sysvar<'info`
- `rent: AccountInfo<'info>` - CHECK: UNSAFE_CODES.md#amm

