# API Reference

This document provides a comprehensive reference for all public instructions, accounts, and interfaces in the Solana Borrow-Lending Protocol. This is the definitive technical reference for developers, integrators, and auditors working with the protocol.

## Table of Contents

1. [Program Instructions](#program-instructions)
   - [Market Management](#market-management)
   - [Reserve Management](#reserve-management)
   - [Liquidity Operations](#liquidity-operations)
   - [Obligation Management](#obligation-management)
   - [Liquidation](#liquidation)
   - [Flash Loans](#flash-loans)
   - [AMM Integration](#amm-integration)
   - [Administrative Functions](#administrative-functions)
2. [Account Types](#account-types)
   - [Lending Market](#lending-market)
   - [Reserve](#reserve)
   - [Obligation](#obligation)
   - [Collateral](#collateral)
   - [Liquidity](#liquidity)
3. [Data Structures](#data-structures)
   - [Mathematical Types](#mathematical-types)
   - [Rate Models](#rate-models)
   - [Fee Structures](#fee-structures)
   - [Configuration Types](#configuration-types)
4. [Error Codes](#error-codes)
   - [Validation Errors](#validation-errors)
   - [State Errors](#state-errors)
   - [Mathematical Errors](#mathematical-errors)
   - [Security Errors](#security-errors)
5. [TypeScript SDK](#typescript-sdk)
   - [Installation and Setup](#installation-and-setup)
   - [Core Classes](#core-classes)
   - [Transaction Builders](#transaction-builders)
   - [Event Listeners](#event-listeners)
   - [Integration Patterns](#integration-patterns)
6. [CLI Commands](#cli-commands)
   - [Market Operations](#market-operations)
   - [User Operations](#user-operations)
   - [Administrative Commands](#administrative-commands)
   - [Utility Commands](#utility-commands)
7. [PDA Derivations](#pda-derivations)
8. [Integration Examples](#integration-examples)
9. [Testing Framework](#testing-framework)
10. [Best Practices](#best-practices)

## Program Instructions

The Solana Borrow-Lending Protocol (BLp) is composed of multiple interconnected programs that work together to provide a comprehensive DeFi lending and borrowing platform. The main program provides the core lending/borrowing functionality, while additional programs handle specific features like stable coin operations and AMM integrations.

### Core Program Overview

The main borrow-lending program (`borrow_lending`) implements the following key functionality:
- Market initialization and configuration
- Reserve creation and management  
- Liquidity provision and redemption
- Collateral management and borrowing
- Interest rate calculations and accrual
- Liquidation mechanisms
- Flash loan capabilities
- AMM integration for leveraged positions

All instructions follow Anchor's framework conventions and include comprehensive parameter validation, account verification, and state management.

### Market Management

Market management instructions handle the creation and configuration of lending markets, which serve as the top-level containers for all reserves and obligations within the protocol.

#### `init_lending_market`

**Function Signature:**
```rust
pub fn init_lending_market(
    ctx: Context<InitLendingMarket>,
    currency: UniversalAssetCurrency,
    leveraged_compound_fee: PercentageInt,
    vault_compound_fee: PercentageInt,
    min_collateral_uac_value_for_leverage: SDecimal,
) -> Result<()>
```

**Description:**
Initializes a new lending market account that serves as the central configuration hub for all reserves and obligations. The lending market defines the economic parameters, fee structures, and operational constraints for the entire market ecosystem.

Each lending market is independent and can have its own:
- Currency denomination (USD, EUR, etc.)
- Fee structures for different operations
- Risk parameters and limits
- Administrative controls
- Integration configurations

**Parameters:**

- `currency: UniversalAssetCurrency` - The universal asset currency used for value calculations
  - Determines how asset values are denominated across the market
  - Supported currencies: USD, EUR, BTC, ETH, SOL
  - All reserves in the market will use this currency for pricing
  - Example: `UniversalAssetCurrency::USD`

- `leveraged_compound_fee: PercentageInt` - Fee percentage for leveraged compound operations
  - Range: 0-10000 basis points (0-100%)
  - Applied when users compound their leveraged positions
  - Helps cover the computational costs and risks of leveraged operations
  - Example: 50 (0.5%)

- `vault_compound_fee: PercentageInt` - Fee percentage for vault compound operations
  - Range: 0-10000 basis points (0-100%)
  - Applied when the protocol automatically compounds user positions
  - Lower than leveraged compound fee due to reduced risk
  - Example: 25 (0.25%)

- `min_collateral_uac_value_for_leverage: SDecimal` - Minimum collateral value required for leverage
  - Expressed in the market's universal asset currency
  - Prevents dust leveraged positions that could destabilize the market
  - Must be > 0 to enable leveraged operations
  - Example: SDecimal::from(100) for $100 minimum

**Accounts:**

1. `owner: Signer<'info>` - The market owner who will have administrative privileges
   - Must be a signer to prevent unauthorized market creation
   - Will be able to update market configuration and add new reserves
   - Should be a multisig or governance program for production deployments
   - Cannot be changed after market creation

2. `admin_bot: AccountInfo<'info>` - Administrative bot for automated operations
   - Used to authorize admin-only endpoints like compound operations
   - Can be updated by the market owner
   - Typically a bot or automated system for efficiency
   - Must be provided even if not immediately used

3. `aldrin_amm: AccountInfo<'info>` - The Aldrin AMM program for swaps and liquidity
   - Must be an executable program account
   - Used for leveraged yield farming and position management
   - Provides swap functionality for liquidations and rebalancing
   - Cannot be changed after initialization

4. `lending_market: Account<'info, LendingMarket>` - The lending market account to initialize
   - Must be a new account with zero data
   - Will store all market configuration and state
   - Serves as the authority for all market operations
   - Account size: 512 bytes (sufficient for all market data)

**Account Constraints:**
- The lending market account must be empty (zero-initialized)
- The Aldrin AMM account must be executable
- All accounts must be valid and owned by appropriate programs

**State Changes:**
After successful execution, the lending market account will contain:
- Owner public key for administrative control
- Currency configuration for value calculations
- Fee structures for different operation types
- Minimum collateral requirements
- Admin bot and AMM program references
- Initialization timestamp
- Version information

**Error Conditions:**
- `InvalidAmount` - If any percentage fee exceeds 10000 basis points
- `InvalidCurrency` - If the specified currency is not supported
- `InvalidCollateralValue` - If minimum collateral value is zero or negative
- `AccountAlreadyInitialized` - If the lending market account is not empty
- `InvalidProgramId` - If the Aldrin AMM account is not executable

**Security Considerations:**
- The market owner has significant control over the market operation
- Admin bot permissions should be carefully managed
- Currency changes after initialization are not possible
- Fee parameters should be set conservatively initially

**Gas Usage:**
Approximately 15,000-20,000 compute units depending on account states.

**TypeScript Example:**
```typescript
import { PublicKey, Keypair, SystemProgram } from '@solana/web3.js';
import { Program } from '@project-serum/anchor';
import { BorrowLending } from './types/borrow_lending';

async function initializeLendingMarket(
  program: Program<BorrowLending>,
  marketOwner: Keypair,
  adminBot: PublicKey,
  aldrinAmmProgram: PublicKey
) {
  const lendingMarketKeypair = Keypair.generate();
  
  const currency = { usd: {} }; // UniversalAssetCurrency::USD
  const leveragedCompoundFee = 50; // 0.5%
  const vaultCompoundFee = 25; // 0.25%
  const minCollateralValue = "100.0"; // $100 minimum
  
  try {
    const signature = await program.rpc.initLendingMarket(
      currency,
      leveragedCompoundFee,
      vaultCompoundFee,
      minCollateralValue,
      {
        accounts: {
          owner: marketOwner.publicKey,
          adminBot: adminBot,
          aldrinAmm: aldrinAmmProgram,
          lendingMarket: lendingMarketKeypair.publicKey,
        },
        signers: [marketOwner, lendingMarketKeypair],
        preInstructions: [
          SystemProgram.createAccount({
            fromPubkey: marketOwner.publicKey,
            newAccountPubkey: lendingMarketKeypair.publicKey,
            space: 512, // Size for LendingMarket account
            lamports: await program.provider.connection.getMinimumBalanceForRentExemption(512),
            programId: program.programId,
          }),
        ],
      }
    );
    
    console.log(`Lending market initialized: ${signature}`);
    return lendingMarketKeypair.publicKey;
  } catch (error) {
    console.error('Failed to initialize lending market:', error);
    throw error;
  }
}

// Usage example
const marketAddress = await initializeLendingMarket(
  program,
  marketOwnerKeypair,
  adminBotAddress,
  aldrinAmmProgramId
);
```

**CLI Example:**
```bash
# Initialize a new lending market
solana-borrow-lending init-market \
  --market-keypair ./market-keypair.json \
  --owner ./owner-keypair.json \
  --admin-bot 5ZWj7a1TsYKqN1jjsxiH5xRoUakQBBT4F1SkUh9bUW7n \
  --aldrin-amm 5ZWj7a1TsYKqN1jjsxiH5xRoUakQBBT4F1SkUh9bUW7n \
  --currency USD \
  --leveraged-compound-fee 0.5 \
  --vault-compound-fee 0.25 \
  --min-collateral-value 100.0 \
  --rpc-url https://api.mainnet-beta.solana.com
```

**Integration Considerations:**
- Market addresses should be stored securely for future operations
- Consider using a multisig wallet for the market owner in production
- Admin bot should be a reliable automated system
- Fee parameters can be updated later via `update_lending_market`

**Related Instructions:**
- [`update_lending_market`](#update_lending_market) - Update market configuration
- [`set_lending_market_owner`](#set_lending_market_owner) - Transfer ownership
- [`init_reserve`](#init_reserve) - Add reserves to the market

---

#### `update_lending_market`

**Function Signature:**
```rust
pub fn update_lending_market(
    ctx: Context<UpdateLendingMarket>,
    currency: Option<UniversalAssetCurrency>,
    leveraged_compound_fee: Option<PercentageInt>,
    vault_compound_fee: Option<PercentageInt>,
    min_collateral_uac_value_for_leverage: Option<SDecimal>,
) -> Result<()>
```

**Description:**
Updates the configuration parameters of an existing lending market. This instruction allows the market owner to modify operational parameters while the market is running, enabling governance and optimization of market behavior based on changing conditions.

The instruction uses optional parameters, meaning only specified fields will be updated while others remain unchanged. This allows for precise configuration updates without affecting unrelated parameters.

**Parameters:**

- `currency: Option<UniversalAssetCurrency>` - Optional new universal asset currency
  - If provided, changes the currency used for value calculations
  - WARNING: Changing currency can affect all existing positions
  - Should only be done when market is empty or during migration
  - None value keeps existing currency unchanged

- `leveraged_compound_fee: Option<PercentageInt>` - Optional new leveraged compound fee
  - If provided, updates the fee for leveraged compound operations
  - Range: 0-10000 basis points (0-100%)
  - Affects future operations immediately
  - None value keeps existing fee unchanged

- `vault_compound_fee: Option<PercentageInt>` - Optional new vault compound fee
  - If provided, updates the fee for vault compound operations
  - Range: 0-10000 basis points (0-100%)
  - Should generally be lower than leveraged compound fee
  - None value keeps existing fee unchanged

- `min_collateral_uac_value_for_leverage: Option<SDecimal>` - Optional new minimum collateral value
  - If provided, updates the minimum value required for leveraged positions
  - Must be > 0 if specified
  - Affects new leveraged positions immediately
  - None value keeps existing minimum unchanged

**Accounts:**

1. `market_owner: Signer<'info>` - Current owner of the market
   - Must match the owner stored in the lending market account
   - Required to be a signer to authorize the update
   - Only the owner can update market parameters

2. `lending_market: Account<'info, LendingMarket>` - The market to update
   - Must be a valid, initialized lending market
   - Will be modified with new configuration values
   - State is updated atomically

**Account Constraints:**
- The signer must be the current market owner
- The lending market must be properly initialized
- All optional parameters must be valid if provided

**State Changes:**
Updates only the specified fields in the lending market account:
- Currency if provided and different from current
- Leveraged compound fee if provided
- Vault compound fee if provided  
- Minimum collateral value if provided
- Last update timestamp is refreshed

**Error Conditions:**
- `IllegalOwner` - If the signer is not the market owner
- `InvalidAmount` - If any fee exceeds 10000 basis points
- `InvalidCurrency` - If the specified currency is not supported
- `InvalidCollateralValue` - If minimum collateral value is zero or negative
- `MarketNotFound` - If the lending market account is invalid

**Security Considerations:**
- Currency changes should be avoided on active markets
- Fee increases should be implemented gradually
- Consider announcing parameter changes in advance
- Monitor market impact after parameter updates

**TypeScript Example:**
```typescript
async function updateMarketParameters(
  program: Program<BorrowLending>,
  marketOwner: Keypair,
  lendingMarket: PublicKey,
  updates: {
    leveragedCompoundFee?: number;
    vaultCompoundFee?: number;
    minCollateralValue?: string;
  }
) {
  const signature = await program.rpc.updateLendingMarket(
    null, // Don't change currency
    updates.leveragedCompoundFee ?? null,
    updates.vaultCompoundFee ?? null,
    updates.minCollateralValue ?? null,
    {
      accounts: {
        marketOwner: marketOwner.publicKey,
        lendingMarket: lendingMarket,
      },
      signers: [marketOwner],
    }
  );
  
  console.log(`Market updated: ${signature}`);
  return signature;
}

// Example: Reduce fees to make market more competitive
await updateMarketParameters(
  program,
  marketOwnerKeypair,
  marketAddress,
  {
    leveragedCompoundFee: 25, // Reduce from 50 to 25 (0.25%)
    vaultCompoundFee: 10,     // Reduce from 25 to 10 (0.10%)
  }
);
```

**CLI Example:**
```bash
# Update market fees
solana-borrow-lending update-market \
  --market 5ZWj7a1TsYKqN1jjsxiH5xRoUakQBBT4F1SkUh9bUW7n \
  --owner ./owner-keypair.json \
  --leveraged-compound-fee 0.25 \
  --vault-compound-fee 0.10 \
  --rpc-url https://api.mainnet-beta.solana.com
```

---

#### `set_lending_market_owner`

**Function Signature:**
```rust
pub fn set_lending_market_owner(
    ctx: Context<SetLendingMarketOwner>,
) -> Result<()>
```

**Description:**
Transfers ownership of a lending market to a new owner. This is a critical administrative function that should be used carefully, typically as part of governance transitions or security updates.

The new owner will inherit all administrative privileges including the ability to:
- Update market configuration parameters
- Add and configure new reserves
- Set administrative bot addresses
- Transfer ownership again

**Parameters:**
This instruction takes no additional parameters beyond the accounts context.

**Accounts:**

1. `current_owner: Signer<'info>` - Current owner of the market
   - Must match the owner stored in the lending market account
   - Required to be a signer to authorize the ownership transfer
   - Will lose all administrative privileges after transfer

2. `new_owner: AccountInfo<'info>` - The new owner account
   - Will become the new owner with full administrative privileges
   - Does not need to be a signer (receives ownership)
   - Should typically be a multisig or governance program

3. `lending_market: Account<'info, LendingMarket>` - The market to transfer
   - Must be a valid, initialized lending market
   - Owner field will be updated to new_owner
   - All other market data remains unchanged

**Account Constraints:**
- Current owner must be a signer
- Current owner must match the stored owner in lending market
- New owner account must be valid
- Lending market must be properly initialized

**State Changes:**
- Updates the owner field in the lending market account
- All other market configuration remains unchanged
- Transfer is immediate and irreversible

**Error Conditions:**
- `IllegalOwner` - If the signer is not the current market owner
- `MarketNotFound` - If the lending market account is invalid
- `InvalidAccount` - If the new owner account is invalid

**Security Considerations:**
- Ownership transfers are irreversible - verify new owner address carefully
- Consider using a multisig for the new owner in production
- Announce ownership transfers in advance when possible
- Ensure new owner is prepared to manage the market

**TypeScript Example:**
```typescript
async function transferMarketOwnership(
  program: Program<BorrowLending>,
  currentOwner: Keypair,
  newOwner: PublicKey,
  lendingMarket: PublicKey
) {
  const signature = await program.rpc.setLendingMarketOwner({
    accounts: {
      currentOwner: currentOwner.publicKey,
      newOwner: newOwner,
      lendingMarket: lendingMarket,
    },
    signers: [currentOwner],
  });
  
  console.log(`Ownership transferred to ${newOwner.toString()}: ${signature}`);
  return signature;
}

// Example: Transfer to a multisig governance address
const newOwnerAddress = new PublicKey("5ZWj7a1TsYKqN1jjsxiH5xRoUakQBBT4F1SkUh9bUW7n");
await transferMarketOwnership(
  program,
  currentOwnerKeypair,
  newOwnerAddress,
  marketAddress
);
```

**CLI Example:**
```bash
# Transfer market ownership
solana-borrow-lending transfer-ownership \
  --market 5ZWj7a1TsYKqN1jjsxiH5xRoUakQBBT4F1SkUh9bUW7n \
  --current-owner ./current-owner-keypair.json \
  --new-owner 5ZWj7a1TsYKqN1jjsxiH5xRoUakQBBT4F1SkUh9bUW7n \
  --rpc-url https://api.mainnet-beta.solana.com
```

---

### Reserve Management

Reserve management instructions handle the creation, configuration, and maintenance of individual asset reserves within a lending market. Each reserve represents a specific token that can be lent and borrowed.

#### `init_reserve`

**Function Signature:**
```rust
pub fn init_reserve(
    ctx: Context<InitReserve>,
    liquidity_amount: u64,
    reserve_config: ReserveConfig,
) -> Result<()>
```

**Description:**
Initializes a new reserve within a lending market for a specific token mint. A reserve is the core data structure that tracks all liquidity, collateral, borrowing, and lending activity for a particular asset.

Each reserve maintains:
- Liquidity supply and borrow amounts
- Interest rate models and current rates
- Collateral configuration and ratios
- Fee structures and destinations
- Oracle price feed information
- Last update timestamps and staleness tracking

The initialization requires providing initial liquidity to bootstrap the reserve and make it available for lending operations.

**Parameters:**

- `liquidity_amount: u64` - Initial liquidity amount to deposit
  - Must be > 0 to create a functional reserve
  - Denominated in the token's native units (lamports for SOL, smallest unit for other tokens)
  - The initializer becomes the first lender in the reserve
  - Example: 1000000000 (1 SOL in lamports)

- `reserve_config: ReserveConfig` - Complete configuration for the reserve
  - Contains all economic and operational parameters
  - Includes interest rate models, fees, and risk parameters
  - See [ReserveConfig](#reserveconfig) for detailed structure
  - Cannot be changed after initialization (use update_reserve_config instead)

**Accounts:**

1. `source_liquidity: AccountInfo<'info>` - Token account providing initial liquidity
   - Must contain at least liquidity_amount tokens
   - Will be debited for the initial deposit
   - Must be owned by the authority signer

2. `destination_collateral: AccountInfo<'info>` - Token account to receive collateral tokens
   - Will receive newly minted collateral tokens representing the deposit
   - Must be owned by the authority signer
   - Token mint must match the reserve's collateral mint

3. `reserve: Account<'info, Reserve>` - The reserve account to initialize
   - Must be empty (zero-initialized)
   - Will store all reserve state and configuration
   - Size: 619 bytes for complete reserve data

4. `reserve_liquidity_mint: AccountInfo<'info>` - Mint of the underlying token
   - Defines what token this reserve manages
   - Must be a valid SPL token mint
   - Cannot be changed after initialization

5. `reserve_liquidity_supply: AccountInfo<'info>` - Token account to hold reserve liquidity
   - Controlled by the lending market PDA
   - Will receive all deposited liquidity
   - Must be for the same mint as reserve_liquidity_mint

6. `reserve_liquidity_fee_receiver: AccountInfo<'info>` - Token account for fee collection
   - Receives fees from borrowing operations
   - Must be for the same mint as reserve_liquidity_mint
   - Typically owned by protocol treasury

7. `reserve_collateral_mint: Signer<'info>` - Mint for collateral tokens
   - New mint created for this reserve's collateral tokens
   - Controlled by the lending market PDA
   - Used to track deposits and calculate shares

8. `reserve_collateral_supply: AccountInfo<'info>` - Token account for collateral supply tracking
   - Controlled by the lending market PDA
   - Tracks total collateral tokens in circulation
   - Must be for the same mint as reserve_collateral_mint

9. `pyth_product: AccountInfo<'info>` - Pyth product account for price data
   - Provides price information for the asset
   - Must be a valid Pyth product account
   - Used for collateral value calculations

10. `pyth_price: AccountInfo<'info>` - Pyth price account for current prices
    - Provides real-time price data
    - Must correspond to the pyth_product account
    - Critical for liquidation and borrowing calculations

11. `lending_market: Box<Account<'info, LendingMarket>>` - The parent lending market
    - Must be properly initialized
    - Provides market-wide configuration
    - Authority for reserve operations

12. `lending_market_authority: AccountInfo<'info>` - PDA for market authority
    - Derived from lending market address
    - Controls reserve token accounts
    - Authority for minting/burning collateral tokens

13. `lending_market_owner: Signer<'info>` - Owner of the lending market
    - Must match the owner in lending_market account
    - Required to authorize new reserve creation
    - Only owner can add reserves to market

14. `authority: Signer<'info>` - Authority providing initial liquidity
    - Must own source_liquidity and destination_collateral accounts
    - Becomes the first depositor in the reserve
    - Receives initial collateral tokens

15. `token_program: Program<'info, Token>` - SPL Token program
16. `rent: Sysvar<'info, Rent>` - Rent sysvar for account creation
17. `clock: Sysvar<'info, Clock>` - Clock sysvar for timestamps

**Account Constraints:**
- Reserve account must be empty (zero-initialized)
- Source liquidity must have sufficient balance
- All token accounts must match expected mints
- Pyth accounts must be valid price feeds
- Lending market owner must be signer

**State Changes:**
After successful execution:
- Reserve account is fully initialized with configuration
- Initial liquidity is transferred to reserve supply
- Collateral tokens are minted to depositor
- Reserve state is marked as active and current
- Interest rate calculation is initialized

**Error Conditions:**
- `InvalidAmount` - If liquidity_amount is zero
- `InsufficientLiquidity` - If source account lacks sufficient tokens
- `InvalidMint` - If token mints don't match expected values
- `InvalidOracle` - If Pyth accounts are invalid
- `ReserveAlreadyInitialized` - If reserve account is not empty
- `IllegalOwner` - If signer is not the market owner

**Security Considerations:**
- Reserve configuration parameters should be carefully reviewed
- Oracle accounts must be verified as legitimate Pyth feeds
- Initial liquidity amount affects reserve bootstrapping
- Fee receiver should be a secure treasury address

**ReserveConfig Structure:**
```rust
pub struct ReserveConfig {
    /// Optimal utilization rate as a percentage
    pub optimal_utilization_rate: u8,
    /// Loan to value ratio for collateral
    pub loan_to_value_ratio: u8,
    /// Liquidation bonus percentage
    pub liquidation_bonus: u8,
    /// Liquidation threshold percentage  
    pub liquidation_threshold: u8,
    /// Minimum borrow rate in basis points
    pub min_borrow_rate: u8,
    /// Optimal borrow rate in basis points
    pub optimal_borrow_rate: u8,
    /// Maximum borrow rate in basis points
    pub max_borrow_rate: u8,
    /// Fees configuration
    pub fees: ReserveFees,
    /// Deposit limit in tokens
    pub deposit_limit: u64,
    /// Borrow limit in tokens
    pub borrow_limit: u64,
    /// Fee receiver for the reserve
    pub fee_receiver: Pubkey,
}
```

**TypeScript Example:**
```typescript
import { PublicKey, Keypair, SystemProgram } from '@solana/web3.js';
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token';

async function initializeReserve(
  program: Program<BorrowLending>,
  marketOwner: Keypair,
  lendingMarket: PublicKey,
  tokenMint: PublicKey,
  initialLiquidity: number,
  pythProduct: PublicKey,
  pythPrice: PublicKey
) {
  // Generate new keypairs
  const reserveKeypair = Keypair.generate();
  const collateralMintKeypair = Keypair.generate();
  
  // Create token accounts
  const token = new Token(program.provider.connection, tokenMint, TOKEN_PROGRAM_ID, marketOwner);
  
  const sourceLiquidity = await token.getOrCreateAssociatedAccountInfo(marketOwner.publicKey);
  const reserveLiquiditySupply = await token.createAccount(lendingMarketAuthority);
  const feeReceiver = await token.createAccount(treasuryAddress);
  
  // Create collateral token accounts
  const collateralToken = new Token(
    program.provider.connection, 
    collateralMintKeypair.publicKey, 
    TOKEN_PROGRAM_ID, 
    marketOwner
  );
  
  const destinationCollateral = await collateralToken.getOrCreateAssociatedAccountInfo(
    marketOwner.publicKey
  );
  const collateralSupply = await collateralToken.createAccount(lendingMarketAuthority);
  
  // Configure reserve parameters
  const reserveConfig = {
    optimalUtilizationRate: 80, // 80%
    loanToValueRatio: 75,       // 75% LTV
    liquidationBonus: 5,        // 5% bonus
    liquidationThreshold: 80,   // 80% threshold
    minBorrowRate: 1,          // 1% minimum
    optimalBorrowRate: 8,      // 8% at optimal
    maxBorrowRate: 25,         // 25% maximum
    fees: {
      borrowFeeWad: "10000000000000000", // 1%
      flashLoanFeeWad: "3000000000000000", // 0.3%
      hostFeePercentage: 20, // 20% of fees to host
    },
    depositLimit: "1000000000000000", // 1M tokens
    borrowLimit: "800000000000000",   // 800K tokens
    feeReceiver: feeReceiver.address,
  };
  
  const signature = await program.rpc.initReserve(
    initialLiquidity,
    reserveConfig,
    {
      accounts: {
        sourceLiquidity: sourceLiquidity.address,
        destinationCollateral: destinationCollateral.address,
        reserve: reserveKeypair.publicKey,
        reserveLiquidityMint: tokenMint,
        reserveLiquiditySupply: reserveLiquiditySupply.address,
        reserveLiquidityFeeReceiver: feeReceiver.address,
        reserveCollateralMint: collateralMintKeypair.publicKey,
        reserveCollateralSupply: collateralSupply.address,
        pythProduct: pythProduct,
        pythPrice: pythPrice,
        lendingMarket: lendingMarket,
        lendingMarketAuthority: lendingMarketAuthority,
        lendingMarketOwner: marketOwner.publicKey,
        authority: marketOwner.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
        clock: SYSVAR_CLOCK_PUBKEY,
      },
      signers: [marketOwner, reserveKeypair, collateralMintKeypair],
      preInstructions: [
        // Create reserve account
        SystemProgram.createAccount({
          fromPubkey: marketOwner.publicKey,
          newAccountPubkey: reserveKeypair.publicKey,
          space: 619, // Reserve account size
          lamports: await program.provider.connection.getMinimumBalanceForRentExemption(619),
          programId: program.programId,
        }),
        // Create collateral mint
        SystemProgram.createAccount({
          fromPubkey: marketOwner.publicKey,
          newAccountPubkey: collateralMintKeypair.publicKey,
          space: 82, // Mint account size
          lamports: await program.provider.connection.getMinimumBalanceForRentExemption(82),
          programId: TOKEN_PROGRAM_ID,
        }),
      ],
    }
  );
  
  console.log(`Reserve initialized: ${signature}`);
  return {
    reserve: reserveKeypair.publicKey,
    collateralMint: collateralMintKeypair.publicKey,
  };
}

// Example: Initialize USDC reserve
const usdcMint = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const pythUsdcProduct = new PublicKey("8GWTTbNiXdmyZREXbjsZBmCRuzdPrW55dnZGDkTRjWvb");
const pythUsdcPrice = new PublicKey("5uQiSaym2Gk8VCU7wt4x6w3zUWvqJPX5t4LkdmqF6K3M");

const { reserve, collateralMint } = await initializeReserve(
  program,
  marketOwnerKeypair,
  lendingMarketAddress,
  usdcMint,
  1000 * 1e6, // 1000 USDC initial liquidity
  pythUsdcProduct,
  pythUsdcPrice
);
```

**CLI Example:**
```bash
# Initialize a new USDC reserve
solana-borrow-lending init-reserve \
  --market 5ZWj7a1TsYKqN1jjsxiH5xRoUakQBBT4F1SkUh9bUW7n \
  --owner ./owner-keypair.json \
  --mint EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v \
  --initial-liquidity 1000 \
  --pyth-product 8GWTTbNiXdmyZREXbjsZBmCRuzdPrW55dnZGDkTRjWvb \
  --pyth-price 5uQiSaym2Gk8VCU7wt4x6w3zUWvqJPX5t4LkdmqF6K3M \
  --config-file ./usdc-reserve-config.json \
  --rpc-url https://api.mainnet-beta.solana.com
```

**Integration Considerations:**
- Reserve addresses should be stored for future operations
- Collateral mint addresses are needed for user deposits
- Oracle feeds must be monitored for staleness
- Initial liquidity affects user experience during launch

**Related Instructions:**
- [`update_reserve_config`](#update_reserve_config) - Update reserve parameters
- [`deposit_reserve_liquidity`](#deposit_reserve_liquidity) - Add liquidity to reserve
- [`refresh_reserve`](#refresh_reserve) - Update reserve interest rates

---

#### `update_reserve_config`

**Function Signature:**
```rust
pub fn update_reserve_config(
    ctx: Context<UpdateReserveConfig>,
    config: InputReserveConfig,
) -> Result<()>
```

**Description:**
Updates the configuration parameters of an existing reserve. This instruction allows the market owner to modify reserve economic parameters while preserving all existing liquidity and borrowing positions.

This is a critical administrative function that enables protocol optimization, risk management adjustments, and response to changing market conditions. All configuration changes take effect immediately for new operations while existing positions continue under their original terms until the next interest accrual.

**Parameters:**

- `config: InputReserveConfig` - Complete new configuration for the reserve
  - Replaces all existing configuration parameters
  - Must pass validation for internal consistency
  - Cannot be partially updated (all fields required)
  - See [InputReserveConfig](#inputreserveconfig) for detailed structure

**Accounts:**

1. `owner: Signer<'info>` - Owner of the lending market
   - Must match the owner stored in the lending market account
   - Required to be a signer to authorize configuration changes
   - Only the market owner can update reserve configurations

2. `lending_market: Account<'info, LendingMarket>` - The parent lending market
   - Must be properly initialized
   - Used to verify owner authority
   - Provides market-wide constraints for validation

3. `reserve: Account<'info, Reserve>` - The reserve to update
   - Must be a valid, initialized reserve
   - Configuration will be completely replaced
   - Existing liquidity and borrow state preserved

**Account Constraints:**
- Owner must be a signer and match lending market owner
- Reserve must belong to the specified lending market
- All accounts must be properly initialized

**State Changes:**
- Replaces the entire config field in the reserve account
- All other reserve state (liquidity, borrows, rates) remains unchanged
- Last update timestamp is refreshed
- Reserve becomes temporarily stale until next refresh

**Validation Rules:**
The new configuration must satisfy:
- Optimal utilization rate: 1-100%
- Loan to value ratio: 1-97% (must be less than liquidation threshold)
- Liquidation threshold: 3-98% (must be greater than LTV)
- Liquidation bonus: 0-50%
- Interest rates: min ≤ optimal ≤ max, all in range 0-255%
- Deposit and borrow limits: must be reasonable values
- Fee percentages: within acceptable ranges

**Error Conditions:**
- `InvalidMarketOwner` - If signer is not the market owner
- `InvalidConfiguration` - If config parameters are out of valid ranges
- `InconsistentConfiguration` - If config parameters are internally inconsistent
- `ReserveNotFound` - If reserve account is invalid

**Security Considerations:**
- Configuration changes can significantly impact user positions
- Interest rate changes affect borrower costs immediately
- LTV ratio changes affect borrowing capacity
- Liquidation parameters affect liquidation risk
- Consider announcing major changes in advance

**InputReserveConfig Structure:**
```rust
pub struct InputReserveConfig {
    /// Optimal utilization rate (1-100)
    pub optimal_utilization_rate: u8,
    /// Maximum loan to value ratio (1-97)
    pub loan_to_value_ratio: u8,
    /// Liquidation bonus percentage (0-50)
    pub liquidation_bonus: u8,
    /// Liquidation threshold (3-98, must be > LTV)
    pub liquidation_threshold: u8,
    /// Minimum borrow rate in percentage (0-255)
    pub min_borrow_rate: u8,
    /// Optimal borrow rate in percentage (0-255)
    pub optimal_borrow_rate: u8,
    /// Maximum borrow rate in percentage (0-255)
    pub max_borrow_rate: u8,
    /// Borrow fee in WAD format
    pub borrow_fee_wad: u64,
    /// Flash loan fee in WAD format
    pub flash_loan_fee_wad: u64,
    /// Host fee percentage (0-100)
    pub host_fee_percentage: u8,
    /// Maximum deposit limit for the reserve
    pub deposit_limit: u64,
    /// Maximum borrow limit for the reserve
    pub borrow_limit: u64,
    /// Fee receiver account for this reserve
    pub fee_receiver: Pubkey,
}
```

**TypeScript Example:**
```typescript
async function updateReserveConfig(
  program: Program<BorrowLending>,
  marketOwner: Keypair,
  lendingMarket: PublicKey,
  reserve: PublicKey,
  newConfig: InputReserveConfig
) {
  // Validate configuration locally first
  if (newConfig.loanToValueRatio >= newConfig.liquidationThreshold) {
    throw new Error("LTV must be less than liquidation threshold");
  }
  
  if (newConfig.minBorrowRate > newConfig.optimalBorrowRate || 
      newConfig.optimalBorrowRate > newConfig.maxBorrowRate) {
    throw new Error("Interest rates must be in ascending order");
  }
  
  const signature = await program.rpc.updateReserveConfig(newConfig, {
    accounts: {
      owner: marketOwner.publicKey,
      lendingMarket: lendingMarket,
      reserve: reserve,
    },
    signers: [marketOwner],
  });
  
  console.log(`Reserve config updated: ${signature}`);
  return signature;
}

// Example: Update USDC reserve to be more conservative
const conservativeConfig: InputReserveConfig = {
  optimalUtilizationRate: 70,     // Reduce from 80% to 70%
  loanToValueRatio: 65,           // Reduce from 75% to 65%
  liquidationBonus: 8,            // Increase from 5% to 8%
  liquidationThreshold: 75,       // Reduce from 80% to 75%
  minBorrowRate: 2,               // Increase minimum rate
  optimalBorrowRate: 10,          // Increase optimal rate
  maxBorrowRate: 30,              // Increase maximum rate
  borrowFeeWad: "15000000000000000",     // Increase to 1.5%
  flashLoanFeeWad: "5000000000000000",   // Increase to 0.5%
  hostFeePercentage: 25,          // Increase host fee to 25%
  depositLimit: "500000000000000", // Reduce deposit limit
  borrowLimit: "400000000000000",  // Reduce borrow limit
  feeReceiver: treasuryAddress,
};

await updateReserveConfig(
  program,
  marketOwnerKeypair,
  lendingMarketAddress,
  usdcReserveAddress,
  conservativeConfig
);
```

**CLI Example:**
```bash
# Update reserve configuration
solana-borrow-lending update-reserve-config \
  --market 5ZWj7a1TsYKqN1jjsxiH5xRoUakQBBT4F1SkUh9bUW7n \
  --reserve 8GWTTbNiXdmyZREXbjsZBmCRuzdPrW55dnZGDkTRjWvb \
  --owner ./owner-keypair.json \
  --config-file ./new-config.json \
  --rpc-url https://api.mainnet-beta.solana.com

# Example config file (new-config.json):
{
  "optimal_utilization_rate": 70,
  "loan_to_value_ratio": 65,
  "liquidation_bonus": 8,
  "liquidation_threshold": 75,
  "min_borrow_rate": 2,
  "optimal_borrow_rate": 10,
  "max_borrow_rate": 30,
  "borrow_fee_wad": "15000000000000000",
  "flash_loan_fee_wad": "5000000000000000",
  "host_fee_percentage": 25,
  "deposit_limit": "500000000000000",
  "borrow_limit": "400000000000000",
  "fee_receiver": "5ZWj7a1TsYKqN1jjsxiH5xRoUakQBBT4F1SkUh9bUW7n"
}
```

**Common Configuration Scenarios:**

1. **Market Stress Response** - Tighten parameters during volatile periods:
   ```javascript
   const stressConfig = {
     loanToValueRatio: 50,        // Very conservative LTV
     liquidationThreshold: 60,    // Low liquidation threshold
     liquidationBonus: 15,        // High liquidation incentive
     maxBorrowRate: 50,           // Higher max rate to discourage borrowing
   };
   ```

2. **Growth Phase** - Attract users with competitive parameters:
   ```javascript
   const growthConfig = {
     loanToValueRatio: 85,        // Aggressive LTV
     liquidationThreshold: 90,    // Generous threshold
     liquidationBonus: 3,         // Minimal liquidation bonus
     optimalBorrowRate: 5,        // Competitive rates
   };
   ```

3. **Mature Market** - Balanced parameters for stability:
   ```javascript
   const balancedConfig = {
     loanToValueRatio: 75,        // Standard LTV
     liquidationThreshold: 80,    // Reasonable threshold
     liquidationBonus: 5,         // Standard bonus
     optimalBorrowRate: 8,        // Market rate
   };
   ```

**Integration Considerations:**
- Monitor reserve utilization after configuration changes
- Track liquidation activity for parameter effectiveness
- Consider user impact when changing LTV ratios
- Coordinate with frontend applications for parameter display
- Plan configuration updates during low-activity periods

**Related Instructions:**
- [`init_reserve`](#init_reserve) - Create new reserve with initial config
- [`refresh_reserve`](#refresh_reserve) - Update reserve state after config change

---

### Liquidity Operations

Liquidity operations handle the core functionality of providing and withdrawing liquidity from reserves. These operations are available to all users and form the foundation of the lending protocol.

#### `deposit_reserve_liquidity`

**Function Signature:**
```rust
pub fn deposit_reserve_liquidity(
    ctx: Context<DepositReserveLiquidity>,
    liquidity_amount: u64,
) -> Result<()>
```

**Description:**
Deposits liquidity into a reserve in exchange for collateral tokens that represent the depositor's share of the reserve. This is the primary mechanism for users to earn interest by providing liquidity to borrowers.

When users deposit liquidity:
- Their tokens are transferred to the reserve's liquidity supply
- They receive collateral tokens proportional to their share
- They begin earning interest on their deposit immediately
- They can redeem their collateral tokens at any time for underlying liquidity plus accrued interest

The exchange rate between liquidity and collateral tokens constantly increases as interest accrues, allowing depositors to earn yield on their deposits.

**Parameters:**

- `liquidity_amount: u64` - Amount of liquidity to deposit
  - Must be > 0
  - Denominated in the reserve's underlying token units
  - Must not exceed reserve deposit limits
  - User must have sufficient balance in source account

**Accounts:**

1. `source_liquidity: AccountInfo<'info>` - User's token account to debit
   - Must contain at least liquidity_amount tokens
   - Must be owned by the user_transfer_authority
   - Must be for the same mint as the reserve

2. `destination_collateral: AccountInfo<'info>` - User's collateral token account
   - Will receive newly minted collateral tokens
   - Must be for the reserve's collateral mint
   - Can be empty or existing account

3. `reserve: Account<'info, Reserve>` - The reserve to deposit into
   - Must be properly initialized and not stale
   - Must have sufficient capacity for the deposit
   - Interest rates will be updated after deposit

4. `reserve_liquidity_supply: AccountInfo<'info>` - Reserve's liquidity token account
   - Will receive the deposited tokens
   - Must match the reserve's configured supply account
   - Controlled by the lending market authority

5. `reserve_collateral_mint: AccountInfo<'info>` - Collateral token mint
   - Used to mint new collateral tokens for the depositor
   - Must match the reserve's collateral mint
   - Controlled by the lending market authority

6. `lending_market: Box<Account<'info, LendingMarket>>` - The parent lending market
   - Must match the reserve's lending market
   - Provides market-wide configuration
   - Used for authority verification

7. `lending_market_authority: AccountInfo<'info>` - PDA for market operations
   - Derived from the lending market address
   - Authority for minting collateral tokens
   - Authority for reserve token accounts

8. `user_transfer_authority: Signer<'info>` - Authority for the source account
   - Must be able to transfer from source_liquidity
   - Typically the user's wallet
   - Required to authorize the deposit

9. `clock: Sysvar<'info, Clock>` - Clock sysvar for timestamps
10. `token_program: Program<'info, Token>` - SPL Token program

**Account Constraints:**
- Source liquidity account must have sufficient balance
- Reserve must not be stale (recently refreshed)
- Deposit amount must not exceed reserve limits
- All token accounts must match expected mints

**State Changes:**
- Liquidity amount is transferred from user to reserve
- Collateral tokens are minted to user's account
- Reserve liquidity supply increases
- Reserve utilization ratio decreases
- Reserve interest rates may be updated
- Reserve last update timestamp is refreshed

**Interest Calculation:**
The deposit immediately starts earning interest based on the current supply rate:
```
Supply Rate = Borrow Rate × Utilization Rate × (1 - Reserve Factor)
```

The collateral tokens represent a claim on the growing liquidity pool, with exchange rate:
```
Exchange Rate = (Total Liquidity + Accrued Interest) / Total Collateral Tokens
```

**Error Conditions:**
- `InvalidAmount` - If liquidity_amount is zero
- `InsufficientLiquidity` - If source account lacks sufficient tokens
- `DepositLimitExceeded` - If deposit would exceed reserve limits
- `ReserveStale` - If reserve needs to be refreshed first
- `InvalidReserve` - If reserve account is invalid
- `MarketMismatch` - If reserve doesn't belong to the market

**Security Considerations:**
- Always refresh reserve before depositing in the same transaction
- Verify collateral token account ownership
- Check for deposit limits and market conditions
- Monitor reserve utilization after large deposits

**Gas Usage:**
Approximately 25,000-35,000 compute units depending on account states and amount.

**TypeScript Example:**
```typescript
import { PublicKey, Transaction } from '@solana/web3.js';
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token';

async function depositLiquidity(
  program: Program<BorrowLending>,
  user: Keypair,
  reserve: PublicKey,
  amount: number,
  tokenMint: PublicKey
) {
  // Get user's token accounts
  const token = new Token(program.provider.connection, tokenMint, TOKEN_PROGRAM_ID, user);
  const sourceLiquidity = await token.getOrCreateAssociatedAccountInfo(user.publicKey);
  
  // Get reserve data to find collateral mint
  const reserveData = await program.account.reserve.fetch(reserve);
  const collateralMint = reserveData.collateralMint;
  
  // Get user's collateral token account
  const collateralToken = new Token(
    program.provider.connection, 
    collateralMint, 
    TOKEN_PROGRAM_ID, 
    user
  );
  const destinationCollateral = await collateralToken.getOrCreateAssociatedAccountInfo(
    user.publicKey
  );
  
  // Derive lending market authority PDA
  const [lendingMarketAuthority] = await PublicKey.findProgramAddress(
    [reserveData.lendingMarket.toBuffer()],
    program.programId
  );
  
  // Create transaction with refresh and deposit
  const transaction = new Transaction();
  
  // First refresh the reserve
  transaction.add(
    await program.instruction.refreshReserve({
      accounts: {
        reserve: reserve,
        pythPrice: reserveData.liquidity.pythPriceKey,
        clock: SYSVAR_CLOCK_PUBKEY,
      },
    })
  );
  
  // Then deposit liquidity
  transaction.add(
    await program.instruction.depositReserveLiquidity(amount, {
      accounts: {
        sourceLiquidity: sourceLiquidity.address,
        destinationCollateral: destinationCollateral.address,
        reserve: reserve,
        reserveLiquiditySupply: reserveData.liquidity.supply,
        reserveCollateralMint: collateralMint,
        lendingMarket: reserveData.lendingMarket,
        lendingMarketAuthority: lendingMarketAuthority,
        userTransferAuthority: user.publicKey,
        clock: SYSVAR_CLOCK_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      signers: [user],
    })
  );
  
  const signature = await program.provider.send(transaction, [user]);
  console.log(`Liquidity deposited: ${signature}`);
  
  // Calculate collateral tokens received
  const exchangeRate = reserveData.collateralMintTotalSupply.toNumber() > 0
    ? reserveData.liquidity.availableAmount.toNumber() / reserveData.collateralMintTotalSupply.toNumber()
    : 1;
  const collateralReceived = amount / exchangeRate;
  
  console.log(`Received ${collateralReceived} collateral tokens`);
  return signature;
}

// Example: Deposit 1000 USDC
const usdcMint = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const usdcReserve = new PublicKey("8GWTTbNiXdmyZREXbjsZBmCRuzdPrW55dnZGDkTRjWvb");

await depositLiquidity(
  program,
  userKeypair,
  usdcReserve,
  1000 * 1e6, // 1000 USDC (6 decimals)
  usdcMint
);
```

**CLI Example:**
```bash
# Deposit liquidity to a reserve
solana-borrow-lending deposit \
  --reserve 8GWTTbNiXdmyZREXbjsZBmCRuzdPrW55dnZGDkTRjWvb \
  --amount 1000 \
  --user ./user-keypair.json \
  --rpc-url https://api.mainnet-beta.solana.com

# Check balance after deposit
solana-borrow-lending balance \
  --user ./user-keypair.json \
  --reserve 8GWTTbNiXdmyZREXbjsZBmCRuzdPrW55dnZGDkTRjWvb
```

**Advanced Usage - Batch Deposits:**
```typescript
async function batchDepositToMultipleReserves(
  program: Program<BorrowLending>,
  user: Keypair,
  deposits: Array<{ reserve: PublicKey; amount: number; mint: PublicKey }>
) {
  const transaction = new Transaction();
  
  // Refresh all reserves first
  for (const deposit of deposits) {
    const reserveData = await program.account.reserve.fetch(deposit.reserve);
    transaction.add(
      await program.instruction.refreshReserve({
        accounts: {
          reserve: deposit.reserve,
          pythPrice: reserveData.liquidity.pythPriceKey,
          clock: SYSVAR_CLOCK_PUBKEY,
        },
      })
    );
  }
  
  // Then add all deposits
  for (const deposit of deposits) {
    // ... setup accounts for each deposit
    transaction.add(
      await program.instruction.depositReserveLiquidity(deposit.amount, {
        accounts: {
          // ... deposit accounts
        },
      })
    );
  }
  
  return await program.provider.send(transaction, [user]);
}
```

**Integration Considerations:**
- Always refresh reserves before deposits for accurate exchange rates
- Handle collateral token account creation for new users
- Consider transaction size limits for batch operations
- Monitor reserve capacity before large deposits
- Implement slippage protection for large amounts

**Yield Calculation Example:**
```typescript
async function calculateDepositYield(
  program: Program<BorrowLending>,
  reserve: PublicKey,
  depositAmount: number,
  timeHorizonDays: number
) {
  const reserveData = await program.account.reserve.fetch(reserve);
  
  // Current supply rate (annual)
  const currentSupplyRate = reserveData.currentSupplyRate;
  
  // Convert to daily rate
  const dailyRate = currentSupplyRate / 365;
  
  // Calculate compound interest
  const finalAmount = depositAmount * Math.pow(1 + dailyRate, timeHorizonDays);
  const yieldEarned = finalAmount - depositAmount;
  
  return {
    finalAmount,
    yieldEarned,
    apr: currentSupplyRate,
    apy: Math.pow(1 + dailyRate, 365) - 1,
  };
}
```

**Related Instructions:**
- [`redeem_reserve_collateral`](#redeem_reserve_collateral) - Withdraw deposited liquidity
- [`refresh_reserve`](#refresh_reserve) - Update reserve rates before deposit
- [`init_obligation`](#init_obligation) - Create obligation to use deposits as collateral

---

#### `redeem_reserve_collateral`

**Function Signature:**
```rust
pub fn redeem_reserve_collateral(
    ctx: Context<RedeemReserveCollateral>,
    collateral_amount: u64,
) -> Result<()>
```

**Description:**
Redeems collateral tokens back to the underlying liquidity, allowing users to withdraw their deposits plus any accrued interest. This is the counterpart to deposit operations and enables users to exit their lending positions.

When users redeem collateral:
- Their collateral tokens are burned
- They receive underlying liquidity based on the current exchange rate
- The amount received includes their original deposit plus accrued interest
- The reserve's available liquidity decreases

The exchange rate between collateral tokens and underlying liquidity constantly increases as interest accrues, ensuring depositors receive their share of the earned interest.

**Parameters:**

- `collateral_amount: u64` - Amount of collateral tokens to redeem
  - Must be > 0
  - Must not exceed user's collateral token balance
  - Denominated in collateral token units (usually 1:1 with underlying decimals)
  - Will be burned in exchange for underlying liquidity

**Accounts:**

1. `source_collateral: AccountInfo<'info>` - User's collateral token account
   - Must contain at least collateral_amount tokens
   - Must be owned by the user_transfer_authority
   - Tokens will be burned from this account

2. `destination_liquidity: AccountInfo<'info>` - User's liquidity token account
   - Will receive the redeemed underlying tokens
   - Must be for the same mint as the reserve
   - Can be empty or existing account

3. `reserve: Account<'info, Reserve>` - The reserve to redeem from
   - Must be properly initialized and not stale
   - Must have sufficient available liquidity
   - Interest rates will be updated after redemption

4. `reserve_collateral_mint: AccountInfo<'info>` - Collateral token mint
   - Used to burn redeemed collateral tokens
   - Must match the reserve's collateral mint
   - Controlled by the lending market authority

5. `reserve_liquidity_supply: AccountInfo<'info>` - Reserve's liquidity token account
   - Source of liquidity for redemption
   - Must match the reserve's configured supply account
   - Controlled by the lending market authority

6. `lending_market: Box<Account<'info, LendingMarket>>` - The parent lending market
   - Must match the reserve's lending market
   - Provides market-wide configuration
   - Used for authority verification

7. `lending_market_authority: AccountInfo<'info>` - PDA for market operations
   - Derived from the lending market address
   - Authority for burning collateral tokens
   - Authority for transferring liquidity

8. `user_transfer_authority: Signer<'info>` - Authority for the collateral account
   - Must be able to transfer from source_collateral
   - Typically the user's wallet
   - Required to authorize the redemption

9. `clock: Sysvar<'info, Clock>` - Clock sysvar for timestamps
10. `token_program: Program<'info, Token>` - SPL Token program

**Account Constraints:**
- Source collateral account must have sufficient balance
- Reserve must not be stale (recently refreshed)
- Reserve must have sufficient available liquidity
- All token accounts must match expected mints

**State Changes:**
- Collateral tokens are burned from user's account
- Liquidity tokens are transferred from reserve to user
- Reserve liquidity supply decreases
- Reserve collateral mint total supply decreases
- Reserve utilization ratio increases
- Reserve interest rates may be updated
- Reserve last update timestamp is refreshed

**Exchange Rate Calculation:**
The amount of liquidity received is calculated based on the current exchange rate:
```
Liquidity Amount = Collateral Amount × Exchange Rate

Where Exchange Rate = (Total Liquidity + Accrued Interest) / Total Collateral Supply
```

As interest accrues over time, the exchange rate increases, allowing users to redeem more liquidity than they originally deposited.

**Error Conditions:**
- `InvalidAmount` - If collateral_amount is zero
- `InsufficientLiquidity` - If reserve lacks sufficient available liquidity
- `InsufficientCollateral` - If user lacks sufficient collateral tokens
- `ReserveStale` - If reserve needs to be refreshed first
- `InvalidReserve` - If reserve account is invalid
- `MarketMismatch` - If reserve doesn't belong to the market

**Security Considerations:**
- Always refresh reserve before redemption for accurate exchange rates
- Verify sufficient liquidity availability before large redemptions
- Check for withdrawal limits and market conditions
- Monitor reserve utilization after large redemptions

**Liquidity Calculation:**
```typescript
function calculateRedemptionAmount(
  collateralAmount: number,
  totalLiquidity: number,
  totalCollateral: number
): number {
  if (totalCollateral === 0) return 0;
  
  const exchangeRate = totalLiquidity / totalCollateral;
  return collateralAmount * exchangeRate;
}
```

**TypeScript Example:**
```typescript
async function redeemCollateral(
  program: Program<BorrowLending>,
  user: Keypair,
  reserve: PublicKey,
  collateralAmount: number
) {
  // Get reserve data to find token mints and accounts
  const reserveData = await program.account.reserve.fetch(reserve);
  const collateralMint = reserveData.collateralMint;
  const liquidityMint = reserveData.liquidity.mint;
  
  // Get user's collateral token account
  const collateralToken = new Token(
    program.provider.connection, 
    collateralMint, 
    TOKEN_PROGRAM_ID, 
    user
  );
  const sourceCollateral = await collateralToken.getOrCreateAssociatedAccountInfo(
    user.publicKey
  );
  
  // Get user's liquidity token account
  const liquidityToken = new Token(
    program.provider.connection, 
    liquidityMint, 
    TOKEN_PROGRAM_ID, 
    user
  );
  const destinationLiquidity = await liquidityToken.getOrCreateAssociatedAccountInfo(
    user.publicKey
  );
  
  // Derive lending market authority PDA
  const [lendingMarketAuthority] = await PublicKey.findProgramAddress(
    [reserveData.lendingMarket.toBuffer()],
    program.programId
  );
  
  // Calculate expected liquidity amount
  const totalLiquidity = reserveData.liquidity.availableAmount.toNumber();
  const totalCollateral = reserveData.collateralMintTotalSupply.toNumber();
  const expectedLiquidity = calculateRedemptionAmount(
    collateralAmount, 
    totalLiquidity, 
    totalCollateral
  );
  
  console.log(`Redeeming ${collateralAmount} collateral for ~${expectedLiquidity} liquidity`);
  
  // Create transaction with refresh and redemption
  const transaction = new Transaction();
  
  // First refresh the reserve
  transaction.add(
    await program.instruction.refreshReserve({
      accounts: {
        reserve: reserve,
        pythPrice: reserveData.liquidity.pythPriceKey,
        clock: SYSVAR_CLOCK_PUBKEY,
      },
    })
  );
  
  // Then redeem collateral
  transaction.add(
    await program.instruction.redeemReserveCollateral(collateralAmount, {
      accounts: {
        sourceCollateral: sourceCollateral.address,
        destinationLiquidity: destinationLiquidity.address,
        reserve: reserve,
        reserveCollateralMint: collateralMint,
        reserveLiquiditySupply: reserveData.liquidity.supply,
        lendingMarket: reserveData.lendingMarket,
        lendingMarketAuthority: lendingMarketAuthority,
        userTransferAuthority: user.publicKey,
        clock: SYSVAR_CLOCK_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      signers: [user],
    })
  );
  
  const signature = await program.provider.send(transaction, [user]);
  console.log(`Collateral redeemed: ${signature}`);
  
  return signature;
}

// Example: Redeem all USDC collateral tokens
const usdcReserve = new PublicKey("8GWTTbNiXdmyZREXbjsZBmCRuzdPrW55dnZGDkTRjWvb");

// Get user's collateral balance first
const reserveData = await program.account.reserve.fetch(usdcReserve);
const collateralToken = new Token(
  program.provider.connection,
  reserveData.collateralMint,
  TOKEN_PROGRAM_ID,
  userKeypair
);
const collateralAccount = await collateralToken.getAccountInfo(
  await collateralToken.getOrCreateAssociatedAccountInfo(userKeypair.publicKey)
);

await redeemCollateral(
  program,
  userKeypair,
  usdcReserve,
  collateralAccount.amount.toNumber() // Redeem all collateral
);
```

**CLI Example:**
```bash
# Redeem collateral tokens
solana-borrow-lending redeem \
  --reserve 8GWTTbNiXdmyZREXbjsZBmCRuzdPrW55dnZGDkTRjWvb \
  --amount 1000 \
  --user ./user-keypair.json \
  --rpc-url https://api.mainnet-beta.solana.com

# Redeem all collateral tokens
solana-borrow-lending redeem-all \
  --reserve 8GWTTbNiXdmyZREXbjsZBmCRuzdPrW55dnZGDkTRjWvb \
  --user ./user-keypair.json \
  --rpc-url https://api.mainnet-beta.solana.com
```

**Partial Redemption Strategy:**
```typescript
async function redeemPartial(
  program: Program<BorrowLending>,
  user: Keypair,
  reserve: PublicKey,
  targetLiquidityAmount: number
) {
  const reserveData = await program.account.reserve.fetch(reserve);
  
  // Calculate required collateral amount for target liquidity
  const totalLiquidity = reserveData.liquidity.availableAmount.toNumber();
  const totalCollateral = reserveData.collateralMintTotalSupply.toNumber();
  const exchangeRate = totalLiquidity / totalCollateral;
  
  const requiredCollateral = Math.ceil(targetLiquidityAmount / exchangeRate);
  
  return await redeemCollateral(program, user, reserve, requiredCollateral);
}

// Example: Redeem exactly 500 USDC worth of collateral
await redeemPartial(program, userKeypair, usdcReserve, 500 * 1e6);
```

**Emergency Withdrawal Pattern:**
```typescript
async function emergencyWithdrawAll(
  program: Program<BorrowLending>,
  user: Keypair,
  reserves: PublicKey[]
) {
  const signatures = [];
  
  for (const reserve of reserves) {
    try {
      // Get user's collateral balance
      const reserveData = await program.account.reserve.fetch(reserve);
      const collateralToken = new Token(
        program.provider.connection,
        reserveData.collateralMint,
        TOKEN_PROGRAM_ID,
        user
      );
      
      const collateralAccount = await collateralToken.getAccountInfo(
        await collateralToken.getOrCreateAssociatedAccountInfo(user.publicKey)
      );
      
      if (collateralAccount.amount.toNumber() > 0) {
        const signature = await redeemCollateral(
          program,
          user,
          reserve,
          collateralAccount.amount.toNumber()
        );
        signatures.push(signature);
      }
    } catch (error) {
      console.error(`Failed to withdraw from reserve ${reserve}:`, error);
    }
  }
  
  return signatures;
}
```

**Yield Realization Example:**
```typescript
async function calculateYieldRealized(
  program: Program<BorrowLending>,
  user: PublicKey,
  reserve: PublicKey,
  originalDepositAmount: number,
  collateralAmount: number
) {
  const reserveData = await program.account.reserve.fetch(reserve);
  
  // Calculate current liquidity value of collateral
  const totalLiquidity = reserveData.liquidity.availableAmount.toNumber();
  const totalCollateral = reserveData.collateralMintTotalSupply.toNumber();
  const currentValue = calculateRedemptionAmount(
    collateralAmount,
    totalLiquidity,
    totalCollateral
  );
  
  const yieldEarned = currentValue - originalDepositAmount;
  const yieldPercentage = (yieldEarned / originalDepositAmount) * 100;
  
  return {
    originalDeposit: originalDepositAmount,
    currentValue: currentValue,
    yieldEarned: yieldEarned,
    yieldPercentage: yieldPercentage,
  };
}
```

**Integration Considerations:**
- Always refresh reserves before redemption for accurate exchange rates
- Handle insufficient liquidity scenarios gracefully
- Consider transaction size limits for batch redemptions
- Implement slippage protection for large amounts
- Monitor reserve capacity after large withdrawals
- Provide clear yield calculations to users

**Related Instructions:**
- [`deposit_reserve_liquidity`](#deposit_reserve_liquidity) - Deposit liquidity to receive collateral
- [`refresh_reserve`](#refresh_reserve) - Update reserve rates before redemption
- [`withdraw_obligation_collateral`](#withdraw_obligation_collateral) - Withdraw collateral from obligations

---

### Obligation Management

Obligation management instructions handle borrowing positions and collateral management. Obligations represent individual borrower accounts that track collateral deposits and outstanding loans across multiple reserves.

#### `init_obligation`

**Function Signature:**
```rust
pub fn init_obligation(
    ctx: Context<InitObligation>,
) -> Result<()>
```

**Description:**
Initializes a new obligation account for a user within a specific lending market. An obligation serves as a borrower's account that tracks all their collateral deposits and outstanding loans across different reserves in the market.

Each obligation maintains:
- Collateral deposits from multiple reserves
- Outstanding borrows from multiple reserves
- Health factor and liquidation risk calculations
- Last update timestamps for staleness tracking
- Owner information for access control

Users must create an obligation before they can deposit collateral or borrow assets from the lending protocol.

**Parameters:**
This instruction takes no additional parameters beyond the accounts context.

**Accounts:**

1. `owner: Signer<'info>` - The user who will own the obligation
   - Must be a signer to authorize obligation creation
   - Will have exclusive control over the obligation
   - Can deposit collateral and borrow against it

2. `lending_market: Box<Account<'info, LendingMarket>>` - The parent lending market
   - Must be properly initialized
   - Obligation will be linked to this specific market
   - Cannot be changed after initialization

3. `obligation: AccountLoader<'info, Obligation>` - The obligation account to initialize
   - Must be empty (zero-initialized)
   - Will store all obligation state and positions
   - Size: 916 bytes for complete obligation data

4. `clock: Sysvar<'info, Clock>` - Clock sysvar for timestamps

**Account Constraints:**
- Obligation account must be empty (zero-initialized)
- Lending market must be properly initialized
- Owner must be a signer

**State Changes:**
After successful execution:
- Obligation account is initialized with owner and market information
- Last update timestamp is set to current slot
- Obligation is ready to receive collateral deposits
- All deposit and borrow arrays are empty initially

**Error Conditions:**
- `ObligationAlreadyInitialized` - If obligation account is not empty
- `MarketNotFound` - If lending market account is invalid
- `InvalidAuthority` - If owner is not a valid signer

**Security Considerations:**
- Each user should only create one obligation per market
- Obligation ownership cannot be transferred after creation
- Always verify obligation ownership before operations

**TypeScript Example:**
```typescript
import { PublicKey, Keypair, SystemProgram } from '@solana/web3.js';

async function createObligation(
  program: Program<BorrowLending>,
  user: Keypair,
  lendingMarket: PublicKey
) {
  const obligationKeypair = Keypair.generate();
  
  const signature = await program.rpc.initObligation({
    accounts: {
      owner: user.publicKey,
      lendingMarket: lendingMarket,
      obligation: obligationKeypair.publicKey,
      clock: SYSVAR_CLOCK_PUBKEY,
    },
    signers: [user, obligationKeypair],
    preInstructions: [
      SystemProgram.createAccount({
        fromPubkey: user.publicKey,
        newAccountPubkey: obligationKeypair.publicKey,
        space: 916, // Obligation account size
        lamports: await program.provider.connection.getMinimumBalanceForRentExemption(916),
        programId: program.programId,
      }),
    ],
  });
  
  console.log(`Obligation created: ${signature}`);
  console.log(`Obligation address: ${obligationKeypair.publicKey.toString()}`);
  
  return obligationKeypair.publicKey;
}

// Example: Create obligation for user
const obligationAddress = await createObligation(
  program,
  userKeypair,
  lendingMarketAddress
);
```

**CLI Example:**
```bash
# Create a new obligation
solana-borrow-lending init-obligation \
  --market 5ZWj7a1TsYKqN1jjsxiH5xRoUakQBBT4F1SkUh9bUW7n \
  --user ./user-keypair.json \
  --rpc-url https://api.mainnet-beta.solana.com
```

**Obligation State Structure:**
```rust
pub struct Obligation {
    /// Owner of the obligation
    pub owner: Pubkey,
    /// Lending market this obligation belongs to
    pub lending_market: Pubkey,
    /// Deposited collateral for the obligation
    pub deposits: Vec<ObligationCollateral>,
    /// Borrowed liquidity for the obligation
    pub borrows: Vec<ObligationLiquidity>,
    /// Last update information
    pub last_update: LastUpdate,
    /// Deposited value in USD
    pub deposited_value: Decimal,
    /// Borrowed value in USD
    pub borrowed_value: Decimal,
    /// Allowed borrow value based on deposits
    pub allowed_borrow_value: Decimal,
    /// Unhealthy borrow value threshold
    pub unhealthy_borrow_value: Decimal,
}
```

**Integration Considerations:**
- Store obligation addresses for future operations
- One obligation per user per market is recommended
- Obligation creation is required before any borrowing operations
- Consider batch creation for multiple users

**Related Instructions:**
- [`deposit_obligation_collateral`](#deposit_obligation_collateral) - Add collateral to obligation
- [`borrow_obligation_liquidity`](#borrow_obligation_liquidity) - Borrow against collateral
- [`refresh_obligation`](#refresh_obligation) - Update obligation state

---

#### `deposit_obligation_collateral`

**Function Signature:**
```rust
pub fn deposit_obligation_collateral(
    ctx: Context<DepositObligationCollateral>,
    collateral_amount: u64,
) -> Result<()>
```

**Description:**
Deposits collateral tokens from a reserve into an obligation, making them available as collateral for borrowing. This operation converts reserve collateral tokens (representing deposited liquidity) into obligation collateral that can be used to secure loans.

When users deposit collateral into an obligation:
- Their reserve collateral tokens are transferred to the obligation
- The collateral becomes available for calculating borrowing capacity
- The user's health factor and allowed borrow value are updated
- The collateral continues earning interest from the underlying reserve

This is a key operation that bridges lending (via reserves) and borrowing (via obligations).

**Parameters:**

- `collateral_amount: u64` - Amount of collateral tokens to deposit
  - Must be > 0
  - Denominated in reserve collateral token units
  - Must not exceed user's collateral token balance
  - Must not exceed obligation or reserve limits

**Accounts:**

1. `source_collateral: AccountInfo<'info>` - User's collateral token account
   - Must contain at least collateral_amount tokens
   - Must be owned by the transfer_authority
   - Tokens will be transferred to obligation

2. `destination_collateral: AccountInfo<'info>` - Obligation's collateral token account
   - Will receive the deposited collateral tokens
   - Must be for the same mint as source_collateral
   - Controlled by the lending market authority

3. `reserve: Box<Account<'info, Reserve>>` - The reserve providing collateral
   - Must be properly initialized and not stale
   - Defines the asset type and collateral parameters
   - Must belong to the same market as obligation

4. `obligation: AccountLoader<'info, Obligation>` - The obligation receiving collateral
   - Must be properly initialized and not stale
   - Must be owned by the transfer_authority
   - Will track the new collateral deposit

5. `lending_market: Box<Account<'info, LendingMarket>>` - The parent lending market
   - Must match both reserve and obligation markets
   - Provides market-wide configuration
   - Used for authority verification

6. `obligation_owner: Signer<'info>` - Owner of the obligation
   - Must match the owner stored in the obligation
   - Required to authorize collateral deposits
   - Typically the borrower's wallet

7. `transfer_authority: Signer<'info>` - Authority for collateral transfer
   - Must be able to transfer from source_collateral
   - Usually the same as obligation_owner
   - Required to authorize the token transfer

8. `clock: Sysvar<'info, Clock>` - Clock sysvar for timestamps
9. `token_program: Program<'info, Token>` - SPL Token program

**Account Constraints:**
- Source collateral account must have sufficient balance
- Obligation and reserve must not be stale
- Obligation must be owned by the signer
- Reserve must belong to the same market as obligation

**State Changes:**
- Collateral tokens are transferred from user to obligation
- Obligation's deposits array is updated with new collateral
- Obligation's deposited value increases
- Obligation's allowed borrow value increases
- Last update timestamps are refreshed

**Collateral Value Calculation:**
The collateral value is calculated using current prices and LTV ratios:
```
Collateral Value = Token Amount × Exchange Rate × Token Price × LTV Ratio

Where:
- Exchange Rate = Reserve collateral tokens to underlying liquidity
- Token Price = Current price from Pyth oracle
- LTV Ratio = Maximum loan-to-value for the reserve
```

**Health Factor Impact:**
Depositing collateral improves the obligation's health factor:
```
Health Factor = Total Collateral Value / Total Borrowed Value

Allowed Borrow Value = Total Collateral Value × Average LTV
```

**Error Conditions:**
- `InvalidAmount` - If collateral_amount is zero
- `InsufficientCollateral` - If source account lacks sufficient tokens
- `ObligationStale` - If obligation needs refreshing
- `ReserveStale` - If reserve needs refreshing
- `IllegalOwner` - If signer is not the obligation owner
- `MarketMismatch` - If reserve and obligation are in different markets

**Security Considerations:**
- Always refresh obligation and reserve before depositing
- Verify collateral token mint matches reserve
- Check for deposit limits and market conditions
- Monitor health factor after deposits

**TypeScript Example:**
```typescript
async function depositCollateral(
  program: Program<BorrowLending>,
  user: Keypair,
  obligation: PublicKey,
  reserve: PublicKey,
  collateralAmount: number
) {
  // Get obligation and reserve data
  const obligationData = await program.account.obligation.fetch(obligation);
  const reserveData = await program.account.reserve.fetch(reserve);
  
  // Get user's collateral token account
  const collateralMint = reserveData.collateralMint;
  const collateralToken = new Token(
    program.provider.connection, 
    collateralMint, 
    TOKEN_PROGRAM_ID, 
    user
  );
  const sourceCollateral = await collateralToken.getOrCreateAssociatedAccountInfo(
    user.publicKey
  );
  
  // Derive obligation collateral account
  const [destinationCollateral] = await PublicKey.findProgramAddress(
    [
      Buffer.from("collateral"),
      obligation.toBuffer(),
      reserve.toBuffer(),
    ],
    program.programId
  );
  
  // Create transaction with refreshes and deposit
  const transaction = new Transaction();
  
  // Refresh reserve first
  transaction.add(
    await program.instruction.refreshReserve({
      accounts: {
        reserve: reserve,
        pythPrice: reserveData.liquidity.pythPriceKey,
        clock: SYSVAR_CLOCK_PUBKEY,
      },
    })
  );
  
  // Refresh obligation
  transaction.add(
    await program.instruction.refreshObligation({
      accounts: {
        obligation: obligation,
        clock: SYSVAR_CLOCK_PUBKEY,
      },
      remainingAccounts: [
        { pubkey: reserve, isWritable: false, isSigner: false },
      ],
    })
  );
  
  // Deposit collateral
  transaction.add(
    await program.instruction.depositObligationCollateral(collateralAmount, {
      accounts: {
        sourceCollateral: sourceCollateral.address,
        destinationCollateral: destinationCollateral,
        reserve: reserve,
        obligation: obligation,
        lendingMarket: obligationData.lendingMarket,
        obligationOwner: user.publicKey,
        transferAuthority: user.publicKey,
        clock: SYSVAR_CLOCK_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      signers: [user],
    })
  );
  
  const signature = await program.provider.send(transaction, [user]);
  console.log(`Collateral deposited: ${signature}`);
  
  // Calculate new borrowing capacity
  const collateralValue = await calculateCollateralValue(
    program, 
    reserve, 
    collateralAmount
  );
  console.log(`Added $${collateralValue} in collateral value`);
  
  return signature;
}

async function calculateCollateralValue(
  program: Program<BorrowLending>,
  reserve: PublicKey,
  collateralAmount: number
): Promise<number> {
  const reserveData = await program.account.reserve.fetch(reserve);
  
  // Get exchange rate from collateral to liquidity
  const totalLiquidity = reserveData.liquidity.availableAmount.toNumber();
  const totalCollateral = reserveData.collateralMintTotalSupply.toNumber();
  const exchangeRate = totalLiquidity / totalCollateral;
  
  // Convert to underlying liquidity amount
  const liquidityAmount = collateralAmount * exchangeRate;
  
  // Get current price (mock implementation)
  const price = await getPythPrice(reserveData.liquidity.pythPriceKey);
  
  // Calculate value with LTV applied
  const ltv = reserveData.config.loanToValueRatio / 100;
  const collateralValue = liquidityAmount * price * ltv;
  
  return collateralValue;
}

// Example: Deposit USDC collateral
const usdcReserve = new PublicKey("8GWTTbNiXdmyZREXbjsZBmCRuzdPrW55dnZGDkTRjWvb");
await depositCollateral(
  program,
  userKeypair,
  obligationAddress,
  usdcReserve,
  1000 * 1e6 // 1000 USDC collateral tokens
);
```

**CLI Example:**
```bash
# Deposit collateral to obligation
solana-borrow-lending deposit-collateral \
  --obligation 5ZWj7a1TsYKqN1jjsxiH5xRoUakQBBT4F1SkUh9bUW7n \
  --reserve 8GWTTbNiXdmyZREXbjsZBmCRuzdPrW55dnZGDkTRjWvb \
  --amount 1000 \
  --user ./user-keypair.json \
  --rpc-url https://api.mainnet-beta.solana.com
```

**Multi-Asset Collateral Strategy:**
```typescript
async function depositMultipleCollaterals(
  program: Program<BorrowLending>,
  user: Keypair,
  obligation: PublicKey,
  deposits: Array<{ reserve: PublicKey; amount: number }>
) {
  const transaction = new Transaction();
  
  // Get all unique reserves for refreshing
  const uniqueReserves = [...new Set(deposits.map(d => d.reserve.toString()))]
    .map(r => new PublicKey(r));
  
  // Refresh all reserves
  for (const reserve of uniqueReserves) {
    const reserveData = await program.account.reserve.fetch(reserve);
    transaction.add(
      await program.instruction.refreshReserve({
        accounts: {
          reserve: reserve,
          pythPrice: reserveData.liquidity.pythPriceKey,
          clock: SYSVAR_CLOCK_PUBKEY,
        },
      })
    );
  }
  
  // Refresh obligation with all reserves
  transaction.add(
    await program.instruction.refreshObligation({
      accounts: {
        obligation: obligation,
        clock: SYSVAR_CLOCK_PUBKEY,
      },
      remainingAccounts: uniqueReserves.map(reserve => ({
        pubkey: reserve,
        isWritable: false,
        isSigner: false,
      })),
    })
  );
  
  // Add all collateral deposits
  for (const deposit of deposits) {
    // ... setup accounts for each deposit
    transaction.add(
      await program.instruction.depositObligationCollateral(deposit.amount, {
        accounts: {
          // ... deposit accounts
        },
      })
    );
  }
  
  return await program.provider.send(transaction, [user]);
}

// Example: Deposit multiple assets as collateral
await depositMultipleCollaterals(
  program,
  userKeypair,
  obligationAddress,
  [
    { reserve: usdcReserve, amount: 1000 * 1e6 },  // 1000 USDC
    { reserve: solReserve, amount: 10 * 1e9 },     // 10 SOL
    { reserve: btcReserve, amount: 0.1 * 1e8 },    // 0.1 BTC
  ]
);
```

**Health Factor Monitoring:**
```typescript
async function getObligationHealthFactor(
  program: Program<BorrowLending>,
  obligation: PublicKey
): Promise<number> {
  const obligationData = await program.account.obligation.fetch(obligation);
  
  const totalCollateralValue = obligationData.depositedValue.toNumber();
  const totalBorrowedValue = obligationData.borrowedValue.toNumber();
  
  if (totalBorrowedValue === 0) {
    return Infinity; // No debt, infinite health factor
  }
  
  return totalCollateralValue / totalBorrowedValue;
}

async function monitorHealthFactor(
  program: Program<BorrowLending>,
  obligation: PublicKey,
  minHealthFactor: number = 1.2
) {
  const healthFactor = await getObligationHealthFactor(program, obligation);
  
  console.log(`Current health factor: ${healthFactor.toFixed(2)}`);
  
  if (healthFactor < minHealthFactor) {
    console.warn(`⚠️  Health factor below ${minHealthFactor}! Risk of liquidation.`);
    return false;
  }
  
  return true;
}
```

**Integration Considerations:**
- Always refresh both obligation and reserves before depositing
- Handle collateral token account creation for new deposits
- Monitor health factor improvements after deposits
- Consider transaction size limits for multi-asset deposits
- Implement health factor monitoring and alerts
- Provide clear collateral value calculations to users

**Related Instructions:**
- [`withdraw_obligation_collateral`](#withdraw_obligation_collateral) - Remove collateral from obligation
- [`borrow_obligation_liquidity`](#borrow_obligation_liquidity) - Borrow against collateral
- [`refresh_obligation`](#refresh_obligation) - Update obligation calculations

---

#### `borrow_obligation_liquidity`

**Function Signature:**
```rust
pub fn borrow_obligation_liquidity(
    ctx: Context<BorrowObligationLiquidity>,
    lending_market_bump_seed: u8,
    liquidity_amount: u64,
) -> Result<()>
```

**Description:**
Borrows liquidity from a reserve against collateral deposited in an obligation. This is the core borrowing operation that allows users to access liquidity while maintaining their collateral positions.

When users borrow against their collateral:
- Liquidity is transferred from the reserve to the user
- A borrow position is created/updated in the obligation
- Interest begins accruing on the borrowed amount immediately
- The user's health factor decreases based on the new debt
- Borrowing fees are collected by the protocol

The amount that can be borrowed is limited by the collateral value and loan-to-value ratios of the deposited assets.

**Parameters:**

- `lending_market_bump_seed: u8` - Bump seed for the lending market PDA
  - Used to derive the lending market authority
  - Must match the canonical bump for the market
  - Required for signing token transfers

- `liquidity_amount: u64` - Amount of liquidity to borrow
  - Must be > 0
  - Denominated in the reserve's underlying token units
  - Must not exceed available borrow capacity
  - Must not exceed reserve's available liquidity

**Accounts:**

1. `borrower: Signer<'info>` - Owner of the obligation
   - Must match the owner stored in the obligation
   - Required to authorize borrowing operations
   - Will receive the borrowed liquidity

2. `obligation: AccountLoader<'info, Obligation>` - The obligation with collateral
   - Must be properly initialized and not stale
   - Must have sufficient collateral for the borrow
   - Must be owned by the borrower

3. `reserve: Box<Account<'info, Reserve>>` - The reserve to borrow from
   - Must be properly initialized and not stale
   - Must have sufficient available liquidity
   - Must belong to the same market as obligation

4. `lending_market_pda: AccountInfo<'info>` - PDA for lending market authority
   - Derived from lending market address with bump seed
   - Authority for transferring reserve liquidity
   - Signs the token transfer on behalf of the protocol

5. `source_liquidity_wallet: AccountInfo<'info>` - Reserve's liquidity supply
   - Contains the protocol's liquidity for lending
   - Must match the reserve's configured supply account
   - Source of the borrowed tokens

6. `destination_liquidity_wallet: AccountInfo<'info>` - Borrower's token account
   - Will receive the borrowed liquidity
   - Must be for the same mint as the reserve
   - Must not be the same as source liquidity wallet

7. `fee_receiver: AccountInfo<'info>` - Protocol's fee collection account
   - Receives borrowing fees
   - Must match the reserve's configured fee receiver
   - Must be for the same mint as the reserve

8. `token_program: Program<'info, Token>` - SPL Token program
9. `clock: Sysvar<'info, Clock>` - Clock sysvar for timestamps

**Remaining Accounts:**
- Optional host fee receiver for additional fee distribution

**Account Constraints:**
- Borrower must be the obligation owner
- Obligation must have sufficient collateral
- Reserve must have available liquidity
- All accounts must be properly initialized and not stale

**State Changes:**
- Liquidity is transferred from reserve to borrower
- Borrow position is created/updated in obligation
- Reserve's available liquidity decreases
- Reserve's total borrows increase
- Obligation's borrowed value increases
- Interest accrual begins on the new borrow
- Borrowing fees are collected

**Borrowing Capacity Calculation:**
The maximum borrow amount is limited by collateral value:
```
Max Borrow Amount = (Total Collateral Value × Average LTV) - Current Borrowed Value

Health Factor After Borrow = Total Collateral Value / (Current Borrowed Value + New Borrow Value)
```

The borrow must maintain a health factor above 1.0 to avoid immediate liquidation risk.

**Fee Structure:**
Borrowing incurs fees that are split between protocol and optional host:
```
Total Borrow Amount = Liquidity Amount + Borrowing Fees
Borrowing Fee = Liquidity Amount × Borrow Fee Rate
Host Fee = Borrowing Fee × Host Fee Percentage
Protocol Fee = Borrowing Fee - Host Fee
```

**Interest Accrual:**
Interest begins accruing immediately at the current borrow rate:
```
Interest = Principal × Borrow Rate × Time
Current Borrow Rate = Base Rate + (Utilization Rate × Slope)
```

**Error Conditions:**
- `InvalidAmount` - If liquidity_amount is zero
- `BorrowTooLarge` - If borrow exceeds collateral capacity
- `InsufficientLiquidity` - If reserve lacks available liquidity
- `IllegalOwner` - If borrower is not the obligation owner
- `ObligationStale` - If obligation needs refreshing
- `ReserveStale` - If reserve needs refreshing
- `EmptyCollateral` - If obligation has no deposited collateral

**Security Considerations:**
- Always refresh obligation and reserve before borrowing
- Verify sufficient collateral before large borrows
- Monitor health factor to avoid liquidation
- Check reserve liquidity availability
- Validate all fee calculations

**TypeScript Example:**
```typescript
async function borrowLiquidity(
  program: Program<BorrowLending>,
  borrower: Keypair,
  obligation: PublicKey,
  reserve: PublicKey,
  borrowAmount: number
) {
  // Get obligation and reserve data
  const obligationData = await program.account.obligation.fetch(obligation);
  const reserveData = await program.account.reserve.fetch(reserve);
  
  // Derive lending market PDA and bump
  const [lendingMarketPda, lendingMarketBump] = await PublicKey.findProgramAddress(
    [obligationData.lendingMarket.toBuffer()],
    program.programId
  );
  
  // Get borrower's token account for receiving liquidity
  const liquidityMint = reserveData.liquidity.mint;
  const liquidityToken = new Token(
    program.provider.connection, 
    liquidityMint, 
    TOKEN_PROGRAM_ID, 
    borrower
  );
  const destinationLiquidity = await liquidityToken.getOrCreateAssociatedAccountInfo(
    borrower.publicKey
  );
  
  // Check borrowing capacity before attempting
  const maxBorrowCapacity = await calculateMaxBorrowCapacity(program, obligation);
  console.log(`Max borrow capacity: $${maxBorrowCapacity}`);
  
  if (borrowAmount > maxBorrowCapacity) {
    throw new Error(`Borrow amount exceeds capacity. Max: ${maxBorrowCapacity}`);
  }
  
  // Create transaction with refreshes and borrow
  const transaction = new Transaction();
  
  // Refresh reserve first
  transaction.add(
    await program.instruction.refreshReserve({
      accounts: {
        reserve: reserve,
        pythPrice: reserveData.liquidity.pythPriceKey,
        clock: SYSVAR_CLOCK_PUBKEY,
      },
    })
  );
  
  // Refresh obligation
  transaction.add(
    await program.instruction.refreshObligation({
      accounts: {
        obligation: obligation,
        clock: SYSVAR_CLOCK_PUBKEY,
      },
      remainingAccounts: [
        { pubkey: reserve, isWritable: false, isSigner: false },
      ],
    })
  );
  
  // Borrow liquidity
  transaction.add(
    await program.instruction.borrowObligationLiquidity(
      lendingMarketBump,
      borrowAmount,
      {
        accounts: {
          borrower: borrower.publicKey,
          obligation: obligation,
          reserve: reserve,
          lendingMarketPda: lendingMarketPda,
          sourceLiquidityWallet: reserveData.liquidity.supply,
          destinationLiquidityWallet: destinationLiquidity.address,
          feeReceiver: reserveData.liquidity.feeReceiver,
          tokenProgram: TOKEN_PROGRAM_ID,
          clock: SYSVAR_CLOCK_PUBKEY,
        },
        signers: [borrower],
      }
    )
  );
  
  const signature = await program.provider.send(transaction, [borrower]);
  console.log(`Borrowed ${borrowAmount} tokens: ${signature}`);
  
  // Calculate new health factor
  const newHealthFactor = await getObligationHealthFactor(program, obligation);
  console.log(`New health factor: ${newHealthFactor.toFixed(2)}`);
  
  return signature;
}

async function calculateMaxBorrowCapacity(
  program: Program<BorrowLending>,
  obligation: PublicKey
): Promise<number> {
  const obligationData = await program.account.obligation.fetch(obligation);
  
  const totalCollateralValue = obligationData.depositedValue.toNumber();
  const totalBorrowedValue = obligationData.borrowedValue.toNumber();
  const allowedBorrowValue = obligationData.allowedBorrowValue.toNumber();
  
  return Math.max(0, allowedBorrowValue - totalBorrowedValue);
}

// Example: Borrow USDC against collateral
const usdcReserve = new PublicKey("8GWTTbNiXdmyZREXbjsZBmCRuzdPrW55dnZGDkTRjWvb");
await borrowLiquidity(
  program,
  borrowerKeypair,
  obligationAddress,
  usdcReserve,
  500 * 1e6 // Borrow 500 USDC
);
```

**CLI Example:**
```bash
# Borrow liquidity against collateral
solana-borrow-lending borrow \
  --obligation 5ZWj7a1TsYKqN1jjsxiH5xRoUakQBBT4F1SkUh9bUW7n \
  --reserve 8GWTTbNiXdmyZREXbjsZBmCRuzdPrW55dnZGDkTRjWvb \
  --amount 500 \
  --borrower ./borrower-keypair.json \
  --rpc-url https://api.mainnet-beta.solana.com
```

**Safe Borrowing Strategy:**
```typescript
async function safeBorrow(
  program: Program<BorrowLending>,
  borrower: Keypair,
  obligation: PublicKey,
  reserve: PublicKey,
  targetAmount: number,
  minHealthFactor: number = 1.5
) {
  // Check current health factor
  const currentHealthFactor = await getObligationHealthFactor(program, obligation);
  console.log(`Current health factor: ${currentHealthFactor.toFixed(2)}`);
  
  // Calculate maximum safe borrow amount
  const obligationData = await program.account.obligation.fetch(obligation);
  const totalCollateralValue = obligationData.depositedValue.toNumber();
  const currentBorrowedValue = obligationData.borrowedValue.toNumber();
  
  const maxSafeBorrowValue = (totalCollateralValue / minHealthFactor) - currentBorrowedValue;
  const safeAmount = Math.min(targetAmount, maxSafeBorrowValue);
  
  console.log(`Safe borrow amount: ${safeAmount} (requested: ${targetAmount})`);
  
  if (safeAmount <= 0) {
    throw new Error("No safe borrowing capacity available");
  }
  
  return await borrowLiquidity(program, borrower, obligation, reserve, safeAmount);
}

// Example: Safely borrow with 1.5x health factor buffer
await safeBorrow(
  program,
  borrowerKeypair,
  obligationAddress,
  usdcReserve,
  1000 * 1e6, // Target 1000 USDC
  1.5         // Minimum 1.5x health factor
);
```

**Leveraged Position Example:**
```typescript
async function createLevergedPosition(
  program: Program<BorrowLending>,
  user: Keypair,
  obligation: PublicKey,
  collateralReserve: PublicKey,
  borrowReserve: PublicKey,
  initialCollateral: number,
  leverage: number = 2.0
) {
  // Step 1: Deposit initial collateral
  await depositCollateral(program, user, obligation, collateralReserve, initialCollateral);
  
  // Step 2: Calculate borrow amount for desired leverage
  const totalPosition = initialCollateral * leverage;
  const borrowAmount = totalPosition - initialCollateral;
  
  // Step 3: Borrow additional funds
  await borrowLiquidity(program, user, obligation, borrowReserve, borrowAmount);
  
  // Step 4: Convert borrowed funds to more collateral (via AMM)
  // This would require additional AMM integration
  
  console.log(`Created ${leverage}x leveraged position`);
  console.log(`Initial collateral: ${initialCollateral}`);
  console.log(`Borrowed amount: ${borrowAmount}`);
  console.log(`Total position: ${totalPosition}`);
}
```

**Interest Cost Calculation:**
```typescript
async function calculateBorrowingCost(
  program: Program<BorrowLending>,
  reserve: PublicKey,
  borrowAmount: number,
  durationDays: number
): Promise<{
  borrowFee: number;
  interestCost: number;
  totalCost: number;
  effectiveApr: number;
}> {
  const reserveData = await program.account.reserve.fetch(reserve);
  
  // Calculate upfront borrowing fee
  const borrowFeeRate = reserveData.config.borrowFeeWad / 1e18;
  const borrowFee = borrowAmount * borrowFeeRate;
  
  // Calculate interest cost over duration
  const currentBorrowRate = reserveData.currentBorrowRate;
  const dailyRate = currentBorrowRate / 365;
  const interestCost = borrowAmount * dailyRate * durationDays;
  
  const totalCost = borrowFee + interestCost;
  const effectiveApr = (totalCost / borrowAmount) * (365 / durationDays);
  
  return {
    borrowFee,
    interestCost,
    totalCost,
    effectiveApr,
  };
}

// Example: Calculate cost of borrowing 1000 USDC for 30 days
const borrowingCost = await calculateBorrowingCost(
  program,
  usdcReserve,
  1000 * 1e6,
  30
);
console.log(`Total cost: $${borrowingCost.totalCost / 1e6}`);
console.log(`Effective APR: ${borrowingCost.effectiveApr * 100}%`);
```

**Integration Considerations:**
- Always refresh both obligation and reserves before borrowing
- Implement health factor monitoring and warnings
- Provide clear borrowing cost calculations to users
- Handle insufficient liquidity scenarios gracefully
- Consider implementing automatic repayment reminders
- Monitor reserve utilization for rate predictions

**Related Instructions:**
- [`repay_obligation_liquidity`](#repay_obligation_liquidity) - Repay borrowed amounts
- [`deposit_obligation_collateral`](#deposit_obligation_collateral) - Add more collateral
- [`liquidate_obligation`](#liquidate_obligation) - Liquidate unhealthy positions

---

#### `repay_obligation_liquidity`

**Function Signature:**
```rust
pub fn repay_obligation_liquidity(
    ctx: Context<RepayObligationLiquidity>,
    liquidity_amount: u64,
    loan_kind: LoanKind,
) -> Result<()>
```

**Description:**
Repays borrowed liquidity to reduce or eliminate debt in an obligation. This operation allows users to reduce their debt burden, improve their health factor, and potentially unlock collateral for withdrawal.

The repayment can be made by the borrower or any third party, enabling features like:
- Self-repayment by borrowers
- Liquidation repayments by liquidators
- Assistance repayments by friends or protocols
- Automated repayments by bots

Repayments reduce the borrowed amount and accrued interest, improving the obligation's health factor and potentially preventing liquidation.

**Parameters:**

- `liquidity_amount: u64` - Amount of liquidity to repay
  - Must be > 0
  - Denominated in the reserve's underlying token units
  - Can be partial or full repayment of the debt
  - Excess amounts are ignored (only debt amount is repaid)

- `loan_kind: LoanKind` - Type of loan being repaid
  - `Standard` - Regular borrowing loans
  - `YieldFarming` - Leveraged yield farming positions
  - Must match the loan type in the obligation
  - Different loan types may have different repayment logic

**Accounts:**

1. `repayer: Signer<'info>` - Account providing the repayment funds
   - Does not need to be the obligation owner
   - Must be able to transfer from source_liquidity_wallet
   - Enables third-party repayments and liquidations

2. `obligation: AccountLoader<'info, Obligation>` - The obligation with debt
   - Must be properly initialized and not stale
   - Must have outstanding debt in the specified reserve
   - Debt will be reduced by the repayment amount

3. `reserve: Box<Account<'info, Reserve>>` - The reserve being repaid
   - Must be properly initialized and not stale
   - Must match the debt currency in the obligation
   - Available liquidity will increase after repayment

4. `source_liquidity_wallet: AccountInfo<'info>` - Repayer's token account
   - Must contain sufficient tokens for repayment
   - Must be owned by the repayer
   - Must not be the reserve's liquidity supply account

5. `destination_liquidity_wallet: AccountInfo<'info>` - Reserve's liquidity supply
   - Will receive the repaid tokens
   - Must match the reserve's configured supply account
   - Increases the reserve's available liquidity

6. `token_program: Program<'info, Token>` - SPL Token program
7. `clock: Sysvar<'info, Clock>` - Clock sysvar for timestamps

**Account Constraints:**
- Source wallet must not be the reserve's liquidity supply
- Destination wallet must be the reserve's liquidity supply
- Reserve must not be stale (recently refreshed)
- All token accounts must match expected mints

**State Changes:**
- Liquidity is transferred from repayer to reserve
- Obligation's borrowed amount decreases
- Accrued interest is included in repayment calculation
- Reserve's available liquidity increases
- Reserve's total borrows decrease
- Obligation's health factor improves
- Last update timestamps are refreshed

**Repayment Calculation:**
The repayment amount includes both principal and accrued interest:
```
Total Debt = Principal + Accrued Interest
Accrued Interest = Principal × Borrow Rate × Time Since Last Update
Repayment Amount = min(Liquidity Amount, Total Debt)
```

If the repayment amount exceeds the total debt, only the debt amount is transferred.

**Health Factor Improvement:**
Repayments improve the obligation's health factor:
```
New Health Factor = Total Collateral Value / (Current Debt - Repayment Amount)
```

A health factor above 1.0 indicates a healthy position, while below 1.0 indicates liquidation risk.

**Loan Types:**

1. **Standard Loans** - Regular borrowing positions
   - Straightforward principal + interest repayment
   - No additional complications or considerations
   - Most common loan type

2. **Yield Farming Loans** - Leveraged yield farming positions
   - May have additional complexity with staked liquidity
   - Might require coordination with AMM position closure
   - Could involve multiple reserves and tokens

**Error Conditions:**
- `InvalidAmount` - If liquidity_amount is zero
- `InsufficientLiquidity` - If repayer lacks sufficient tokens
- `NoDebtToRepay` - If obligation has no debt in the reserve
- `ReserveStale` - If reserve needs refreshing
- `ObligationStale` - If obligation needs refreshing
- `InvalidLoanKind` - If loan kind doesn't match obligation debt

**Security Considerations:**
- Verify token account ownership and balances
- Always refresh obligation and reserve before repayment
- Handle partial repayments correctly
- Validate loan kind matches obligation state

**TypeScript Example:**
```typescript
async function repayDebt(
  program: Program<BorrowLending>,
  repayer: Keypair,
  obligation: PublicKey,
  reserve: PublicKey,
  repayAmount: number,
  loanKind: LoanKind = { standard: {} }
) {
  // Get obligation and reserve data
  const obligationData = await program.account.obligation.fetch(obligation);
  const reserveData = await program.account.reserve.fetch(reserve);
  
  // Get repayer's token account
  const liquidityMint = reserveData.liquidity.mint;
  const liquidityToken = new Token(
    program.provider.connection, 
    liquidityMint, 
    TOKEN_PROGRAM_ID, 
    repayer
  );
  const sourceLiquidity = await liquidityToken.getOrCreateAssociatedAccountInfo(
    repayer.publicKey
  );
  
  // Check current debt amount
  const currentDebt = await getCurrentDebtAmount(program, obligation, reserve);
  console.log(`Current debt: ${currentDebt}`);
  console.log(`Repaying: ${repayAmount}`);
  
  const actualRepayment = Math.min(repayAmount, currentDebt);
  console.log(`Actual repayment: ${actualRepayment}`);
  
  // Create transaction with refreshes and repayment
  const transaction = new Transaction();
  
  // Refresh reserve first
  transaction.add(
    await program.instruction.refreshReserve({
      accounts: {
        reserve: reserve,
        pythPrice: reserveData.liquidity.pythPriceKey,
        clock: SYSVAR_CLOCK_PUBKEY,
      },
    })
  );
  
  // Refresh obligation
  transaction.add(
    await program.instruction.refreshObligation({
      accounts: {
        obligation: obligation,
        clock: SYSVAR_CLOCK_PUBKEY,
      },
      remainingAccounts: [
        { pubkey: reserve, isWritable: false, isSigner: false },
      ],
    })
  );
  
  // Repay liquidity
  transaction.add(
    await program.instruction.repayObligationLiquidity(
      repayAmount,
      loanKind,
      {
        accounts: {
          repayer: repayer.publicKey,
          obligation: obligation,
          reserve: reserve,
          sourceLiquidityWallet: sourceLiquidity.address,
          destinationLiquidityWallet: reserveData.liquidity.supply,
          tokenProgram: TOKEN_PROGRAM_ID,
          clock: SYSVAR_CLOCK_PUBKEY,
        },
        signers: [repayer],
      }
    )
  );
  
  const signature = await program.provider.send(transaction, [repayer]);
  console.log(`Debt repaid: ${signature}`);
  
  // Calculate new health factor
  const newHealthFactor = await getObligationHealthFactor(program, obligation);
  console.log(`New health factor: ${newHealthFactor.toFixed(2)}`);
  
  return signature;
}

async function getCurrentDebtAmount(
  program: Program<BorrowLending>,
  obligation: PublicKey,
  reserve: PublicKey
): Promise<number> {
  const obligationData = await program.account.obligation.fetch(obligation);
  
  // Find the borrow for this reserve
  const borrow = obligationData.borrows.find(
    b => b.borrowReserve.equals(reserve)
  );
  
  if (!borrow) {
    return 0;
  }
  
  // Calculate current debt including accrued interest
  const principal = borrow.borrowedAmountWads.toNumber();
  const cumulativeBorrowRateWads = borrow.cumulativeBorrowRateWads.toNumber();
  const marketCumulativeRate = borrow.marketValue.toNumber(); // Current market rate
  
  const currentDebt = principal * (marketCumulativeRate / cumulativeBorrowRateWads);
  return currentDebt;
}

// Example: Repay USDC debt
const usdcReserve = new PublicKey("8GWTTbNiXdmyZREXbjsZBmCRuzdPrW55dnZGDkTRjWvb");
await repayDebt(
  program,
  repayerKeypair,
  obligationAddress,
  usdcReserve,
  250 * 1e6, // Repay 250 USDC
  { standard: {} }
);
```

**CLI Example:**
```bash
# Repay debt
solana-borrow-lending repay \
  --obligation 5ZWj7a1TsYKqN1jjsxiH5xRoUakQBBT4F1SkUh9bUW7n \
  --reserve 8GWTTbNiXdmyZREXbjsZBmCRuzdPrW55dnZGDkTRjWvb \
  --amount 250 \
  --repayer ./repayer-keypair.json \
  --loan-kind standard \
  --rpc-url https://api.mainnet-beta.solana.com

# Repay all debt for a reserve
solana-borrow-lending repay-all \
  --obligation 5ZWj7a1TsYKqN1jjsxiH5xRoUakQBBT4F1SkUh9bUW7n \
  --reserve 8GWTTbNiXdmyZREXbjsZBmCRuzdPrW55dnZGDkTRjWvb \
  --repayer ./repayer-keypair.json \
  --loan-kind standard
```

**Full Repayment Strategy:**
```typescript
async function repayAllDebt(
  program: Program<BorrowLending>,
  repayer: Keypair,
  obligation: PublicKey
) {
  const obligationData = await program.account.obligation.fetch(obligation);
  const signatures = [];
  
  // Repay all borrows
  for (const borrow of obligationData.borrows) {
    if (borrow.borrowedAmountWads.toNumber() > 0) {
      try {
        const currentDebt = await getCurrentDebtAmount(
          program, 
          obligation, 
          borrow.borrowReserve
        );
        
        if (currentDebt > 0) {
          const signature = await repayDebt(
            program,
            repayer,
            obligation,
            borrow.borrowReserve,
            currentDebt * 1.01, // Add 1% buffer for interest accrual
            { standard: {} }
          );
          signatures.push(signature);
        }
      } catch (error) {
        console.error(`Failed to repay ${borrow.borrowReserve}:`, error);
      }
    }
  }
  
  return signatures;
}
```

**Liquidation Repayment Example:**
```typescript
async function liquidationRepayment(
  program: Program<BorrowLending>,
  liquidator: Keypair,
  unhealthyObligation: PublicKey,
  reserve: PublicKey,
  maxRepayment: number
) {
  // Check if obligation is actually unhealthy
  const healthFactor = await getObligationHealthFactor(program, unhealthyObligation);
  if (healthFactor >= 1.0) {
    throw new Error("Obligation is not unhealthy, cannot liquidate");
  }
  
  // Calculate maximum liquidatable amount (typically 50% of debt)
  const currentDebt = await getCurrentDebtAmount(program, unhealthyObligation, reserve);
  const maxLiquidatable = currentDebt * 0.5; // 50% max liquidation
  
  const liquidationAmount = Math.min(maxRepayment, maxLiquidatable);
  
  console.log(`Liquidating ${liquidationAmount} of ${currentDebt} total debt`);
  
  // Use liquidate_obligation instruction instead of repay for liquidations
  return await liquidateObligation(
    program,
    liquidator,
    unhealthyObligation,
    reserve,
    liquidationAmount
  );
}
```

**Automated Repayment Bot:**
```typescript
class RepaymentBot {
  constructor(
    private program: Program<BorrowLending>,
    private bot: Keypair,
    private minHealthFactor: number = 1.2
  ) {}
  
  async monitorAndRepay(obligations: PublicKey[]) {
    for (const obligation of obligations) {
      try {
        const healthFactor = await getObligationHealthFactor(this.program, obligation);
        
        if (healthFactor < this.minHealthFactor) {
          console.log(`⚠️  Obligation ${obligation} health factor: ${healthFactor.toFixed(2)}`);
          
          // Calculate required repayment to reach target health factor
          const requiredRepayment = await this.calculateRequiredRepayment(
            obligation,
            this.minHealthFactor
          );
          
          if (requiredRepayment > 0) {
            await this.performEmergencyRepayment(obligation, requiredRepayment);
          }
        }
      } catch (error) {
        console.error(`Error monitoring obligation ${obligation}:`, error);
      }
    }
  }
  
  private async calculateRequiredRepayment(
    obligation: PublicKey,
    targetHealthFactor: number
  ): Promise<number> {
    const obligationData = await this.program.account.obligation.fetch(obligation);
    const collateralValue = obligationData.depositedValue.toNumber();
    const currentDebt = obligationData.borrowedValue.toNumber();
    
    const targetDebt = collateralValue / targetHealthFactor;
    const requiredRepayment = Math.max(0, currentDebt - targetDebt);
    
    return requiredRepayment;
  }
  
  private async performEmergencyRepayment(
    obligation: PublicKey,
    amount: number
  ) {
    // Implementation would repay using bot's funds
    // and potentially trigger user notifications
    console.log(`🤖 Bot repaying ${amount} to save obligation ${obligation}`);
  }
}

// Usage
const bot = new RepaymentBot(program, botKeypair, 1.3);
setInterval(() => {
  bot.monitorAndRepay(userObligations);
}, 60000); // Check every minute
```

**Interest Savings Calculation:**
```typescript
async function calculateInterestSavings(
  program: Program<BorrowLending>,
  obligation: PublicKey,
  reserve: PublicKey,
  repaymentAmount: number
): Promise<{
  dailySavings: number;
  monthlySavings: number;
  annualSavings: number;
}> {
  const reserveData = await program.account.reserve.fetch(reserve);
  const currentBorrowRate = reserveData.currentBorrowRate;
  
  const dailyRate = currentBorrowRate / 365;
  const dailySavings = repaymentAmount * dailyRate;
  
  return {
    dailySavings,
    monthlySavings: dailySavings * 30,
    annualSavings: dailySavings * 365,
  };
}

// Example: Calculate savings from repaying 1000 USDC
const savings = await calculateInterestSavings(
  program,
  obligationAddress,
  usdcReserve,
  1000 * 1e6
);
console.log(`Annual interest savings: $${savings.annualSavings / 1e6}`);
```

**Integration Considerations:**
- Always refresh both obligation and reserves before repayment
- Handle partial repayments and overpayments gracefully
- Provide clear debt and interest calculations to users
- Implement health factor monitoring and alerts
- Consider automated repayment features for user protection
- Support third-party repayments for liquidation prevention

**Related Instructions:**
- [`borrow_obligation_liquidity`](#borrow_obligation_liquidity) - Create debt positions
- [`liquidate_obligation`](#liquidate_obligation) - Liquidate unhealthy positions
- [`withdraw_obligation_collateral`](#withdraw_obligation_collateral) - Withdraw collateral after repayment

---

### Liquidation

Liquidation instructions handle the forced closure of unhealthy borrowing positions to maintain protocol solvency. When borrowers' collateral value falls below the liquidation threshold, liquidators can repay their debt in exchange for discounted collateral.

#### `liquidate_obligation`

**Function Signature:**
```rust
pub fn liquidate_obligation(
    ctx: Context<LiquidateObligation>,
    liquidity_amount: u64,
) -> Result<()>
```

**Description:**
Liquidates an unhealthy obligation by repaying debt and seizing collateral at a discount. This critical mechanism ensures protocol solvency by incentivizing third parties to close risky positions before they become insolvent.

Liquidation occurs when an obligation's health factor falls below 1.0, meaning the borrowed value exceeds the liquidation threshold of the collateral value. Liquidators provide liquidity to repay debt and receive collateral at a discount (liquidation bonus).

The liquidation process:
1. Verifies the obligation is unhealthy (health factor < 1.0)
2. Repays up to 50% of the largest debt position
3. Seizes proportional collateral plus liquidation bonus
4. Improves the obligation's health factor
5. Distributes liquidation bonus to the liquidator

**Parameters:**

- `liquidity_amount: u64` - Amount of debt to repay during liquidation
  - Must be > 0
  - Limited to maximum liquidation percentage (typically 50%)
  - Denominated in the debt reserve's underlying token units
  - Liquidator must provide this amount

**Accounts:**

1. `liquidator: Signer<'info>` - Account performing the liquidation
   - Must provide liquidity to repay debt
   - Receives discounted collateral as reward
   - Incentivized by liquidation bonus

2. `obligation: AccountLoader<'info, Obligation>` - The unhealthy obligation
   - Must have health factor < 1.0
   - Must have sufficient debt to liquidate
   - Will have debt reduced and collateral seized

3. `repay_reserve: Box<Account<'info, Reserve>>` - Reserve for debt being repaid
   - Usually the largest debt position
   - Must be properly initialized and not stale
   - Receives the repayment liquidity

4. `withdraw_reserve: Box<Account<'info, Reserve>>` - Reserve for collateral being seized
   - Usually the largest collateral position
   - Must be properly initialized and not stale
   - Source of liquidation collateral

5. `source_liquidity: AccountInfo<'info>` - Liquidator's token account for repayment
   - Must contain sufficient tokens for repayment
   - Must be owned by the liquidator
   - Used to provide debt repayment

6. `destination_collateral: AccountInfo<'info>` - Liquidator's account for seized collateral
   - Will receive the liquidated collateral
   - Must be for the withdraw reserve's collateral mint
   - Liquidator's reward account

7. `repay_reserve_liquidity_supply: AccountInfo<'info>` - Repay reserve's liquidity account
   - Receives the debt repayment
   - Must match repay reserve's supply account
   - Increases reserve liquidity

8. `withdraw_reserve_collateral_supply: AccountInfo<'info>` - Withdraw reserve's collateral account
   - Source of seized collateral
   - Must match withdraw reserve's collateral supply
   - Decreases after liquidation

9. `lending_market: Box<Account<'info, LendingMarket>>` - Parent lending market
   - Must match obligation's lending market
   - Provides market-wide configuration
   - Authority for liquidation operations

10. `lending_market_authority: AccountInfo<'info>` - PDA for market authority
    - Derived from lending market address
    - Signs token transfers during liquidation
    - Controls reserve accounts

11. `clock: Sysvar<'info, Clock>` - Clock sysvar for timestamps
12. `token_program: Program<'info, Token>` - SPL Token program

**Account Constraints:**
- Obligation must be unhealthy (health factor < 1.0)
- Liquidator must have sufficient liquidity for repayment
- Both reserves must belong to the same lending market
- All accounts must be properly initialized and not stale

**State Changes:**
- Debt is repaid in the obligation
- Collateral is transferred from obligation to liquidator
- Repay reserve receives liquidity
- Withdraw reserve loses collateral
- Obligation's health factor improves
- Last update timestamps are refreshed

**Liquidation Calculation:**
The liquidation amount and bonus are calculated based on protocol parameters:

```rust
// Maximum liquidation percentage (typically 50%)
max_liquidation_amount = debt_amount * max_liquidation_percentage

// Actual liquidation amount
liquidation_amount = min(liquidity_amount, max_liquidation_amount)

// Collateral value to seize (including bonus)
collateral_value = liquidation_amount * (1 + liquidation_bonus)

// Collateral tokens to transfer
collateral_amount = collateral_value / collateral_exchange_rate / collateral_price
```

**Health Factor Requirements:**
Liquidation is only allowed when:
```rust
health_factor = total_collateral_value / total_debt_value < 1.0
```

After liquidation, the health factor must improve but may still be below 1.0 if the position remains overleveraged.

**Error Conditions:**
- `InvalidAmount` - If liquidity_amount is zero
- `HealthyObligation` - If obligation health factor >= 1.0
- `InsufficientLiquidity` - If liquidator lacks sufficient tokens
- `LiquidationTooLarge` - If amount exceeds maximum liquidation percentage
- `ObligationStale` - If obligation needs refreshing
- `ReserveStale` - If either reserve needs refreshing
- `MarketMismatch` - If reserves belong to different markets

**Security Considerations:**
- Verify obligation is truly unhealthy before liquidation
- Ensure liquidation amounts don't exceed limits
- Validate all price feeds are current
- Check for potential liquidation sandwiching attacks
- Monitor for fair liquidation bonus distribution

**TypeScript Example:**
```typescript
async function liquidateUnhealthyObligation(
  program: Program<BorrowLending>,
  liquidator: Keypair,
  obligation: PublicKey,
  repayReserve: PublicKey,
  withdrawReserve: PublicKey,
  liquidationAmount: number
) {
  // First verify the obligation is unhealthy
  const healthFactor = await getObligationHealthFactor(program, obligation);
  if (healthFactor >= 1.0) {
    throw new Error(`Obligation is healthy (HF: ${healthFactor.toFixed(2)}), cannot liquidate`);
  }
  
  console.log(`🚨 Liquidating unhealthy obligation (HF: ${healthFactor.toFixed(2)})`);
  
  // Get obligation and reserve data
  const obligationData = await program.account.obligation.fetch(obligation);
  const repayReserveData = await program.account.reserve.fetch(repayReserve);
  const withdrawReserveData = await program.account.reserve.fetch(withdrawReserve);
  
  // Calculate maximum liquidation amount (50% of debt)
  const totalDebt = await getCurrentDebtAmount(program, obligation, repayReserve);
  const maxLiquidation = totalDebt * 0.5;
  const actualLiquidation = Math.min(liquidationAmount, maxLiquidation);
  
  console.log(`Liquidating ${actualLiquidation} of ${totalDebt} debt (max: ${maxLiquidation})`);
  
  // Get liquidator's accounts
  const repayMint = repayReserveData.liquidity.mint;
  const withdrawCollateralMint = withdrawReserveData.collateralMint;
  
  const repayToken = new Token(program.provider.connection, repayMint, TOKEN_PROGRAM_ID, liquidator);
  const sourceLiquidity = await repayToken.getOrCreateAssociatedAccountInfo(liquidator.publicKey);
  
  const collateralToken = new Token(
    program.provider.connection, 
    withdrawCollateralMint, 
    TOKEN_PROGRAM_ID, 
    liquidator
  );
  const destinationCollateral = await collateralToken.getOrCreateAssociatedAccountInfo(
    liquidator.publicKey
  );
  
  // Derive lending market authority
  const [lendingMarketAuthority] = await PublicKey.findProgramAddress(
    [obligationData.lendingMarket.toBuffer()],
    program.programId
  );
  
  // Calculate expected collateral reward
  const liquidationBonus = withdrawReserveData.config.liquidationBonus / 100;
  const collateralValue = actualLiquidation * (1 + liquidationBonus);
  console.log(`Expected collateral value: ${collateralValue} (${liquidationBonus * 100}% bonus)`);
  
  // Create transaction with refreshes and liquidation
  const transaction = new Transaction();
  
  // Refresh both reserves
  transaction.add(
    await program.instruction.refreshReserve({
      accounts: {
        reserve: repayReserve,
        pythPrice: repayReserveData.liquidity.pythPriceKey,
        clock: SYSVAR_CLOCK_PUBKEY,
      },
    })
  );
  
  transaction.add(
    await program.instruction.refreshReserve({
      accounts: {
        reserve: withdrawReserve,
        pythPrice: withdrawReserveData.liquidity.pythPriceKey,
        clock: SYSVAR_CLOCK_PUBKEY,
      },
    })
  );
  
  // Refresh obligation
  transaction.add(
    await program.instruction.refreshObligation({
      accounts: {
        obligation: obligation,
        clock: SYSVAR_CLOCK_PUBKEY,
      },
      remainingAccounts: [
        { pubkey: repayReserve, isWritable: false, isSigner: false },
        { pubkey: withdrawReserve, isWritable: false, isSigner: false },
      ],
    })
  );
  
  // Perform liquidation
  transaction.add(
    await program.instruction.liquidateObligation(actualLiquidation, {
      accounts: {
        liquidator: liquidator.publicKey,
        obligation: obligation,
        repayReserve: repayReserve,
        withdrawReserve: withdrawReserve,
        sourceLiquidity: sourceLiquidity.address,
        destinationCollateral: destinationCollateral.address,
        repayReserveLiquiditySupply: repayReserveData.liquidity.supply,
        withdrawReserveCollateralSupply: withdrawReserveData.collateralMintTotalSupply,
        lendingMarket: obligationData.lendingMarket,
        lendingMarketAuthority: lendingMarketAuthority,
        clock: SYSVAR_CLOCK_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      signers: [liquidator],
    })
  );
  
  const signature = await program.provider.send(transaction, [liquidator]);
  console.log(`✅ Liquidation completed: ${signature}`);
  
  // Check new health factor
  const newHealthFactor = await getObligationHealthFactor(program, obligation);
  console.log(`New health factor: ${newHealthFactor.toFixed(2)}`);
  
  return signature;
}

// Example: Liquidate unhealthy USDC/SOL position
const usdcReserve = new PublicKey("8GWTTbNiXdmyZREXbjsZBmCRuzdPrW55dnZGDkTRjWvb");
const solReserve = new PublicKey("5ZWj7a1TsYKqN1jjsxiH5xRoUakQBBT4F1SkUh9bUW7n");

await liquidateUnhealthyObligation(
  program,
  liquidatorKeypair,
  unhealthyObligationAddress,
  usdcReserve,    // Repay USDC debt
  solReserve,     // Seize SOL collateral
  500 * 1e6       // Liquidate 500 USDC worth
);
```

**CLI Example:**
```bash
# Liquidate an unhealthy obligation
solana-borrow-lending liquidate \
  --obligation 5ZWj7a1TsYKqN1jjsxiH5xRoUakQBBT4F1SkUh9bUW7n \
  --repay-reserve 8GWTTbNiXdmyZREXbjsZBmCRuzdPrW55dnZGDkTRjWvb \
  --withdraw-reserve 5ZWj7a1TsYKqN1jjsxiH5xRoUakQBBT4F1SkUh9bUW7n \
  --amount 500 \
  --liquidator ./liquidator-keypair.json \
  --rpc-url https://api.mainnet-beta.solana.com
```

**Liquidation Bot Implementation:**
```typescript
class LiquidationBot {
  constructor(
    private program: Program<BorrowLending>,
    private liquidator: Keypair,
    private minProfitThreshold: number = 50 // Minimum profit in USD
  ) {}
  
  async scanForLiquidations(obligations: PublicKey[]): Promise<void> {
    console.log(`🔍 Scanning ${obligations.length} obligations for liquidation opportunities...`);
    
    for (const obligation of obligations) {
      try {
        const liquidationOpportunity = await this.analyzeLiquidationOpportunity(obligation);
        
        if (liquidationOpportunity.profitable) {
          console.log(`💰 Profitable liquidation found: ${obligation}`);
          console.log(`  Expected profit: $${liquidationOpportunity.profit.toFixed(2)}`);
          
          await this.executeLiquidation(liquidationOpportunity);
        }
      } catch (error) {
        console.error(`Error analyzing obligation ${obligation}:`, error);
      }
    }
  }
  
  private async analyzeLiquidationOpportunity(obligation: PublicKey) {
    const healthFactor = await getObligationHealthFactor(this.program, obligation);
    
    if (healthFactor >= 1.0) {
      return { profitable: false, profit: 0 };
    }
    
    const obligationData = await this.program.account.obligation.fetch(obligation);
    
    // Find largest debt and collateral positions
    const largestDebt = this.findLargestPosition(obligationData.borrows);
    const largestCollateral = this.findLargestPosition(obligationData.deposits);
    
    if (!largestDebt || !largestCollateral) {
      return { profitable: false, profit: 0 };
    }
    
    // Calculate potential profit
    const maxLiquidationValue = largestDebt.value * 0.5; // 50% max
    const liquidationBonus = await this.getLiquidationBonus(largestCollateral.reserve);
    const expectedProfit = maxLiquidationValue * liquidationBonus;
    
    const profitable = expectedProfit >= this.minProfitThreshold;
    
    return {
      profitable,
      profit: expectedProfit,
      obligation,
      repayReserve: largestDebt.reserve,
      withdrawReserve: largestCollateral.reserve,
      amount: maxLiquidationValue,
      healthFactor,
    };
  }
  
  private async executeLiquidation(opportunity: any) {
    try {
      await liquidateUnhealthyObligation(
        this.program,
        this.liquidator,
        opportunity.obligation,
        opportunity.repayReserve,
        opportunity.withdrawReserve,
        opportunity.amount
      );
      
      console.log(`✅ Successfully liquidated ${opportunity.obligation}`);
    } catch (error) {
      console.error(`❌ Failed to liquidate ${opportunity.obligation}:`, error);
    }
  }
  
  private findLargestPosition(positions: any[]): any {
    return positions.reduce((largest, current) => {
      return current.value > (largest?.value || 0) ? current : largest;
    }, null);
  }
  
  private async getLiquidationBonus(reserve: PublicKey): Promise<number> {
    const reserveData = await this.program.account.reserve.fetch(reserve);
    return reserveData.config.liquidationBonus / 100;
  }
}

// Usage
const liquidationBot = new LiquidationBot(program, liquidatorKeypair, 25);

// Run liquidation scanning every 30 seconds
setInterval(async () => {
  await liquidationBot.scanForLiquidations(monitoredObligations);
}, 30000);
```

**Liquidation Profitability Calculator:**
```typescript
async function calculateLiquidationProfitability(
  program: Program<BorrowLending>,
  obligation: PublicKey,
  repayReserve: PublicKey,
  withdrawReserve: PublicKey,
  liquidationAmount: number
): Promise<{
  profitable: boolean;
  profit: number;
  costs: number;
  netProfit: number;
  roi: number;
}> {
  // Get reserve data for calculations
  const withdrawReserveData = await program.account.reserve.fetch(withdrawReserve);
  const liquidationBonus = withdrawReserveData.config.liquidationBonus / 100;
  
  // Calculate gross profit from liquidation bonus
  const grossProfit = liquidationAmount * liquidationBonus;
  
  // Estimate transaction costs (gas fees, etc.)
  const estimatedGasCost = 0.01; // SOL
  const solPrice = 100; // USD (would fetch from oracle)
  const transactionCosts = estimatedGasCost * solPrice;
  
  // Calculate net profit
  const netProfit = grossProfit - transactionCosts;
  const roi = (netProfit / liquidationAmount) * 100;
  
  return {
    profitable: netProfit > 0,
    profit: grossProfit,
    costs: transactionCosts,
    netProfit,
    roi,
  };
}
```

**Advanced Liquidation Strategies:**
```typescript
// 1. Partial Liquidation Strategy
async function partialLiquidationStrategy(
  program: Program<BorrowLending>,
  liquidator: Keypair,
  obligation: PublicKey
) {
  const healthFactor = await getObligationHealthFactor(program, obligation);
  
  // Only liquidate enough to bring health factor to 1.1
  const obligationData = await program.account.obligation.fetch(obligation);
  const collateralValue = obligationData.depositedValue.toNumber();
  const currentDebt = obligationData.borrowedValue.toNumber();
  
  const targetDebt = collateralValue / 1.1; // Target 1.1 health factor
  const liquidationAmount = Math.min(
    currentDebt - targetDebt,
    currentDebt * 0.5 // Maximum 50% liquidation
  );
  
  if (liquidationAmount > 0) {
    // Execute partial liquidation
    console.log(`Partial liquidation: ${liquidationAmount} to reach 1.1 HF`);
  }
}

// 2. Multi-Reserve Liquidation
async function multiReserveLiquidation(
  program: Program<BorrowLending>,
  liquidator: Keypair,
  obligation: PublicKey
) {
  const obligationData = await program.account.obligation.fetch(obligation);
  
  // Liquidate across multiple reserves for optimal profit
  for (const borrow of obligationData.borrows) {
    for (const deposit of obligationData.deposits) {
      const profitability = await calculateLiquidationProfitability(
        program,
        obligation,
        borrow.borrowReserve,
        deposit.depositReserve,
        borrow.borrowedAmountWads.toNumber() * 0.5
      );
      
      if (profitability.profitable && profitability.roi > 5) {
        // Execute this liquidation combination
        console.log(`Profitable combination found: ROI ${profitability.roi}%`);
      }
    }
  }
}
```

**Integration Considerations:**
- Always verify obligation health factor before liquidation attempts
- Monitor gas costs to ensure liquidations remain profitable
- Implement slippage protection for collateral seizure
- Consider MEV protection and transaction ordering
- Coordinate with price oracle updates for accuracy
- Implement proper error handling for failed liquidations
- Monitor liquidation activities for protocol health

**Related Instructions:**
- [`refresh_obligation`](#refresh_obligation) - Update obligation health before liquidation
- [`repay_obligation_liquidity`](#repay_obligation_liquidity) - Alternative repayment method
- [`borrow_obligation_liquidity`](#borrow_obligation_liquidity) - Original borrowing instruction

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