# API Reference

This document provides a comprehensive reference for all public instructions, accounts, and interfaces in the Solana Borrow-Lending Protocol.

## Table of Contents

1. [Program Instructions](#program-instructions)
2. [Account Types](#account-types)
3. [Data Structures](#data-structures)
4. [Error Codes](#error-codes)
5. [TypeScript SDK](#typescript-sdk)
6. [CLI Commands](#cli-commands)

## Program Instructions

The Borrow-Lending Program (BLp) provides the following public instructions:

### Market Management

#### `init_lending_market`

Initializes a new lending market with specified configuration.

**Parameters:**
- `currency: UniversalAssetCurrency` - The universal asset currency (e.g., USD)
- `leveraged_compound_fee: PercentageInt` - Fee percentage for leveraged compound operations
- `vault_compound_fee: PercentageInt` - Fee percentage for vault compound operations  
- `min_collateral_uac_value_for_leverage: SDecimal` - Minimum collateral value required for leverage

**Accounts:**
- `lending_market` - The lending market account to initialize (signer)
- `market_owner` - The owner of the market (signer)
- `pda_signer` - Program derived address for the market
- `system_program` - Solana system program

**Example Usage:**
```typescript
await program.rpc.initLendingMarket(
  currency, 
  leveragedCompoundFee,
  vaultCompoundFee,
  minCollateralUacValueForLeverage,
  {
    accounts: {
      lendingMarket: lendingMarketKeypair.publicKey,
      marketOwner: marketOwner.publicKey,
      pdaSigner: pdaAddress,
      systemProgram: SystemProgram.programId,
    },
    signers: [lendingMarketKeypair, marketOwner],
  }
);
```

#### `update_lending_market`

Updates the configuration of an existing lending market.

**Parameters:**
- `leveraged_compound_fee: PercentageInt` - Updated fee percentage for leveraged compound operations
- `vault_compound_fee: PercentageInt` - Updated fee percentage for vault compound operations
- `min_collateral_uac_value_for_leverage: SDecimal` - Updated minimum collateral value for leverage

**Accounts:**
- `lending_market` - The lending market account to update (mut)
- `market_owner` - The current owner of the market (signer)

#### `set_lending_market_owner`

Transfers ownership of a lending market to a new owner.

**Accounts:**
- `lending_market` - The lending market account (mut)
- `current_owner` - The current owner (signer)
- `new_owner` - The new owner to transfer ownership to

### Reserve Management

#### `init_reserve`

Initializes a new reserve for a specific token in the lending market.

**Parameters:**
- `lending_market_bump_seed: u8` - Bump seed for the lending market PDA
- `liquidity_amount: u64` - Initial liquidity amount to deposit
- `config: InputReserveConfig` - Reserve configuration parameters

**Reserve Configuration:**
```rust
pub struct InputReserveConfig {
    pub optimal_utilization_rate: u8,
    pub loan_to_value_ratio: u8,
    pub liquidation_threshold: u8,
    pub liquidation_bonus: u8,
    pub min_borrow_rate: u8,
    pub optimal_borrow_rate: u8,
    pub max_borrow_rate: u8,
    pub fees: ReserveFees,
}
```

**Accounts:**
- `reserve` - The reserve account to initialize (signer)
- `lending_market` - The lending market this reserve belongs to
- `market_owner` - Owner of the lending market (signer)
- `reserve_liquidity_mint` - Mint of the liquidity token
- `reserve_liquidity_wallet` - Token account to hold reserve liquidity
- `reserve_collateral_mint` - Mint for collateral tokens (created)
- `reserve_collateral_wallet` - Token account to hold collateral
- `source_liquidity_wallet` - Source wallet for initial liquidity (mut)
- `destination_collateral_wallet` - Destination for minted collateral (mut)
- `pyth_product` - Pyth product account for price feeds
- `pyth_price` - Pyth price account for price feeds
- `token_program` - SPL Token program
- `rent` - Rent sysvar

#### `update_reserve_config`

Updates the configuration parameters of an existing reserve.

**Parameters:**
- `config: InputReserveConfig` - Updated reserve configuration

**Accounts:**
- `reserve` - The reserve to update (mut)
- `lending_market` - The lending market containing the reserve
- `market_owner` - Owner of the lending market (signer)

### Liquidity Operations

#### `deposit_reserve_liquidity`

Deposits liquidity tokens into a reserve in exchange for collateral tokens.

**Parameters:**
- `liquidity_amount: u64` - Amount of liquidity tokens to deposit

**Accounts:**
- `source_liquidity_wallet` - Source wallet containing liquidity tokens (mut)
- `destination_collateral_wallet` - Destination wallet for collateral tokens (mut)
- `reserve` - The reserve to deposit into (mut)
- `reserve_liquidity_wallet` - Reserve's liquidity token account (mut)
- `reserve_collateral_mint` - Reserve's collateral token mint (mut)
- `lending_market` - The lending market
- `transfer_authority` - Authority to transfer from source wallet (signer)
- `token_program` - SPL Token program
- `clock` - Clock sysvar

#### `redeem_reserve_collateral`

Redeems collateral tokens for the underlying liquidity tokens.

**Parameters:**
- `collateral_amount: u64` - Amount of collateral tokens to redeem

**Accounts:**
- `source_collateral_wallet` - Source wallet containing collateral tokens (mut)
- `destination_liquidity_wallet` - Destination wallet for liquidity tokens (mut)
- `reserve` - The reserve to redeem from (mut)
- `reserve_collateral_mint` - Reserve's collateral token mint (mut)
- `reserve_liquidity_wallet` - Reserve's liquidity token account (mut)
- `lending_market` - The lending market
- `lending_market_pda` - Lending market PDA authority
- `transfer_authority` - Authority to transfer from source wallet (signer)
- `token_program` - SPL Token program
- `clock` - Clock sysvar

### Obligation Management

#### `init_obligation`

Creates a new obligation account for a borrower.

**Accounts:**
- `obligation` - The obligation account to initialize (signer)
- `lending_market` - The lending market
- `obligation_owner` - The owner of the obligation (signer)
- `clock` - Clock sysvar
- `rent` - Rent sysvar
- `token_program` - SPL Token program

#### `deposit_obligation_collateral`

Deposits collateral tokens into an obligation.

**Parameters:**
- `collateral_amount: u64` - Amount of collateral tokens to deposit

**Accounts:**
- `source_collateral_wallet` - Source wallet containing collateral tokens (mut)
- `destination_collateral_wallet` - Obligation's collateral token account (mut)
- `reserve` - The reserve corresponding to the collateral
- `obligation` - The obligation to deposit into (mut)
- `lending_market` - The lending market
- `obligation_owner` - Owner of the obligation (signer)
- `transfer_authority` - Authority to transfer from source wallet (signer)
- `token_program` - SPL Token program
- `clock` - Clock sysvar

#### `withdraw_obligation_collateral`

Withdraws collateral tokens from an obligation (if health permits).

**Parameters:**
- `lending_market_bump_seed: u8` - Bump seed for the lending market PDA
- `collateral_amount: u64` - Amount of collateral tokens to withdraw

**Accounts:**
- `source_collateral_wallet` - Obligation's collateral token account (mut)
- `destination_collateral_wallet` - Destination wallet for collateral tokens (mut)
- `reserve` - The reserve corresponding to the collateral (mut)
- `obligation` - The obligation to withdraw from (mut)
- `lending_market` - The lending market
- `lending_market_pda` - Lending market PDA authority
- `obligation_owner` - Owner of the obligation (signer)
- `token_program` - SPL Token program
- `clock` - Clock sysvar

#### `borrow_obligation_liquidity`

Borrows liquidity tokens against collateral in an obligation.

**Parameters:**
- `lending_market_bump_seed: u8` - Bump seed for the lending market PDA
- `liquidity_amount: u64` - Amount of liquidity tokens to borrow

**Accounts:**
- `source_liquidity_wallet` - Reserve's liquidity token account (mut)
- `destination_liquidity_wallet` - Destination wallet for borrowed tokens (mut)
- `reserve` - The reserve to borrow from (mut)
- `fee_receiver` - Wallet to receive borrow fees (mut)
- `obligation` - The borrower's obligation (mut)
- `lending_market` - The lending market
- `lending_market_pda` - Lending market PDA authority
- `obligation_owner` - Owner of the obligation (signer)
- `token_program` - SPL Token program
- `clock` - Clock sysvar

#### `repay_obligation_liquidity`

Repays borrowed liquidity tokens.

**Parameters:**
- `liquidity_amount: u64` - Amount of liquidity tokens to repay
- `loan_kind: LoanKind` - Type of loan (Standard or LeveragedYieldFarming)

**Accounts:**
- `source_liquidity_wallet` - Source wallet containing tokens to repay (mut)
- `destination_liquidity_wallet` - Reserve's liquidity token account (mut)
- `reserve` - The reserve being repaid (mut)
- `obligation` - The borrower's obligation (mut)
- `repayer` - The account repaying the loan (signer)
- `token_program` - SPL Token program
- `clock` - Clock sysvar

### Liquidation

#### `liquidate_obligation`

Liquidates an unhealthy obligation by repaying debt and receiving collateral.

**Parameters:**
- `lending_market_bump_seed: u8` - Bump seed for the lending market PDA
- `liquidity_amount: u64` - Amount of debt to repay
- `loan_kind: LoanKind` - Type of loan being liquidated

**Accounts:**
- `liquidator` - The liquidator performing the liquidation (signer)
- `source_liquidity_wallet` - Liquidator's wallet to repay debt from (mut)
- `destination_collateral_wallet` - Liquidator's wallet to receive collateral (mut)
- `repay_reserve` - Reserve corresponding to the debt being repaid (mut)
- `withdraw_reserve` - Reserve corresponding to collateral being seized (mut)
- `obligation` - The obligation being liquidated (mut)
- `lending_market` - The lending market
- `lending_market_pda` - Lending market PDA authority
- `token_program` - SPL Token program
- `clock` - Clock sysvar

### Refresh Operations

#### `refresh_reserve`

Updates a reserve's state with current interest rates and market conditions.

**Accounts:**
- `reserve` - The reserve to refresh (mut)
- `pyth_price` - Pyth price account for current market price
- `clock` - Clock sysvar

#### `refresh_obligation`

Updates an obligation's state with accrued interest and current market values.

**Accounts:**
- `obligation` - The obligation to refresh (mut)
- `clock` - Clock sysvar

### Flash Loans

#### `flash_loan`

Provides an uncollateralized loan that must be repaid within the same transaction.

**Parameters:**
- `lending_market_bump_seed: u8` - Bump seed for the lending market PDA
- `liquidity_amount: u64` - Amount to borrow
- `data: Vec<u8>` - Additional data passed to the callback program

**Accounts:**
- `source_liquidity_wallet` - Reserve's liquidity wallet (mut)
- `destination_liquidity_wallet` - Borrower's wallet to receive funds (mut)
- `reserve` - The reserve providing the flash loan (mut)
- `fee_receiver` - Wallet to receive flash loan fees (mut)
- `lending_market` - The lending market
- `lending_market_pda` - Lending market PDA authority
- `token_program` - SPL Token program
- `flash_loan_receiver_program` - Program to call with the borrowed funds
- `clock` - Clock sysvar

#### `toggle_flash_loans`

Enables or disables flash loans for the lending market.

**Accounts:**
- `lending_market` - The lending market to configure (mut)
- `market_owner` - Owner of the lending market (signer)

## Account Types

### LendingMarket

The root account that contains global configuration for a lending market.

```rust
pub struct LendingMarket {
    pub version: u8,
    pub bump_seed: u8,
    pub owner: Pubkey,
    pub quote_currency: [u8; 32],
    pub token_program_id: Pubkey,
    pub oracle_program_id: Pubkey,
    pub flash_loans_enabled: bool,
    pub leveraged_compound_fee: PercentageInt,
    pub vault_compound_fee: PercentageInt,
    pub min_collateral_uac_value_for_leverage: SDecimal,
}
```

### Reserve

Represents a token reserve in the lending market.

```rust
pub struct Reserve {
    pub version: u8,
    pub lending_market: Pubkey,
    pub liquidity: ReserveLiquidity,
    pub collateral: ReserveCollateral,
    pub config: ReserveConfig,
    pub last_update: LastUpdate,
}
```

### Obligation

Tracks a user's deposits (collateral) and borrows (liquidity).

```rust
pub struct Obligation {
    pub version: u8,
    pub lending_market: Pubkey,
    pub owner: Pubkey,
    pub deposits: Vec<ObligationCollateral>,
    pub borrows: Vec<ObligationLiquidity>,
    pub last_update: LastUpdate,
}
```

## Data Structures

### ReserveConfig

Configuration parameters for a reserve.

```rust
pub struct ReserveConfig {
    pub optimal_utilization_rate: u8,      // 0-100
    pub loan_to_value_ratio: u8,           // 0-100  
    pub liquidation_threshold: u8,         // 0-100
    pub liquidation_bonus: u8,             // 0-100
    pub min_borrow_rate: u8,               // 0-255
    pub optimal_borrow_rate: u8,           // 0-255
    pub max_borrow_rate: u8,               // 0-255
    pub fees: ReserveFees,
}
```

### ReserveFees

Fee structure for a reserve.

```rust
pub struct ReserveFees {
    pub borrow_fee_wad: u64,
    pub flash_loan_fee_wad: u64,
    pub host_fee_percentage: u8,
}
```

### LoanKind

Enumeration of supported loan types.

```rust
pub enum LoanKind {
    Standard,
    LeveragedYieldFarming,
}
```

## Error Codes

Common error codes returned by the program:

- `InvalidMarketOwner` - The provided market owner is not authorized
- `InvalidAccountOwner` - Account is not owned by the expected program
- `ReserveStale` - Reserve data is stale and needs refreshing
- `ObligationStale` - Obligation data is stale and needs refreshing
- `ObligationNotHealthy` - Obligation is not healthy enough for the operation
- `InsufficientLiquidity` - Not enough liquidity available for the operation
- `InvalidAmount` - The provided amount is invalid (zero or too large)
- `FlashLoanNotRepaid` - Flash loan was not fully repaid in the transaction

## TypeScript SDK

### Basic Usage

```typescript
import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { BorrowLending } from "../target/types/borrow_lending";

// Initialize program
const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);
const program = anchor.workspace.BorrowLending as Program<BorrowLending>;

// Create lending market
const lendingMarket = anchor.web3.Keypair.generate();
await program.rpc.initLendingMarket(
  { usd: {} }, // currency
  new anchor.BN(50), // leveraged_compound_fee (0.5%)
  new anchor.BN(50), // vault_compound_fee (0.5%)
  [new anchor.BN(1000), new anchor.BN(0), new anchor.BN(0)], // min_collateral_uac_value
  {
    accounts: {
      lendingMarket: lendingMarket.publicKey,
      marketOwner: provider.wallet.publicKey,
      pdaSigner: pdaAddress,
      systemProgram: anchor.web3.SystemProgram.programId,
    },
    signers: [lendingMarket],
  }
);
```

### Helper Functions

```typescript
// Calculate PDA for lending market
function getLendingMarketPDA(lendingMarketPublicKey: PublicKey, programId: PublicKey) {
  return PublicKey.findProgramAddress(
    [Buffer.from(lendingMarketPublicKey.toBytes())],
    programId
  );
}

// Convert number to U192 format
function numberToU192(n: number): [anchor.BN, anchor.BN, anchor.BN] {
  const ONE_WAD = new anchor.BN(10).pow(new anchor.BN(18));
  const wad = n < 1 ? ONE_WAD.div(new anchor.BN(1 / n)) : ONE_WAD.mul(new anchor.BN(n));
  const bytes = wad.toArray("le", 24); // 3 * 8 bytes
  
  const nextU64 = () => new anchor.BN(bytes.splice(0, 8), "le");
  return [nextU64(), nextU64(), nextU64()];
}
```

## CLI Commands

The CLI provides convenient commands for interacting with the protocol:

### Market Management

```bash
# Initialize a new lending market
./target/release/cli init-market \
  --keypair market-keypair.json \
  --owner owner-keypair.json \
  --usd

# Update market configuration  
./target/release/cli update-market \
  --market <MARKET_PUBKEY> \
  --owner owner-keypair.json \
  --leveraged-compound-fee 75 \
  --vault-compound-fee 75
```

### Reserve Management

```bash
# Initialize a new reserve
./target/release/cli init-reserve \
  --market <MARKET_PUBKEY> \
  --owner owner-keypair.json \
  --mint <TOKEN_MINT> \
  --liquidity-amount 1000000 \
  --optimal-utilization-rate 80 \
  --loan-to-value-ratio 75 \
  --liquidation-threshold 85 \
  --liquidation-bonus 5

# Update reserve configuration
./target/release/cli update-reserve \
  --reserve <RESERVE_PUBKEY> \
  --owner owner-keypair.json \
  --optimal-utilization-rate 85
```

### User Operations

```bash
# Deposit liquidity
./target/release/cli deposit \
  --reserve <RESERVE_PUBKEY> \
  --amount 1000000 \
  --user user-keypair.json

# Borrow against collateral
./target/release/cli borrow \
  --obligation <OBLIGATION_PUBKEY> \
  --reserve <RESERVE_PUBKEY> \
  --amount 500000 \
  --user user-keypair.json

# Repay borrowed amount
./target/release/cli repay \
  --obligation <OBLIGATION_PUBKEY> \
  --reserve <RESERVE_PUBKEY> \
  --amount 500000 \
  --user user-keypair.json
```

---

For more detailed information on specific features, see the [main documentation](./documentation.md).