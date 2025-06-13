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

---

### Flash Loans

Flash loans provide uncollateralized loans that must be repaid within the same transaction. These powerful financial primitives enable advanced DeFi strategies like arbitrage, collateral swapping, and debt refinancing without requiring upfront capital.

#### `flash_loan`

**Function Signature:**
```rust
pub fn flash_loan(
    ctx: Context<FlashLoan>,
    lending_market_bump_seed: u8,
    amount: u64,
) -> Result<()>
```

**Description:**
Executes a flash loan by temporarily lending liquidity that must be repaid with fees in the same transaction. Flash loans enable atomically composable transactions where users can:

- Borrow large amounts without collateral
- Execute complex financial operations
- Repay the loan plus fees before transaction completion
- Access instant liquidity for arbitrage and refinancing

The flash loan process:
1. Validates flash loans are enabled for the market
2. Transfers requested liquidity to user's account
3. Calls user-specified program with custom data and accounts
4. Verifies the loan plus fees were repaid
5. Reverts entire transaction if repayment fails

This mechanism ensures atomicity - either the entire transaction succeeds (including repayment) or fails completely, eliminating credit risk for the protocol.

**Parameters:**

- `lending_market_bump_seed: u8` - Bump seed for lending market PDA
  - Used to derive the lending market authority
  - Required for signing token transfers
  - Must match the canonical bump for the market

- `amount: u64` - Amount of liquidity to flash loan
  - Must be > 0
  - Denominated in the reserve's underlying token units
  - Limited by reserve's available liquidity
  - Must be repaid with fees in the same transaction

**Accounts:**

1. `lending_market: Box<Account<'info, LendingMarket>>` - The lending market
   - Must have flash loans enabled
   - Provides market-wide configuration
   - Controls flash loan availability

2. `lending_market_pda: AccountInfo<'info>` - PDA for market authority
   - Derived from lending market with bump seed
   - Signs the initial loan transfer
   - Authority for reserve token accounts

3. `reserve: Box<Account<'info, Reserve>>` - Reserve providing the flash loan
   - Must be properly initialized and not stale
   - Must have sufficient available liquidity
   - Source of the flash loan funds

4. `source_liquidity_wallet: Box<Account<'info, TokenAccount>>` - Reserve's liquidity supply
   - Contains protocol's available liquidity
   - Must match reserve's configured supply account
   - Source of the flash loan

5. `destination_liquidity_wallet: AccountInfo<'info>` - Borrower's token account
   - Receives the flash loan liquidity
   - User-controlled account for loan utilization
   - Must be repaid before transaction end

6. `fee_receiver: AccountInfo<'info>` - Protocol's fee collection account
   - Receives flash loan fees
   - Must match reserve's configured fee receiver
   - Ensures protocol revenue from flash loans

7. `host_fee_receiver: AccountInfo<'info>` - Optional host fee receiver
   - Additional fee distribution if specified
   - Can be used for partner revenue sharing
   - Optional account in remaining accounts

8. `token_program: Program<'info, Token>` - SPL Token program
9. `clock: Sysvar<'info, Clock>` - Clock sysvar for timestamps

**Remaining Accounts:**
The flash loan instruction forwards additional accounts to the target program:
- Target program ID (account 0 in remaining accounts)
- Any additional accounts required by target program
- These accounts are passed through for custom program execution

**Account Constraints:**
- Flash loans must be enabled in the lending market
- Reserve must not be stale (recently refreshed)
- Source wallet must be the reserve's liquidity supply
- Fee receiver must match reserve configuration
- Sufficient liquidity must be available

**State Changes:**
- Liquidity is temporarily transferred to user
- Target program is invoked with custom logic
- Loan plus fees must be repaid to reserve
- Reserve liquidity returns to original state (plus fees)
- Flash loan fees are collected by protocol

**Flash Loan Fee Structure:**
Flash loans incur fees based on the borrowed amount:
```rust
flash_loan_fee = amount * flash_loan_fee_rate
total_repayment = amount + flash_loan_fee

// Optional host fee split
host_fee = flash_loan_fee * host_fee_percentage
protocol_fee = flash_loan_fee - host_fee
```

Typical flash loan fees range from 0.05% to 0.3% of the borrowed amount.

**Target Program Integration:**
The flash loan calls a user-specified program with:
- Custom instruction data (after 9-byte header)
- User-provided accounts
- Loan amount and market information

The target program must:
- Use the borrowed liquidity for intended operations
- Ensure sufficient funds for repayment
- Return control to the flash loan instruction

**Error Conditions:**
- `FlashLoansDisabled` - If flash loans are not enabled for the market
- `InsufficientLiquidity` - If reserve lacks sufficient available liquidity
- `ReserveStale` - If reserve needs refreshing
- `InvalidAmount` - If amount is zero
- `FlashLoanNotRepaid` - If repayment verification fails
- `InstructionError` - If target program execution fails

**Security Considerations:**
- Target programs must be carefully audited
- Repayment verification is critical for protocol security
- Consider reentrancy protection in target programs
- Monitor for potential MEV extraction
- Validate all account relationships

**TypeScript Example:**
```typescript
async function executeFlashLoan(
  program: Program<BorrowLending>,
  user: Keypair,
  reserve: PublicKey,
  amount: number,
  targetProgram: PublicKey,
  targetInstruction: Buffer,
  targetAccounts: AccountMeta[]
) {
  // Get reserve and market data
  const reserveData = await program.account.reserve.fetch(reserve);
  const lendingMarket = reserveData.lendingMarket;
  
  // Derive lending market PDA
  const [lendingMarketPda, bump] = await PublicKey.findProgramAddress(
    [lendingMarket.toBuffer()],
    program.programId
  );
  
  // Get user's token account for receiving flash loan
  const liquidityMint = reserveData.liquidity.mint;
  const liquidityToken = new Token(
    program.provider.connection, 
    liquidityMint, 
    TOKEN_PROGRAM_ID, 
    user
  );
  const destinationLiquidity = await liquidityToken.getOrCreateAssociatedAccountInfo(
    user.publicKey
  );
  
  // Prepare flash loan instruction data
  const flashLoanData = Buffer.concat([
    Buffer.from([bump]),                    // Bump seed (1 byte)
    Buffer.from(amount.toString(), 'hex').padStart(8, '0'), // Amount (8 bytes)
    targetInstruction,                      // Custom instruction data
  ]);
  
  // Create flash loan instruction
  const flashLoanIx = await program.instruction.flashLoan(
    bump,
    amount,
    {
      accounts: {
        lendingMarket: lendingMarket,
        lendingMarketPda: lendingMarketPda,
        reserve: reserve,
        sourceLiquidityWallet: reserveData.liquidity.supply,
        destinationLiquidityWallet: destinationLiquidity.address,
        feeReceiver: reserveData.liquidity.feeReceiver,
        tokenProgram: TOKEN_PROGRAM_ID,
        clock: SYSVAR_CLOCK_PUBKEY,
      },
      remainingAccounts: [
        // Target program
        { pubkey: targetProgram, isWritable: false, isSigner: false },
        // Target program accounts
        ...targetAccounts,
      ],
    }
  );
  
  // Create transaction
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
  
  // Add flash loan instruction
  transaction.add(flashLoanIx);
  
  console.log(`Executing flash loan: ${amount} tokens`);
  console.log(`Target program: ${targetProgram.toString()}`);
  
  const signature = await program.provider.send(transaction, [user]);
  console.log(`Flash loan executed: ${signature}`);
  
  return signature;
}

// Example: Flash loan for arbitrage
const arbitrageProgram = new PublicKey("ArbitrageProgram111111111111111111111111111");
const usdcReserve = new PublicKey("8GWTTbNiXdmyZREXbjsZBmCRuzdPrW55dnZGDkTRjWvb");

await executeFlashLoan(
  program,
  userKeypair,
  usdcReserve,
  10000 * 1e6, // Flash loan 10,000 USDC
  arbitrageProgram,
  Buffer.from("arbitrage_instruction_data"),
  [
    { pubkey: sourceExchange, isWritable: true, isSigner: false },
    { pubkey: targetExchange, isWritable: true, isSigner: false },
  ]
);
```

**CLI Example:**
```bash
# Execute flash loan with custom program
solana-borrow-lending flash-loan \
  --reserve 8GWTTbNiXdmyZREXbjsZBmCRuzdPrW55dnZGDkTRjWvb \
  --amount 10000 \
  --target-program ArbitrageProgram111111111111111111111111111 \
  --instruction-data arbitrage_params.json \
  --user ./user-keypair.json \
  --rpc-url https://api.mainnet-beta.solana.com
```

**Arbitrage Flash Loan Example:**
```typescript
// Flash loan arbitrage between two DEXs
async function executeArbitrageFlashLoan(
  program: Program<BorrowLending>,
  arbitrager: Keypair,
  reserve: PublicKey,
  flashLoanAmount: number,
  dexA: PublicKey,
  dexB: PublicKey,
  tokenA: PublicKey,
  tokenB: PublicKey
) {
  // Create arbitrage instruction
  const arbitrageInstruction = await createArbitrageInstruction({
    amount: flashLoanAmount,
    sourceDex: dexA,
    targetDex: dexB,
    tokenIn: tokenA,
    tokenOut: tokenB,
    user: arbitrager.publicKey,
  });
  
  // Execute flash loan with arbitrage logic
  return await executeFlashLoan(
    program,
    arbitrager,
    reserve,
    flashLoanAmount,
    arbitrageProgram.programId,
    arbitrageInstruction.data,
    arbitrageInstruction.keys
  );
}

async function createArbitrageInstruction(params: ArbitrageParams) {
  // Implementation would create instruction to:
  // 1. Swap tokens on DEX A
  // 2. Swap back on DEX B
  // 3. Repay flash loan with profit
  // 4. Keep remaining profit
  
  return {
    data: Buffer.from(JSON.stringify(params)),
    keys: [
      { pubkey: params.sourceDex, isWritable: true, isSigner: false },
      { pubkey: params.targetDex, isWritable: true, isSigner: false },
      { pubkey: params.tokenIn, isWritable: false, isSigner: false },
      { pubkey: params.tokenOut, isWritable: false, isSigner: false },
    ],
  };
}
```

**Collateral Swap Flash Loan Example:**
```typescript
// Use flash loan to swap collateral types
async function swapCollateralWithFlashLoan(
  program: Program<BorrowLending>,
  user: Keypair,
  obligation: PublicKey,
  oldCollateralReserve: PublicKey,
  newCollateralReserve: PublicKey,
  swapAmount: number
) {
  // Flash loan workflow:
  // 1. Flash loan new collateral token
  // 2. Deposit new collateral to obligation
  // 3. Withdraw old collateral from obligation
  // 4. Swap old collateral for new collateral (via AMM)
  // 5. Repay flash loan with swapped tokens
  
  const swapInstruction = await createCollateralSwapInstruction({
    obligation: obligation,
    oldReserve: oldCollateralReserve,
    newReserve: newCollateralReserve,
    amount: swapAmount,
    user: user.publicKey,
  });
  
  return await executeFlashLoan(
    program,
    user,
    newCollateralReserve,
    swapAmount,
    collateralSwapProgram.programId,
    swapInstruction.data,
    swapInstruction.keys
  );
}
```

**Debt Refinancing Flash Loan Example:**
```typescript
// Refinance debt from one protocol to another
async function refinanceDebtWithFlashLoan(
  program: Program<BorrowLending>,
  user: Keypair,
  currentObligation: PublicKey,
  newLendingProtocol: PublicKey,
  debtAmount: number,
  debtReserve: PublicKey
) {
  // Flash loan workflow:
  // 1. Flash loan debt amount
  // 2. Repay debt in current protocol
  // 3. Withdraw collateral from current protocol
  // 4. Deposit collateral in new protocol
  // 5. Borrow from new protocol to repay flash loan
  
  const refinanceInstruction = await createRefinanceInstruction({
    currentObligation: currentObligation,
    newProtocol: newLendingProtocol,
    debtAmount: debtAmount,
    debtReserve: debtReserve,
    user: user.publicKey,
  });
  
  return await executeFlashLoan(
    program,
    user,
    debtReserve,
    debtAmount,
    refinanceProgram.programId,
    refinanceInstruction.data,
    refinanceInstruction.keys
  );
}
```

**Flash Loan Safety Checker:**
```typescript
class FlashLoanSafetyChecker {
  constructor(private program: Program<BorrowLending>) {}
  
  async validateFlashLoanSafety(
    reserve: PublicKey,
    amount: number,
    targetProgram: PublicKey
  ): Promise<{
    safe: boolean;
    risks: string[];
    recommendations: string[];
  }> {
    const risks: string[] = [];
    const recommendations: string[] = [];
    
    // Check reserve liquidity
    const reserveData = await this.program.account.reserve.fetch(reserve);
    const availableLiquidity = reserveData.liquidity.availableAmount.toNumber();
    
    if (amount > availableLiquidity * 0.8) {
      risks.push("Flash loan amount is very large relative to available liquidity");
      recommendations.push("Consider reducing flash loan amount");
    }
    
    // Check flash loan fees
    const flashLoanFee = amount * (reserveData.config.flashLoanFeeWad / 1e18);
    
    if (flashLoanFee > amount * 0.01) {
      risks.push("Flash loan fees are higher than 1%");
      recommendations.push("Verify arbitrage opportunity covers fees");
    }
    
    // Check target program
    const programAccount = await this.program.provider.connection.getAccountInfo(targetProgram);
    
    if (!programAccount?.executable) {
      risks.push("Target program is not executable");
      recommendations.push("Verify target program address");
    }
    
    // Check market conditions
    const lendingMarket = await this.program.account.lendingMarket.fetch(
      reserveData.lendingMarket
    );
    
    if (!lendingMarket.enableFlashLoans) {
      risks.push("Flash loans are disabled for this market");
      recommendations.push("Wait for flash loans to be re-enabled");
    }
    
    const safe = risks.length === 0;
    
    return { safe, risks, recommendations };
  }
}

// Usage
const safetyChecker = new FlashLoanSafetyChecker(program);
const safety = await safetyChecker.validateFlashLoanSafety(
  usdcReserve,
  10000 * 1e6,
  arbitrageProgram
);

if (!safety.safe) {
  console.warn("Flash loan safety concerns:", safety.risks);
  console.log("Recommendations:", safety.recommendations);
}
```

**Flash Loan Profit Calculator:**
```typescript
async function calculateFlashLoanProfitability(
  program: Program<BorrowLending>,
  reserve: PublicKey,
  flashLoanAmount: number,
  expectedGrossProfit: number
): Promise<{
  profitable: boolean;
  netProfit: number;
  costs: {
    flashLoanFee: number;
    gasCosts: number;
    slippage: number;
  };
  roi: number;
}> {
  const reserveData = await program.account.reserve.fetch(reserve);
  
  // Calculate flash loan fee
  const flashLoanFeeRate = reserveData.config.flashLoanFeeWad / 1e18;
  const flashLoanFee = flashLoanAmount * flashLoanFeeRate;
  
  // Estimate gas costs
  const estimatedGasCost = 0.02; // SOL
  const solPrice = 100; // USD (would fetch from oracle)
  const gasCosts = estimatedGasCost * solPrice;
  
  // Estimate slippage (depends on trade size and liquidity)
  const slippageEstimate = expectedGrossProfit * 0.001; // 0.1% slippage
  
  const totalCosts = flashLoanFee + gasCosts + slippageEstimate;
  const netProfit = expectedGrossProfit - totalCosts;
  const roi = (netProfit / flashLoanAmount) * 100;
  
  return {
    profitable: netProfit > 0,
    netProfit,
    costs: {
      flashLoanFee,
      gasCosts,
      slippage: slippageEstimate,
    },
    roi,
  };
}

// Example: Check arbitrage profitability
const profitability = await calculateFlashLoanProfitability(
  program,
  usdcReserve,
  10000 * 1e6,  // 10k USDC flash loan
  150 * 1e6     // Expected $150 gross profit
);

console.log(`Flash loan profitable: ${profitability.profitable}`);
console.log(`Net profit: $${profitability.netProfit / 1e6}`);
console.log(`ROI: ${profitability.roi.toFixed(2)}%`);
```

**Advanced Flash Loan Patterns:**

1. **Multi-Reserve Flash Loan:**
```typescript
async function multiReserveFlashLoan(
  program: Program<BorrowLending>,
  user: Keypair,
  flashLoans: Array<{ reserve: PublicKey; amount: number }>
) {
  // Execute multiple flash loans in sequence or parallel
  // Useful for complex arbitrage across multiple assets
  
  const transaction = new Transaction();
  
  for (const loan of flashLoans) {
    const flashLoanIx = await createFlashLoanInstruction(
      program,
      user,
      loan.reserve,
      loan.amount
    );
    transaction.add(flashLoanIx);
  }
  
  return await program.provider.send(transaction, [user]);
}
```

2. **Recursive Flash Loan:**
```typescript
// Flash loan that calls another flash loan (carefully managed)
async function recursiveFlashLoan(
  program: Program<BorrowLending>,
  user: Keypair,
  primaryReserve: PublicKey,
  secondaryReserve: PublicKey,
  amounts: number[]
) {
  // Primary flash loan calls secondary flash loan
  // Useful for complex multi-step arbitrage
  // Requires careful gas and stack management
}
```

3. **Flash Loan with Options:**
```typescript
// Flash loan with contingent execution paths
async function conditionalFlashLoan(
  program: Program<BorrowLending>,
  user: Keypair,
  reserve: PublicKey,
  amount: number,
  conditions: FlashLoanConditions
) {
  // Execute different strategies based on market conditions
  // Provides flexibility for dynamic arbitrage
}
```

**Integration Considerations:**
- Always refresh reserves before flash loans for accurate liquidity data
- Implement comprehensive error handling for target program failures
- Consider gas limits and computation unit constraints
- Monitor flash loan utilization for reserve capacity planning
- Implement MEV protection strategies
- Verify target program security and correctness
- Handle edge cases like insufficient repayment funds

**Related Instructions:**
- [`toggle_flash_loans`](#toggle_flash_loans) - Enable/disable flash loans for market
- [`refresh_reserve`](#refresh_reserve) - Update reserve state before flash loans
- [`deposit_reserve_liquidity`](#deposit_reserve_liquidity) - Increase reserve liquidity for flash loans

---

#### `toggle_flash_loans`

**Function Signature:**
```rust
pub fn toggle_flash_loans(
    ctx: Context<ToggleFlashLoans>,
) -> Result<()>
```

**Description:**
Enables or disables flash loan functionality for a lending market. This administrative function provides market operators with the ability to control flash loan availability based on market conditions, security considerations, or protocol governance decisions.

Flash loans can be disabled during:
- Market stress or high volatility periods
- Security investigations or upgrades
- Regulatory compliance requirements
- Protocol governance decisions
- Emergency situations requiring additional controls

**Parameters:**
This instruction takes no additional parameters beyond the accounts context. It toggles the current state.

**Accounts:**

1. `market_owner: Signer<'info>` - Owner of the lending market
   - Must match the owner stored in the lending market
   - Required to authorize flash loan setting changes
   - Only the market owner can control flash loan availability

2. `lending_market: Account<'info, LendingMarket>` - The lending market to modify
   - Must be properly initialized
   - Flash loan setting will be toggled
   - Affects all reserves in the market

**Account Constraints:**
- Market owner must be a signer
- Market owner must match the stored owner in lending market
- Lending market must be properly initialized

**State Changes:**
- Toggles the `enable_flash_loans` boolean in the lending market
- If currently enabled, flash loans become disabled
- If currently disabled, flash loans become enabled
- Change takes effect immediately for all new flash loan attempts

**Error Conditions:**
- `IllegalOwner` - If signer is not the market owner
- `MarketNotFound` - If lending market account is invalid

**Security Considerations:**
- Flash loan state changes affect market liquidity utilization
- Consider announcing changes in advance when possible
- Monitor market impact after toggling flash loans
- Emergency disabling may be necessary for security

**TypeScript Example:**
```typescript
async function toggleFlashLoans(
  program: Program<BorrowLending>,
  marketOwner: Keypair,
  lendingMarket: PublicKey
) {
  // Check current flash loan status
  const marketData = await program.account.lendingMarket.fetch(lendingMarket);
  const currentStatus = marketData.enableFlashLoans;
  
  console.log(`Current flash loan status: ${currentStatus ? 'Enabled' : 'Disabled'}`);
  console.log(`Toggling to: ${!currentStatus ? 'Enabled' : 'Disabled'}`);
  
  const signature = await program.rpc.toggleFlashLoans({
    accounts: {
      marketOwner: marketOwner.publicKey,
      lendingMarket: lendingMarket,
    },
    signers: [marketOwner],
  });
  
  console.log(`Flash loans toggled: ${signature}`);
  
  // Verify the change
  const updatedMarketData = await program.account.lendingMarket.fetch(lendingMarket);
  console.log(`New flash loan status: ${updatedMarketData.enableFlashLoans ? 'Enabled' : 'Disabled'}`);
  
  return signature;
}

// Example: Enable flash loans for a market
await toggleFlashLoans(
  program,
  marketOwnerKeypair,
  lendingMarketAddress
);
```

**CLI Example:**
```bash
# Toggle flash loan status
solana-borrow-lending toggle-flash-loans \
  --market 5ZWj7a1TsYKqN1jjsxiH5xRoUakQBBT4F1SkUh9bUW7n \
  --owner ./owner-keypair.json \
  --rpc-url https://api.mainnet-beta.solana.com

# Check flash loan status
solana-borrow-lending market-info \
  --market 5ZWj7a1TsYKqN1jjsxiH5xRoUakQBBT4F1SkUh9bUW7n
```

**Flash Loan Management Strategy:**
```typescript
class FlashLoanManager {
  constructor(
    private program: Program<BorrowLending>,
    private marketOwner: Keypair,
    private lendingMarket: PublicKey
  ) {}
  
  async enableFlashLoansWithChecks(): Promise<boolean> {
    try {
      // Perform safety checks before enabling
      const safetyChecks = await this.performSafetyChecks();
      
      if (!safetyChecks.safe) {
        console.warn("Safety checks failed, not enabling flash loans:", safetyChecks.issues);
        return false;
      }
      
      const marketData = await this.program.account.lendingMarket.fetch(this.lendingMarket);
      
      if (!marketData.enableFlashLoans) {
        await toggleFlashLoans(this.program, this.marketOwner, this.lendingMarket);
        console.log("✅ Flash loans enabled successfully");
        return true;
      } else {
        console.log("Flash loans are already enabled");
        return true;
      }
    } catch (error) {
      console.error("Failed to enable flash loans:", error);
      return false;
    }
  }
  
  async disableFlashLoansEmergency(): Promise<boolean> {
    try {
      const marketData = await this.program.account.lendingMarket.fetch(this.lendingMarket);
      
      if (marketData.enableFlashLoans) {
        await toggleFlashLoans(this.program, this.marketOwner, this.lendingMarket);
        console.log("🚨 Flash loans disabled for emergency");
        return true;
      } else {
        console.log("Flash loans are already disabled");
        return true;
      }
    } catch (error) {
      console.error("Failed to disable flash loans:", error);
      return false;
    }
  }
  
  private async performSafetyChecks(): Promise<{ safe: boolean; issues: string[] }> {
    const issues: string[] = [];
    
    // Check reserve health
    const reserves = await this.getAllMarketReserves();
    for (const reserve of reserves) {
      const reserveData = await this.program.account.reserve.fetch(reserve);
      const utilizationRate = reserveData.liquidity.borrowedAmountWads.toNumber() / 
                              reserveData.liquidity.availableAmount.toNumber();
      
      if (utilizationRate > 0.9) {
        issues.push(`Reserve ${reserve} has high utilization: ${utilizationRate * 100}%`);
      }
    }
    
    // Check oracle health
    // Implementation would verify price feed freshness
    
    // Check protocol governance status
    // Implementation would check for pending governance actions
    
    return {
      safe: issues.length === 0,
      issues,
    };
  }
  
  private async getAllMarketReserves(): Promise<PublicKey[]> {
    // Implementation would fetch all reserves for the market
    return [];
  }
}

// Usage
const flashLoanManager = new FlashLoanManager(
  program,
  marketOwnerKeypair,
  lendingMarketAddress
);

// Enable with safety checks
await flashLoanManager.enableFlashLoansWithChecks();

// Emergency disable
await flashLoanManager.disableFlashLoansEmergency();
```

**Governance Integration Example:**
```typescript
// Integration with governance system for flash loan decisions
async function governanceToggleFlashLoans(
  program: Program<BorrowLending>,
  governanceProgram: Program<GovernanceProgram>,
  proposal: PublicKey,
  lendingMarket: PublicKey
) {
  // Verify governance proposal passed
  const proposalData = await governanceProgram.account.proposal.fetch(proposal);
  
  if (proposalData.state !== "Passed") {
    throw new Error("Governance proposal has not passed");
  }
  
  // Execute flash loan toggle through governance
  const governanceAuthority = await getGovernanceAuthority(governanceProgram, proposal);
  
  await program.rpc.toggleFlashLoans({
    accounts: {
      marketOwner: governanceAuthority,
      lendingMarket: lendingMarket,
    },
    // Note: Governance authority would sign this transaction
  });
}
```

**Monitoring Flash Loan Status:**
```typescript
async function monitorFlashLoanStatus(
  program: Program<BorrowLending>,
  lendingMarket: PublicKey
) {
  const marketData = await program.account.lendingMarket.fetch(lendingMarket);
  
  return {
    enabled: marketData.enableFlashLoans,
    lastToggleSlot: marketData.lastUpdate?.slot || 0,
    marketOwner: marketData.owner,
    totalReserves: await getMarketReserveCount(program, lendingMarket),
  };
}

// Real-time monitoring
setInterval(async () => {
  const status = await monitorFlashLoanStatus(program, lendingMarketAddress);
  console.log(`Flash loans: ${status.enabled ? '✅ Enabled' : '❌ Disabled'}`);
}, 30000); // Check every 30 seconds
```

**Integration Considerations:**
- Consider the impact on protocol revenue when disabling flash loans
- Communicate flash loan status changes to users and integrators
- Monitor flash loan utilization before and after status changes
- Implement automated monitoring for emergency situations
- Consider gradual enablement for new markets
- Document flash loan policies for users

**Related Instructions:**
- [`flash_loan`](#flash_loan) - Execute flash loans when enabled
- [`init_lending_market`](#init_lending_market) - Set initial flash loan status
- [`update_lending_market`](#update_lending_market) - Update market configuration

---

### AMM Integration

AMM (Automated Market Maker) integration instructions enable leveraged yield farming and advanced position management through integration with the Aldrin AMM. These operations allow users to create leveraged positions in liquidity pools using borrowed funds.

#### `compound_position_on_aldrin`

**Function Signature:**
```rust
pub fn compound_position_on_aldrin(
    ctx: Context<CompoundPositionOnAldrin>,
    lending_market_bump_seed: u8,
) -> Result<()>
```

**Description:**
Compounds a leveraged yield farming position on Aldrin AMM by automatically harvesting rewards, swapping them for underlying tokens, and reinvesting them into the position. This operation maximizes yield by automating the compounding process.

The compounding process:
1. Harvests pending rewards from the AMM position
2. Swaps rewards for underlying LP tokens
3. Adds liquidity back to the AMM pool
4. Updates the leveraged position accounting
5. Collects protocol fees on the compounded amount

This automation saves gas costs and ensures optimal compounding frequency for users.

**Parameters:**

- `lending_market_bump_seed: u8` - Bump seed for lending market PDA
  - Used to derive the lending market authority
  - Required for signing AMM transactions
  - Must match the canonical bump for the market

**Accounts:**

1. `admin_bot: Signer<'info>` - Authorized bot for admin operations
   - Must match the admin bot set in the lending market
   - Only admin bot can perform automated compounding
   - Prevents unauthorized position manipulation

2. `lending_market: Box<Account<'info, LendingMarket>>` - The lending market
   - Must be properly initialized
   - Provides market configuration and authority
   - Links to the Aldrin AMM program

3. `obligation: AccountLoader<'info, Obligation>` - Obligation with leveraged position
   - Must contain a yield farming loan
   - Must be properly initialized and not stale
   - Position will be compounded and updated

4. `aldrin_pool: AccountInfo<'info>` - Aldrin AMM pool
   - The liquidity pool where position is held
   - Must be a valid Aldrin pool
   - Source of pending rewards

5. `position_authority: AccountInfo<'info>` - Authority for the leveraged position
   - Typically the lending market PDA
   - Controls position management operations
   - Signs AMM transactions

6. `reward_vault: AccountInfo<'info>` - Vault containing harvestable rewards
   - Aldrin pool's reward distribution vault
   - Source of rewards to be compounded
   - Must contain pending rewards

7. `aldrin_amm_program: AccountInfo<'info>` - Aldrin AMM program
   - Must match the program configured in lending market
   - Used for AMM operations
   - Handles reward harvesting and compounding

8. `token_program: Program<'info, Token>` - SPL Token program
9. `clock: Sysvar<'info, Clock>` - Clock sysvar for timestamps

**Additional Accounts:**
The instruction may require additional accounts for:
- Token accounts for reward tokens
- Intermediate swap accounts
- LP token accounts
- Fee collection accounts

**Account Constraints:**
- Admin bot must match the configured admin bot
- Obligation must have an active yield farming position
- Aldrin pool must be valid and active
- Position must have pending rewards to compound

**State Changes:**
- Pending rewards are harvested from AMM position
- Rewards are swapped and reinvested into LP position
- Obligation's leveraged position value increases
- Protocol compound fees are collected
- Position accounting is updated

**Compound Fee Collection:**
Protocol collects fees on the compounded amount:
```rust
compound_fee = compounded_amount * compound_fee_rate
net_compound = compounded_amount - compound_fee
```

**Error Conditions:**
- `UnauthorizedBot` - If signer is not the configured admin bot
- `NoCompoundableRewards` - If position has no pending rewards
- `PositionNotFound` - If obligation doesn't have yield farming position
- `AmmPoolInvalid` - If Aldrin pool is not valid
- `CompoundingFailed` - If AMM operations fail

**Security Considerations:**
- Only authorized admin bot can trigger compounding
- Verify AMM pool legitimacy before operations
- Monitor for sandwich attacks during swaps
- Validate reward token authenticity
- Check for position ownership

**TypeScript Example:**
```typescript
async function compoundAldrinPosition(
  program: Program<BorrowLending>,
  adminBot: Keypair,
  obligation: PublicKey,
  aldrinPool: PublicKey
) {
  // Get obligation and market data
  const obligationData = await program.account.obligation.fetch(obligation);
  const lendingMarket = obligationData.lendingMarket;
  const marketData = await program.account.lendingMarket.fetch(lendingMarket);
  
  // Verify admin bot authorization
  if (!adminBot.publicKey.equals(marketData.adminBot)) {
    throw new Error("Unauthorized admin bot");
  }
  
  // Derive lending market PDA
  const [lendingMarketPda, bump] = await PublicKey.findProgramAddress(
    [lendingMarket.toBuffer()],
    program.programId
  );
  
  // Get Aldrin pool data
  const aldrinPoolData = await getAldrinPoolData(aldrinPool);
  
  // Check for pending rewards
  const pendingRewards = await getPendingRewards(obligation, aldrinPool);
  console.log(`Pending rewards: ${pendingRewards}`);
  
  if (pendingRewards === 0) {
    console.log("No rewards to compound");
    return null;
  }
  
  // Create compound instruction
  const signature = await program.rpc.compoundPositionOnAldrin(bump, {
    accounts: {
      adminBot: adminBot.publicKey,
      lendingMarket: lendingMarket,
      obligation: obligation,
      aldrinPool: aldrinPool,
      positionAuthority: lendingMarketPda,
      rewardVault: aldrinPoolData.rewardVault,
      aldrinAmmProgram: marketData.aldrinAmm,
      tokenProgram: TOKEN_PROGRAM_ID,
      clock: SYSVAR_CLOCK_PUBKEY,
    },
    remainingAccounts: [
      // Additional accounts for token swaps and LP operations
      { pubkey: aldrinPoolData.tokenAAccount, isWritable: true, isSigner: false },
      { pubkey: aldrinPoolData.tokenBAccount, isWritable: true, isSigner: false },
      { pubkey: aldrinPoolData.lpMint, isWritable: true, isSigner: false },
    ],
    signers: [adminBot],
  });
  
  console.log(`Position compounded: ${signature}`);
  
  // Calculate compound effect
  const newPendingRewards = await getPendingRewards(obligation, aldrinPool);
  const compoundedAmount = pendingRewards - newPendingRewards;
  console.log(`Compounded amount: ${compoundedAmount}`);
  
  return signature;
}

async function getAldrinPoolData(pool: PublicKey) {
  // Implementation would fetch Aldrin pool data
  return {
    rewardVault: new PublicKey("..."),
    tokenAAccount: new PublicKey("..."),
    tokenBAccount: new PublicKey("..."),
    lpMint: new PublicKey("..."),
  };
}

async function getPendingRewards(obligation: PublicKey, pool: PublicKey): Promise<number> {
  // Implementation would calculate pending rewards
  return 0;
}

// Example: Compound leveraged yield farming position
await compoundAldrinPosition(
  program,
  adminBotKeypair,
  leveragedObligationAddress,
  aldrinPoolAddress
);
```

**CLI Example:**
```bash
# Compound Aldrin position
solana-borrow-lending compound-aldrin \
  --obligation 5ZWj7a1TsYKqN1jjsxiH5xRoUakQBBT4F1SkUh9bUW7n \
  --pool 8GWTTbNiXdmyZREXbjsZBmCRuzdPrW55dnZGDkTRjWvb \
  --admin-bot ./admin-bot-keypair.json \
  --rpc-url https://api.mainnet-beta.solana.com
```

**Automated Compounding Bot:**
```typescript
class AldrinCompoundingBot {
  constructor(
    private program: Program<BorrowLending>,
    private adminBot: Keypair,
    private minCompoundAmount: number = 10 // Minimum reward amount to compound
  ) {}
  
  async runCompoundingCycle(positions: LeveragedPosition[]) {
    console.log(`🤖 Running compounding cycle for ${positions.length} positions`);
    
    for (const position of positions) {
      try {
        await this.compoundPositionIfProfitable(position);
      } catch (error) {
        console.error(`Failed to compound position ${position.obligation}:`, error);
      }
    }
  }
  
  private async compoundPositionIfProfitable(position: LeveragedPosition) {
    const pendingRewards = await getPendingRewards(position.obligation, position.aldrinPool);
    
    if (pendingRewards < this.minCompoundAmount) {
      console.log(`Position ${position.obligation}: rewards too small (${pendingRewards})`);
      return;
    }
    
    // Calculate compounding profitability
    const compoundFee = await this.getCompoundFee(position);
    const gasCost = await this.estimateGasCost();
    const netBenefit = pendingRewards - compoundFee - gasCost;
    
    if (netBenefit > 0) {
      console.log(`💰 Compounding position ${position.obligation}: net benefit ${netBenefit}`);
      await compoundAldrinPosition(
        this.program,
        this.adminBot,
        position.obligation,
        position.aldrinPool
      );
    } else {
      console.log(`Position ${position.obligation}: not profitable to compound yet`);
    }
  }
  
  private async getCompoundFee(position: LeveragedPosition): Promise<number> {
    const obligationData = await this.program.account.obligation.fetch(position.obligation);
    const marketData = await this.program.account.lendingMarket.fetch(
      obligationData.lendingMarket
    );
    
    const leveragedCompoundFee = marketData.leveragedCompoundFee / 10000; // Convert from basis points
    const pendingRewards = await getPendingRewards(position.obligation, position.aldrinPool);
    
    return pendingRewards * leveragedCompoundFee;
  }
  
  private async estimateGasCost(): Promise<number> {
    // Estimate gas cost in USD
    const solPrice = 100; // Would fetch from oracle
    const estimatedGas = 0.005; // SOL
    return estimatedGas * solPrice;
  }
}

interface LeveragedPosition {
  obligation: PublicKey;
  aldrinPool: PublicKey;
  owner: PublicKey;
}

// Usage
const compoundingBot = new AldrinCompoundingBot(program, adminBotKeypair, 50);

// Run every hour
setInterval(async () => {
  const leveragedPositions = await getAllLeveragedPositions();
  await compoundingBot.runCompoundingCycle(leveragedPositions);
}, 3600000); // 1 hour
```

**Compound Yield Calculation:**
```typescript
async function calculateCompoundYield(
  program: Program<BorrowLending>,
  obligation: PublicKey,
  aldrinPool: PublicKey,
  timeframe: number // days
): Promise<{
  dailyYield: number;
  projectedYield: number;
  compoundFrequency: number;
  effectiveApy: number;
}> {
  // Get position data
  const obligationData = await program.account.obligation.fetch(obligation);
  const positionValue = obligationData.depositedValue.toNumber();
  
  // Calculate daily reward rate
  const dailyRewards = await getDailyRewardRate(aldrinPool);
  const dailyYield = (dailyRewards / positionValue) * 100;
  
  // Calculate optimal compounding frequency
  const compoundCost = await getCompoundCost(obligation);
  const optimalFrequency = calculateOptimalCompoundFrequency(dailyRewards, compoundCost);
  
  // Project compound yield
  const dailyCompoundRate = dailyYield / 100 / optimalFrequency;
  const effectiveApy = Math.pow(1 + dailyCompoundRate, 365 * optimalFrequency) - 1;
  const projectedYield = positionValue * effectiveApy * (timeframe / 365);
  
  return {
    dailyYield,
    projectedYield,
    compoundFrequency: optimalFrequency,
    effectiveApy: effectiveApy * 100,
  };
}

function calculateOptimalCompoundFrequency(
  dailyRewards: number,
  compoundCost: number
): number {
  // Find frequency where compound cost equals reward benefit
  // More frequent compounding increases yield but costs more
  
  const frequencies = [1, 2, 4, 8, 24]; // Times per day
  let optimalFrequency = 1;
  let maxNetYield = 0;
  
  for (const freq of frequencies) {
    const rewardPerCompound = dailyRewards / freq;
    const netRewardPerCompound = rewardPerCompound - compoundCost;
    const dailyNetYield = netRewardPerCompound * freq;
    
    if (dailyNetYield > maxNetYield) {
      maxNetYield = dailyNetYield;
      optimalFrequency = freq;
    }
  }
  
  return optimalFrequency;
}
```

**Integration Considerations:**
- Only authorized admin bots should trigger compounding
- Monitor gas costs to ensure compounding remains profitable
- Implement slippage protection for reward swaps
- Consider MEV protection for compounding transactions
- Track compounding effectiveness and optimization
- Coordinate with Aldrin AMM for pool-specific logic

**Related Instructions:**
- [`init_leveraged_position`](#init_leveraged_position) - Create leveraged yield farming positions
- [`close_leveraged_position_on_aldrin`](#close_leveraged_position_on_aldrin) - Close positions
- [`flash_loan`](#flash_loan) - Flash loans for position creation

---

### Administrative Functions

Administrative functions provide market operators with tools to manage and configure the lending protocol. These functions are restricted to authorized users and enable protocol maintenance, upgrades, and emergency responses.

#### `refresh_reserve`

**Function Signature:**
```rust
pub fn refresh_reserve(
    ctx: Context<RefreshReserve>,
) -> Result<()>
```

**Description:**
Updates a reserve's derived state including interest rates, accumulated interest, and liquidity calculations. This operation must be called before most other reserve operations to ensure accurate calculations based on current market conditions.

The refresh operation:
1. Calculates elapsed time since last update
2. Accrues interest on outstanding borrows
3. Updates supply and borrow rates based on utilization
4. Refreshes cumulative rate tracking
5. Updates last update timestamp

Regular refreshing ensures accurate interest calculations and prevents stale data from affecting protocol operations.

**Parameters:**
This instruction takes no additional parameters beyond the accounts context.

**Accounts:**

1. `reserve: Account<'info, Reserve>` - The reserve to refresh
   - Must be properly initialized
   - State will be updated with current calculations
   - Becomes fresh after successful execution

2. `pyth_price: AccountInfo<'info>` - Pyth price account for the reserve
   - Must be a valid Pyth price feed
   - Provides current price data for calculations
   - Must not be stale or invalid

3. `clock: Sysvar<'info, Clock>` - Clock sysvar for current timestamp

**Account Constraints:**
- Reserve must be properly initialized
- Pyth price account must be valid and current
- Price data must not be stale

**State Changes:**
- Interest is accrued on outstanding borrows
- Supply and borrow rates are recalculated
- Cumulative rate tracking is updated
- Last update timestamp is set to current slot
- Reserve becomes marked as fresh

**Interest Rate Calculation:**
Interest rates are updated based on current utilization:
```rust
utilization_rate = total_borrows / (total_borrows + available_liquidity)

// Interest rate model (simplified)
if utilization_rate <= optimal_utilization {
    borrow_rate = min_rate + (optimal_rate - min_rate) * (utilization_rate / optimal_utilization)
} else {
    excess_utilization = utilization_rate - optimal_utilization
    borrow_rate = optimal_rate + (max_rate - optimal_rate) * (excess_utilization / (1 - optimal_utilization))
}

supply_rate = borrow_rate * utilization_rate * (1 - reserve_factor)
```

**Error Conditions:**
- `ReserveNotFound` - If reserve account is invalid
- `InvalidOracle` - If Pyth price account is invalid
- `StalePriceData` - If price data is too old
- `CalculationError` - If interest calculations fail

**Security Considerations:**
- Verify Pyth price feed authenticity
- Check for reasonable price movements
- Prevent manipulation of rate calculations
- Monitor for oracle failures

**TypeScript Example:**
```typescript
async function refreshReserve(
  program: Program<BorrowLending>,
  reserve: PublicKey
) {
  // Get reserve data to find oracle
  const reserveData = await program.account.reserve.fetch(reserve);
  const pythPrice = reserveData.liquidity.pythPriceKey;
  
  // Check if refresh is needed
  const currentSlot = await program.provider.connection.getSlot();
  const lastUpdateSlot = reserveData.lastUpdate.slot.toNumber();
  const slotsSinceUpdate = currentSlot - lastUpdateSlot;
  
  console.log(`Slots since last update: ${slotsSinceUpdate}`);
  
  if (slotsSinceUpdate < 1) {
    console.log("Reserve is already fresh");
    return null;
  }
  
  // Refresh the reserve
  const signature = await program.rpc.refreshReserve({
    accounts: {
      reserve: reserve,
      pythPrice: pythPrice,
      clock: SYSVAR_CLOCK_PUBKEY,
    },
  });
  
  console.log(`Reserve refreshed: ${signature}`);
  
  // Fetch updated data
  const updatedReserveData = await program.account.reserve.fetch(reserve);
  console.log(`New borrow rate: ${updatedReserveData.currentBorrowRate}%`);
  console.log(`New supply rate: ${updatedReserveData.currentSupplyRate}%`);
  
  return signature;
}

// Example: Refresh USDC reserve
const usdcReserve = new PublicKey("8GWTTbNiXdmyZREXbjsZBmCRuzdPrW55dnZGDkTRjWvb");
await refreshReserve(program, usdcReserve);
```

**CLI Example:**
```bash
# Refresh a specific reserve
solana-borrow-lending refresh-reserve \
  --reserve 8GWTTbNiXdmyZREXbjsZBmCRuzdPrW55dnZGDkTRjWvb \
  --rpc-url https://api.mainnet-beta.solana.com

# Refresh all reserves in a market
solana-borrow-lending refresh-all-reserves \
  --market 5ZWj7a1TsYKqN1jjsxiH5xRoUakQBBT4F1SkUh9bUW7n
```

**Batch Reserve Refresh:**
```typescript
async function refreshAllReserves(
  program: Program<BorrowLending>,
  reserves: PublicKey[]
) {
  const transaction = new Transaction();
  
  // Add refresh instruction for each reserve
  for (const reserve of reserves) {
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
  
  // Send batch transaction
  const signature = await program.provider.send(transaction);
  console.log(`All reserves refreshed: ${signature}`);
  
  return signature;
}

// Example: Refresh all market reserves
const allReserves = await getAllMarketReserves(program, lendingMarketAddress);
await refreshAllReserves(program, allReserves);
```

**Automated Refresh Bot:**
```typescript
class ReserveRefreshBot {
  constructor(
    private program: Program<BorrowLending>,
    private bot: Keypair,
    private refreshIntervalSlots: number = 100
  ) {}
  
  async startRefreshCycle(reserves: PublicKey[]) {
    console.log(`🤖 Starting refresh bot for ${reserves.length} reserves`);
    
    setInterval(async () => {
      await this.refreshStaleReserves(reserves);
    }, 30000); // Check every 30 seconds
  }
  
  private async refreshStaleReserves(reserves: PublicKey[]) {
    const currentSlot = await this.program.provider.connection.getSlot();
    const staleReserves: PublicKey[] = [];
    
    // Check which reserves need refreshing
    for (const reserve of reserves) {
      try {
        const reserveData = await this.program.account.reserve.fetch(reserve);
        const lastUpdateSlot = reserveData.lastUpdate.slot.toNumber();
        const slotsSinceUpdate = currentSlot - lastUpdateSlot;
        
        if (slotsSinceUpdate >= this.refreshIntervalSlots) {
          staleReserves.push(reserve);
        }
      } catch (error) {
        console.error(`Error checking reserve ${reserve}:`, error);
      }
    }
    
    if (staleReserves.length > 0) {
      console.log(`🔄 Refreshing ${staleReserves.length} stale reserves`);
      await this.batchRefreshReserves(staleReserves);
    }
  }
  
  private async batchRefreshReserves(reserves: PublicKey[]) {
    // Split into batches to avoid transaction size limits
    const batchSize = 10;
    const batches = [];
    
    for (let i = 0; i < reserves.length; i += batchSize) {
      batches.push(reserves.slice(i, i + batchSize));
    }
    
    for (const batch of batches) {
      try {
        await refreshAllReserves(this.program, batch);
        console.log(`✅ Refreshed batch of ${batch.length} reserves`);
      } catch (error) {
        console.error(`❌ Failed to refresh batch:`, error);
      }
    }
  }
}

// Usage
const refreshBot = new ReserveRefreshBot(program, botKeypair, 50);
await refreshBot.startRefreshCycle(monitoredReserves);
```

**Interest Rate Monitoring:**
```typescript
async function monitorInterestRates(
  program: Program<BorrowLending>,
  reserve: PublicKey
): Promise<{
  utilizationRate: number;
  borrowRate: number;
  supplyRate: number;
  rateChange: number;
  staleness: number;
}> {
  const reserveData = await program.account.reserve.fetch(reserve);
  
  // Calculate utilization rate
  const totalBorrows = reserveData.liquidity.borrowedAmountWads.toNumber();
  const availableLiquidity = reserveData.liquidity.availableAmount.toNumber();
  const utilizationRate = totalBorrows / (totalBorrows + availableLiquidity);
  
  // Get current rates
  const borrowRate = reserveData.currentBorrowRate;
  const supplyRate = reserveData.currentSupplyRate;
  
  // Calculate staleness
  const currentSlot = await program.provider.connection.getSlot();
  const lastUpdateSlot = reserveData.lastUpdate.slot.toNumber();
  const staleness = currentSlot - lastUpdateSlot;
  
  // Calculate rate change (would need historical data)
  const rateChange = 0; // Placeholder for rate change calculation
  
  return {
    utilizationRate: utilizationRate * 100,
    borrowRate: borrowRate * 100,
    supplyRate: supplyRate * 100,
    rateChange,
    staleness,
  };
}

// Example: Monitor USDC rates
const rateInfo = await monitorInterestRates(program, usdcReserve);
console.log(`USDC Utilization: ${rateInfo.utilizationRate.toFixed(2)}%`);
console.log(`USDC Borrow Rate: ${rateInfo.borrowRate.toFixed(2)}%`);
console.log(`USDC Supply Rate: ${rateInfo.supplyRate.toFixed(2)}%`);
```

**Oracle Health Monitoring:**
```typescript
async function checkOracleHealth(
  program: Program<BorrowLending>,
  reserve: PublicKey
): Promise<{
  healthy: boolean;
  price: number;
  confidence: number;
  lastUpdate: number;
  staleness: number;
}> {
  const reserveData = await program.account.reserve.fetch(reserve);
  const pythPrice = reserveData.liquidity.pythPriceKey;
  
  // Fetch price data from Pyth
  const priceData = await getPythPriceData(pythPrice);
  
  // Check price staleness (implementation depends on Pyth client)
  const currentTime = Date.now() / 1000;
  const staleness = currentTime - priceData.publishTime;
  
  // Determine health based on staleness and confidence
  const healthy = staleness < 60 && priceData.confidence < priceData.price * 0.01; // 1% max confidence
  
  return {
    healthy,
    price: priceData.price,
    confidence: priceData.confidence,
    lastUpdate: priceData.publishTime,
    staleness,
  };
}

async function getPythPriceData(pythPrice: PublicKey) {
  // Implementation would use Pyth client library
  return {
    price: 1.0,
    confidence: 0.001,
    publishTime: Date.now() / 1000,
  };
}
```

**Integration Considerations:**
- Refresh reserves before major operations for accuracy
- Implement automated refresh bots for production systems
- Monitor oracle health and price feed reliability
- Consider refresh costs in gas optimization
- Handle refresh failures gracefully in applications
- Coordinate refresh timing with high-volume operations

**Related Instructions:**
- [`refresh_obligation`](#refresh_obligation) - Refresh obligation state
- [`deposit_reserve_liquidity`](#deposit_reserve_liquidity) - Operations requiring fresh reserves
- [`borrow_obligation_liquidity`](#borrow_obligation_liquidity) - Borrowing with current rates

---

#### `refresh_obligation`

**Function Signature:**
```rust
pub fn refresh_obligation(
    ctx: Context<RefreshObligation>,
) -> Result<()>
```

**Description:**
Updates an obligation's derived state including deposited value, borrowed value, allowed borrow value, and health factor calculations. This operation must be called before most obligation operations to ensure accurate risk assessments based on current market conditions.

The refresh operation:
1. Recalculates deposited collateral values using current prices
2. Updates borrowed value with accrued interest
3. Computes allowed borrow value based on LTV ratios
4. Calculates unhealthy borrow value threshold
5. Updates health factor and liquidation risk

Regular refreshing ensures accurate position monitoring and prevents stale calculations from affecting borrowing and liquidation decisions.

**Parameters:**
This instruction takes no additional parameters beyond the accounts context.

**Accounts:**

1. `obligation: AccountLoader<'info, Obligation>` - The obligation to refresh
   - Must be properly initialized
   - State will be updated with current calculations
   - Becomes fresh after successful execution

2. `clock: Sysvar<'info, Clock>` - Clock sysvar for current timestamp

**Remaining Accounts:**
The instruction requires all reserves associated with the obligation as remaining accounts:
- Each deposit reserve (for collateral value calculations)
- Each borrow reserve (for debt value calculations)
- Reserves must be provided in specific order matching obligation arrays

**Account Constraints:**
- Obligation must be properly initialized
- All associated reserves must be provided as remaining accounts
- Reserves must not be stale (recently refreshed)

**State Changes:**
- Deposited value is recalculated with current prices and exchange rates
- Borrowed value is updated with accrued interest
- Allowed borrow value is computed based on LTV ratios
- Unhealthy borrow value threshold is calculated
- Health factor is updated
- Last update timestamp is set to current slot
- Obligation becomes marked as fresh

**Value Calculations:**
The refresh process updates several key values:

```rust
// Deposited value calculation
for deposit in deposits {
    reserve_data = get_reserve_data(deposit.reserve);
    exchange_rate = reserve_data.exchange_rate();
    token_price = get_oracle_price(reserve_data.oracle);
    
    deposit_value = deposit.deposited_amount * exchange_rate * token_price;
    total_deposited_value += deposit_value;
}

// Borrowed value calculation  
for borrow in borrows {
    reserve_data = get_reserve_data(borrow.reserve);
    accrued_interest = calculate_accrued_interest(borrow, reserve_data);
    current_debt = borrow.borrowed_amount + accrued_interest;
    token_price = get_oracle_price(reserve_data.oracle);
    
    borrow_value = current_debt * token_price;
    total_borrowed_value += borrow_value;
}

// Allowed borrow value
for deposit in deposits {
    ltv_ratio = get_ltv_ratio(deposit.reserve);
    allowed_value += deposit_value * ltv_ratio;
}

// Health factor
health_factor = total_deposited_value / total_borrowed_value;
```

**Error Conditions:**
- `ObligationNotFound` - If obligation account is invalid
- `ReserveStale` - If any associated reserve is stale
- `MissingReserves` - If not all reserves are provided
- `CalculationError` - If value calculations fail
- `OracleError` - If price data is invalid

**Security Considerations:**
- Verify all associated reserves are provided
- Check for reasonable price movements
- Prevent manipulation of health factor calculations
- Monitor for oracle failures or attacks

**TypeScript Example:**
```typescript
async function refreshObligation(
  program: Program<BorrowLending>,
  obligation: PublicKey
) {
  // Get obligation data to find associated reserves
  const obligationData = await program.account.obligation.fetch(obligation);
  
  // Collect all unique reserves
  const reserves = new Set<string>();
  
  obligationData.deposits.forEach(deposit => {
    if (deposit.depositReserve) {
      reserves.add(deposit.depositReserve.toString());
    }
  });
  
  obligationData.borrows.forEach(borrow => {
    if (borrow.borrowReserve) {
      reserves.add(borrow.borrowReserve.toString());
    }
  });
  
  const reserveKeys = Array.from(reserves).map(r => new PublicKey(r));
  
  console.log(`Refreshing obligation with ${reserveKeys.length} associated reserves`);
  
  // Check if refresh is needed
  const currentSlot = await program.provider.connection.getSlot();
  const lastUpdateSlot = obligationData.lastUpdate.slot.toNumber();
  const slotsSinceUpdate = currentSlot - lastUpdateSlot;
  
  if (slotsSinceUpdate < 1) {
    console.log("Obligation is already fresh");
    return null;
  }
  
  // Refresh the obligation
  const signature = await program.rpc.refreshObligation({
    accounts: {
      obligation: obligation,
      clock: SYSVAR_CLOCK_PUBKEY,
    },
    remainingAccounts: reserveKeys.map(reserve => ({
      pubkey: reserve,
      isWritable: false,
      isSigner: false,
    })),
  });
  
  console.log(`Obligation refreshed: ${signature}`);
  
  // Fetch updated data
  const updatedObligationData = await program.account.obligation.fetch(obligation);
  const healthFactor = updatedObligationData.depositedValue.toNumber() / 
                      updatedObligationData.borrowedValue.toNumber();
  
  console.log(`Updated health factor: ${healthFactor.toFixed(3)}`);
  console.log(`Deposited value: $${updatedObligationData.depositedValue.toNumber()}`);
  console.log(`Borrowed value: $${updatedObligationData.borrowedValue.toNumber()}`);
  
  return signature;
}

// Example: Refresh user's obligation
await refreshObligation(program, userObligationAddress);
```

**CLI Example:**
```bash
# Refresh a specific obligation
solana-borrow-lending refresh-obligation \
  --obligation 5ZWj7a1TsYKqN1jjsxiH5xRoUakQBBT4F1SkUh9bUW7n \
  --rpc-url https://api.mainnet-beta.solana.com

# Refresh with verbose output
solana-borrow-lending refresh-obligation \
  --obligation 5ZWj7a1TsYKqN1jjsxiH5xRoUakQBBT4F1SkUh9bUW7n \
  --verbose
```

**Batch Obligation Refresh:**
```typescript
async function refreshMultipleObligations(
  program: Program<BorrowLending>,
  obligations: PublicKey[]
) {
  const results: Array<{ obligation: PublicKey; success: boolean; error?: string }> = [];
  
  for (const obligation of obligations) {
    try {
      await refreshObligation(program, obligation);
      results.push({ obligation, success: true });
    } catch (error) {
      console.error(`Failed to refresh obligation ${obligation}:`, error);
      results.push({ 
        obligation, 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  
  const successCount = results.filter(r => r.success).length;
  console.log(`Successfully refreshed ${successCount}/${obligations.length} obligations`);
  
  return results;
}
```

**Health Factor Monitoring:**
```typescript
async function monitorObligationHealth(
  program: Program<BorrowLending>,
  obligation: PublicKey,
  alertThreshold: number = 1.2
): Promise<{
  healthFactor: number;
  riskLevel: 'Safe' | 'Warning' | 'Danger' | 'Liquidatable';
  depositedValue: number;
  borrowedValue: number;
  availableBorrow: number;
}> {
  // Ensure obligation is fresh
  await refreshObligation(program, obligation);
  
  const obligationData = await program.account.obligation.fetch(obligation);
  
  const depositedValue = obligationData.depositedValue.toNumber();
  const borrowedValue = obligationData.borrowedValue.toNumber();
  const allowedBorrowValue = obligationData.allowedBorrowValue.toNumber();
  
  const healthFactor = borrowedValue > 0 ? depositedValue / borrowedValue : Infinity;
  const availableBorrow = allowedBorrowValue - borrowedValue;
  
  // Determine risk level
  let riskLevel: 'Safe' | 'Warning' | 'Danger' | 'Liquidatable';
  if (healthFactor < 1.0) {
    riskLevel = 'Liquidatable';
  } else if (healthFactor < 1.1) {
    riskLevel = 'Danger';
  } else if (healthFactor < alertThreshold) {
    riskLevel = 'Warning';
  } else {
    riskLevel = 'Safe';
  }
  
  return {
    healthFactor,
    riskLevel,
    depositedValue,
    borrowedValue,
    availableBorrow,
  };
}

// Example: Monitor user's obligation health
const healthInfo = await monitorObligationHealth(program, userObligationAddress, 1.5);
console.log(`Health Factor: ${healthInfo.healthFactor.toFixed(3)} (${healthInfo.riskLevel})`);

if (healthInfo.riskLevel !== 'Safe') {
  console.warn(`⚠️  Position at risk! Consider adding collateral or repaying debt.`);
}
```

**Automated Health Monitoring Bot:**
```typescript
class ObligationHealthBot {
  constructor(
    private program: Program<BorrowLending>,
    private alertThreshold: number = 1.3,
    private liquidationThreshold: number = 1.05
  ) {}
  
  async startMonitoring(obligations: PublicKey[]) {
    console.log(`🏥 Starting health monitoring for ${obligations.length} obligations`);
    
    setInterval(async () => {
      await this.checkAllObligations(obligations);
    }, 60000); // Check every minute
  }
  
  private async checkAllObligations(obligations: PublicKey[]) {
    for (const obligation of obligations) {
      try {
        const health = await monitorObligationHealth(
          this.program, 
          obligation, 
          this.alertThreshold
        );
        
        await this.handleHealthStatus(obligation, health);
      } catch (error) {
        console.error(`Error monitoring obligation ${obligation}:`, error);
      }
    }
  }
  
  private async handleHealthStatus(
    obligation: PublicKey,
    health: Awaited<ReturnType<typeof monitorObligationHealth>>
  ) {
    switch (health.riskLevel) {
      case 'Liquidatable':
        console.error(`🚨 LIQUIDATABLE: ${obligation} (HF: ${health.healthFactor.toFixed(3)})`);
        await this.triggerLiquidationAlert(obligation, health);
        break;
        
      case 'Danger':
        console.warn(`⚠️  DANGER: ${obligation} (HF: ${health.healthFactor.toFixed(3)})`);
        await this.triggerDangerAlert(obligation, health);
        break;
        
      case 'Warning':
        console.log(`⚡ WARNING: ${obligation} (HF: ${health.healthFactor.toFixed(3)})`);
        await this.triggerWarningAlert(obligation, health);
        break;
        
      case 'Safe':
        // No action needed
        break;
    }
  }
  
  private async triggerLiquidationAlert(obligation: PublicKey, health: any) {
    // Implementation would:
    // 1. Notify liquidation bots
    // 2. Send urgent user notifications
    // 3. Log liquidation opportunity
    console.log(`📢 Liquidation opportunity: ${obligation}`);
  }
  
  private async triggerDangerAlert(obligation: PublicKey, health: any) {
    // Implementation would:
    // 1. Send user emergency notifications
    // 2. Suggest specific actions (add collateral, repay debt)
    // 3. Calculate required amounts
    const requiredCollateral = this.calculateRequiredCollateral(health);
    console.log(`💡 Suggestion: Add $${requiredCollateral} collateral or repay debt`);
  }
  
  private async triggerWarningAlert(obligation: PublicKey, health: any) {
    // Implementation would:
    // 1. Send user warning notifications
    // 2. Provide risk management suggestions
    console.log(`📋 Monitor position closely, consider risk management`);
  }
  
  private calculateRequiredCollateral(health: any): number {
    const targetHealthFactor = this.alertThreshold;
    const currentCollateral = health.depositedValue;
    const currentDebt = health.borrowedValue;
    
    const requiredCollateral = (currentDebt * targetHealthFactor) - currentCollateral;
    return Math.max(0, requiredCollateral);
  }
}

// Usage
const healthBot = new ObligationHealthBot(program, 1.3, 1.05);
await healthBot.startMonitoring(monitoredObligations);
```

**Position Analytics:**
```typescript
async function analyzeObligationPosition(
  program: Program<BorrowLending>,
  obligation: PublicKey
): Promise<{
  summary: string;
  recommendations: string[];
  riskMetrics: any;
  projections: any;
}> {
  const health = await monitorObligationHealth(program, obligation);
  const obligationData = await program.account.obligation.fetch(obligation);
  
  // Analyze position composition
  const depositComposition = await analyzeDepositComposition(obligationData);
  const borrowComposition = await analyzeBorrowComposition(obligationData);
  
  // Generate recommendations
  const recommendations: string[] = [];
  
  if (health.healthFactor < 1.5) {
    recommendations.push("Consider adding more collateral to improve health factor");
  }
  
  if (depositComposition.diversification < 0.5) {
    recommendations.push("Consider diversifying collateral across multiple assets");
  }
  
  if (borrowComposition.concentration > 0.8) {
    recommendations.push("Consider diversifying debt across multiple assets");
  }
  
  // Risk metrics
  const riskMetrics = {
    healthFactor: health.healthFactor,
    liquidationDistance: Math.max(0, health.healthFactor - 1.0),
    collateralizationRatio: health.depositedValue / health.borrowedValue,
    borrowUtilization: health.borrowedValue / health.depositedValue,
  };
  
  // Projections (simplified)
  const projections = {
    timeToLiquidation: estimateTimeToLiquidation(health, obligationData),
    interestCost: calculateDailyInterestCost(obligationData),
    yieldEarned: calculateDailyYieldEarned(obligationData),
  };
  
  const summary = generatePositionSummary(health, riskMetrics, projections);
  
  return {
    summary,
    recommendations,
    riskMetrics,
    projections,
  };
}

async function analyzeDepositComposition(obligationData: any) {
  // Analyze collateral diversification
  return { diversification: 0.7 }; // Placeholder
}

async function analyzeBorrowComposition(obligationData: any) {
  // Analyze debt concentration
  return { concentration: 0.6 }; // Placeholder
}

function estimateTimeToLiquidation(health: any, obligationData: any): number {
  // Estimate based on current interest rates and price volatility
  return 30; // days (placeholder)
}

function calculateDailyInterestCost(obligationData: any): number {
  // Calculate daily interest expense
  return 5; // USD (placeholder)
}

function calculateDailyYieldEarned(obligationData: any): number {
  // Calculate daily yield from deposits
  return 8; // USD (placeholder)
}

function generatePositionSummary(health: any, riskMetrics: any, projections: any): string {
  return `Position has ${health.healthFactor.toFixed(2)}x health factor with ${health.riskLevel.toLowerCase()} risk level. Daily net yield: $${(projections.yieldEarned - projections.interestCost).toFixed(2)}.`;
}
```

**Integration Considerations:**
- Always refresh obligations before critical operations
- Refresh all associated reserves before refreshing obligations
- Implement automated monitoring for production systems
- Handle refresh failures gracefully in applications
- Consider refresh costs in gas optimization
- Coordinate refresh timing with high-frequency operations

**Related Instructions:**
- [`refresh_reserve`](#refresh_reserve) - Refresh associated reserves first
- [`borrow_obligation_liquidity`](#borrow_obligation_liquidity) - Operations requiring fresh obligations
- [`liquidate_obligation`](#liquidate_obligation) - Liquidation based on fresh health factors

---

## Account Types

The Solana Borrow-Lending Protocol uses several key account types to manage state and operations. Understanding these account structures is essential for developers integrating with the protocol.

### Lending Market

The `LendingMarket` account serves as the top-level configuration container for all reserves and obligations within a market ecosystem.

#### Structure

```rust
#[account]
#[derive(Default)]
pub struct LendingMarket {
    /// Market owner with administrative privileges
    pub owner: Pubkey,
    
    /// Whether flash loans are enabled for this market
    pub enable_flash_loans: bool,
    
    /// Authorized bot for automated operations
    pub admin_bot: Pubkey,
    
    /// Aldrin AMM program ID for leveraged yield farming
    pub aldrin_amm: Pubkey,
    
    /// Fee percentage for leveraged position compounding
    pub leveraged_compound_fee: PercentageInt,
    
    /// Fee percentage for vault compounding operations
    pub vault_compound_fee: PercentageInt,
    
    /// Minimum collateral value required for leverage
    pub min_collateral_uac_value_for_leverage: SDecimal,
    
    /// Universal asset currency for value calculations
    pub currency: UniversalAssetCurrency,
    
    /// Reserved space for future configuration
    pub _padding: [u64; 16],
}
```

#### Field Descriptions

**owner: Pubkey**
- The account with administrative control over the market
- Can update market configuration, add reserves, and modify parameters
- Should be a multisig or governance program for production deployments
- Cannot be changed after market initialization except via transfer

**enable_flash_loans: bool**
- Controls whether flash loans are available in this market
- Can be toggled by the market owner for emergency or operational reasons
- Affects all reserves within the market
- Default: false (disabled for safety)

**admin_bot: Pubkey**
- Authorized account for automated operations like compounding
- Can execute admin-only endpoints without being the market owner
- Typically an automated bot or service account
- Should be carefully secured as it has operational privileges

**aldrin_amm: Pubkey**
- Program ID of the Aldrin AMM for leveraged yield farming
- Must be an executable program account
- Used for swap operations and liquidity provision
- Cannot be changed after market initialization

**leveraged_compound_fee: PercentageInt**
- Fee collected when compounding leveraged positions
- Expressed in basis points (0-10000, representing 0-100%)
- Applied to the compounded reward amount
- Revenue source for protocol and bot operators

**vault_compound_fee: PercentageInt**
- Fee collected when compounding vault positions
- Typically lower than leveraged compound fee due to reduced risk
- Expressed in basis points (0-10000, representing 0-100%)
- Applies to automated vault compounding operations

**min_collateral_uac_value_for_leverage: SDecimal**
- Minimum collateral value required to open leveraged positions
- Denominated in the market's universal asset currency
- Prevents dust positions that could destabilize the market
- Must be greater than zero to enable leverage

**currency: UniversalAssetCurrency**
- Base currency for all value calculations in the market
- Can be USD or a specific token address
- All reserves use this currency for pricing
- Cannot be changed after initialization

#### Account Size

The `LendingMarket` account requires **292 bytes** of space, calculated as:
- Fixed fields: 164 bytes
- Padding for future use: 128 bytes (16 × 8 bytes)

#### Creation and Management

```typescript
// Creating a new lending market
const lendingMarketKeypair = Keypair.generate();
const space = 292; // LendingMarket::space()
const lamports = await connection.getMinimumBalanceForRentExemption(space);

const createMarketInstruction = SystemProgram.createAccount({
  fromPubkey: payer.publicKey,
  newAccountPubkey: lendingMarketKeypair.publicKey,
  space,
  lamports,
  programId: borrowLendingProgramId,
});

// Initialize the market
const initMarketInstruction = await program.instruction.initLendingMarket(
  { usd: {} }, // UniversalAssetCurrency::USD
  50,          // 0.5% leveraged compound fee
  25,          // 0.25% vault compound fee
  "100.0",     // $100 minimum collateral for leverage
  {
    accounts: {
      owner: marketOwner.publicKey,
      adminBot: adminBotAddress,
      aldrinAmm: aldrinAmmProgramId,
      lendingMarket: lendingMarketKeypair.publicKey,
    },
    signers: [marketOwner, lendingMarketKeypair],
  }
);
```

#### Access Patterns

**Read Access:**
- Any account can read lending market data
- Common queries include checking flash loan status, fees, and configuration
- Used by UI applications to display market information

**Write Access:**
- Only the market owner can modify configuration
- Admin bot can execute operational functions
- Updates typically require specific instruction calls

#### Configuration Examples

```typescript
// Conservative market configuration
const conservativeConfig = {
  leveragedCompoundFee: 100,  // 1% fee
  vaultCompoundFee: 50,       // 0.5% fee
  minCollateralValue: "1000", // $1000 minimum
  enableFlashLoans: false,    // Disabled initially
};

// Aggressive growth configuration
const growthConfig = {
  leveragedCompoundFee: 25,   // 0.25% fee
  vaultCompoundFee: 10,       // 0.1% fee
  minCollateralValue: "50",   // $50 minimum
  enableFlashLoans: true,     // Enabled for advanced users
};

// Enterprise configuration
const enterpriseConfig = {
  leveragedCompoundFee: 30,   // 0.3% fee
  vaultCompoundFee: 15,       // 0.15% fee
  minCollateralValue: "500",  // $500 minimum
  enableFlashLoans: true,     // Full feature set
};
```

#### Monitoring and Analytics

```typescript
async function analyzeLendingMarket(
  program: Program<BorrowLending>,
  lendingMarket: PublicKey
): Promise<MarketAnalytics> {
  const marketData = await program.account.lendingMarket.fetch(lendingMarket);
  
  // Get all reserves in the market
  const reserves = await getAllMarketReserves(program, lendingMarket);
  
  // Calculate market-wide metrics
  const totalLiquidity = reserves.reduce((sum, reserve) => {
    return sum + reserve.liquidity.availableAmount.toNumber();
  }, 0);
  
  const totalBorrows = reserves.reduce((sum, reserve) => {
    return sum + reserve.liquidity.borrowedAmountWads.toNumber();
  }, 0);
  
  const averageUtilization = totalBorrows / (totalBorrows + totalLiquidity);
  
  return {
    owner: marketData.owner,
    flashLoansEnabled: marketData.enableFlashLoans,
    totalReserves: reserves.length,
    totalLiquidity,
    totalBorrows,
    averageUtilization,
    currency: marketData.currency,
    fees: {
      leveragedCompound: marketData.leveragedCompoundFee / 10000,
      vaultCompound: marketData.vaultCompoundFee / 10000,
    },
  };
}

interface MarketAnalytics {
  owner: PublicKey;
  flashLoansEnabled: boolean;
  totalReserves: number;
  totalLiquidity: number;
  totalBorrows: number;
  averageUtilization: number;
  currency: UniversalAssetCurrency;
  fees: {
    leveragedCompound: number;
    vaultCompound: number;
  };
}
```

#### Best Practices

**Security Considerations:**
- Use multisig wallets for market owner in production
- Carefully vet admin bot implementations
- Monitor market configuration changes
- Implement gradual parameter updates

**Operational Guidelines:**
- Start with conservative fee structures
- Enable flash loans only after thorough testing
- Monitor market utilization before parameter changes
- Maintain adequate reserves for liquidity

**Integration Patterns:**
- Cache market data for UI performance
- Subscribe to account changes for real-time updates
- Validate market parameters before operations
- Handle market configuration gracefully

---

### Reserve

The `Reserve` account represents an individual asset pool within a lending market, tracking all liquidity, borrowing, and configuration data for a specific token.

#### Structure

```rust
#[account]
pub struct Reserve {
    /// The lending market this reserve belongs to
    pub lending_market: Pubkey,
    
    /// Liquidity management data
    pub liquidity: ReserveLiquidity,
    
    /// Collateral token information
    pub collateral: ReserveCollateral,
    
    /// Configuration parameters
    pub config: ReserveConfig,
    
    /// Current interest rates
    pub current_supply_rate: Decimal,
    pub current_borrow_rate: Decimal,
    
    /// Cumulative interest rate tracking
    pub cumulative_borrow_rate_wads: Decimal,
    
    /// Last update information
    pub last_update: LastUpdate,
    
    /// Additional state data
    pub deposited_amount: u64,
    pub borrowed_amount_wads: Decimal,
    pub liquidity_mint_decimals: u8,
    
    /// Reserved space for future fields
    pub _padding: [u64; 32],
}
```

#### ReserveLiquidity Structure

```rust
pub struct ReserveLiquidity {
    /// Token mint for the reserve asset
    pub mint: Pubkey,
    
    /// Token account holding the liquidity
    pub supply: Pubkey,
    
    /// Pyth oracle product account
    pub pyth_product_key: Pubkey,
    
    /// Pyth oracle price account
    pub pyth_price_key: Pubkey,
    
    /// Available liquidity amount
    pub available_amount: u64,
    
    /// Total borrowed amount with interest
    pub borrowed_amount_wads: Decimal,
    
    /// Cumulative borrow rate
    pub cumulative_borrow_rate_wads: Decimal,
    
    /// Market value for calculations
    pub market_value: Decimal,
    
    /// Fee receiver account
    pub fee_receiver: Pubkey,
}
```

#### ReserveCollateral Structure

```rust
pub struct ReserveCollateral {
    /// Collateral token mint
    pub mint: Pubkey,
    
    /// Collateral token supply account
    pub supply: Pubkey,
    
    /// Total supply of collateral tokens
    pub mint_total_supply: u64,
}
```

#### ReserveConfig Structure

```rust
pub struct ReserveConfig {
    /// Optimal utilization rate (0-100)
    pub optimal_utilization_rate: u8,
    
    /// Loan to value ratio (0-100)
    pub loan_to_value_ratio: u8,
    
    /// Liquidation bonus percentage (0-100)
    pub liquidation_bonus: u8,
    
    /// Liquidation threshold percentage (0-100)
    pub liquidation_threshold: u8,
    
    /// Minimum borrow rate in percentage
    pub min_borrow_rate: u8,
    
    /// Optimal borrow rate in percentage
    pub optimal_borrow_rate: u8,
    
    /// Maximum borrow rate in percentage
    pub max_borrow_rate: u8,
    
    /// Fees configuration
    pub fees: ReserveFees,
    
    /// Deposit limit
    pub deposit_limit: u64,
    
    /// Borrow limit
    pub borrow_limit: u64,
    
    /// Fee receiver for this reserve
    pub fee_receiver: Pubkey,
}
```

#### ReserveFees Structure

```rust
pub struct ReserveFees {
    /// Borrow fee in WAD format (18 decimals)
    pub borrow_fee_wad: u64,
    
    /// Flash loan fee in WAD format
    pub flash_loan_fee_wad: u64,
    
    /// Host fee percentage (0-100)
    pub host_fee_percentage: u8,
}
```

#### Field Descriptions

**lending_market: Pubkey**
- Reference to the parent lending market
- Provides market-wide configuration and authority
- Used for validation and cross-reserve operations
- Immutable after reserve creation

**liquidity: ReserveLiquidity**
- Complete liquidity management data structure
- Tracks available and borrowed amounts
- Contains oracle and token account references
- Core data for lending operations

**collateral: ReserveCollateral**
- Collateral token mint and supply information
- Tracks total collateral tokens in circulation
- Used for deposit/withdrawal exchange rate calculations
- Represents depositor ownership shares

**config: ReserveConfig**
- Economic parameters for the reserve
- Interest rate model configuration
- Risk parameters (LTV, liquidation thresholds)
- Fee structures and limits

**Current Rates**
- `current_supply_rate`: Interest rate paid to depositors
- `current_borrow_rate`: Interest rate charged to borrowers
- Updated on each refresh based on utilization

**Cumulative Tracking**
- `cumulative_borrow_rate_wads`: Tracks cumulative interest over time
- Used for accurate interest calculations
- Enables compound interest accounting

#### Account Size

The `Reserve` account requires **619 bytes** of space, calculated as:
- Core reserve data: 363 bytes
- Padding for future use: 256 bytes (32 × 8 bytes)

#### Creation and Initialization

```typescript
async function createReserve(
  program: Program<BorrowLending>,
  marketOwner: Keypair,
  lendingMarket: PublicKey,
  tokenMint: PublicKey,
  initialLiquidity: number,
  config: ReserveConfig
): Promise<{ reserve: PublicKey; collateralMint: PublicKey }> {
  
  // Generate keypairs for new accounts
  const reserveKeypair = Keypair.generate();
  const collateralMintKeypair = Keypair.generate();
  
  // Create reserve account
  const reserveSpace = 619;
  const reserveLamports = await connection.getMinimumBalanceForRentExemption(reserveSpace);
  
  const createReserveInstruction = SystemProgram.createAccount({
    fromPubkey: marketOwner.publicKey,
    newAccountPubkey: reserveKeypair.publicKey,
    space: reserveSpace,
    lamports: reserveLamports,
    programId: program.programId,
  });
  
  // Create collateral mint
  const mintSpace = 82;
  const mintLamports = await connection.getMinimumBalanceForRentExemption(mintSpace);
  
  const createMintInstruction = SystemProgram.createAccount({
    fromPubkey: marketOwner.publicKey,
    newAccountPubkey: collateralMintKeypair.publicKey,
    space: mintSpace,
    lamports: mintLamports,
    programId: TOKEN_PROGRAM_ID,
  });
  
  // Initialize reserve
  const initReserveInstruction = await program.instruction.initReserve(
    initialLiquidity,
    config,
    {
      accounts: {
        // ... all required accounts
        reserve: reserveKeypair.publicKey,
        reserveCollateralMint: collateralMintKeypair.publicKey,
        // ... other accounts
      },
      signers: [marketOwner, reserveKeypair, collateralMintKeypair],
    }
  );
  
  // Execute transaction
  const transaction = new Transaction().add(
    createReserveInstruction,
    createMintInstruction,
    initReserveInstruction
  );
  
  await program.provider.send(transaction, [
    marketOwner,
    reserveKeypair,
    collateralMintKeypair,
  ]);
  
  return {
    reserve: reserveKeypair.publicKey,
    collateralMint: collateralMintKeypair.publicKey,
  };
}
```

#### Interest Rate Calculations

```typescript
function calculateInterestRates(
  reserve: Reserve,
  additionalBorrows: number = 0,
  additionalDeposits: number = 0
): { supplyRate: number; borrowRate: number; utilizationRate: number } {
  
  const totalBorrows = reserve.liquidity.borrowedAmountWads.toNumber() + additionalBorrows;
  const totalLiquidity = reserve.liquidity.availableAmount.toNumber() + additionalDeposits;
  const utilizationRate = totalBorrows / (totalBorrows + totalLiquidity);
  
  const config = reserve.config;
  const optimalUtil = config.optimal_utilization_rate / 100;
  
  let borrowRate: number;
  
  if (utilizationRate <= optimalUtil) {
    // Below optimal utilization
    const utilizationFactor = utilizationRate / optimalUtil;
    borrowRate = config.min_borrow_rate + 
                (config.optimal_borrow_rate - config.min_borrow_rate) * utilizationFactor;
  } else {
    // Above optimal utilization
    const excessUtilization = utilizationRate - optimalUtil;
    const excessFactor = excessUtilization / (1 - optimalUtil);
    borrowRate = config.optimal_borrow_rate + 
                (config.max_borrow_rate - config.optimal_borrow_rate) * excessFactor;
  }
  
  // Supply rate calculation (simplified)
  const reserveFactor = 0.1; // 10% reserve factor
  const supplyRate = borrowRate * utilizationRate * (1 - reserveFactor);
  
  return {
    supplyRate: supplyRate / 100,
    borrowRate: borrowRate / 100,
    utilizationRate,
  };
}
```

#### Exchange Rate Calculations

```typescript
function calculateExchangeRate(reserve: Reserve): number {
  const totalLiquidity = reserve.liquidity.availableAmount.toNumber() + 
                        reserve.liquidity.borrowedAmountWads.toNumber();
  const totalCollateral = reserve.collateral.mint_total_supply;
  
  if (totalCollateral === 0) {
    return 1; // Initial 1:1 exchange rate
  }
  
  return totalLiquidity / totalCollateral;
}

function calculateCollateralAmount(
  liquidityAmount: number,
  exchangeRate: number
): number {
  return liquidityAmount / exchangeRate;
}

function calculateLiquidityAmount(
  collateralAmount: number,
  exchangeRate: number
): number {
  return collateralAmount * exchangeRate;
}
```

#### Reserve Analytics

```typescript
async function analyzeReserve(
  program: Program<BorrowLending>,
  reserve: PublicKey
): Promise<ReserveAnalytics> {
  const reserveData = await program.account.reserve.fetch(reserve);
  
  // Calculate key metrics
  const totalLiquidity = reserveData.liquidity.availableAmount.toNumber() + 
                        reserveData.liquidity.borrowedAmountWads.toNumber();
  const availableLiquidity = reserveData.liquidity.availableAmount.toNumber();
  const totalBorrows = reserveData.liquidity.borrowedAmountWads.toNumber();
  const utilizationRate = totalBorrows / totalLiquidity;
  
  // Get current rates
  const rates = calculateInterestRates(reserveData);
  
  // Calculate collateral metrics
  const exchangeRate = calculateExchangeRate(reserveData);
  const totalCollateralValue = reserveData.collateral.mint_total_supply * exchangeRate;
  
  // Get price data (mock implementation)
  const price = await getTokenPrice(reserveData.liquidity.pyth_price_key);
  const totalValueLocked = totalLiquidity * price;
  
  return {
    // Basic metrics
    totalValueLocked,
    totalLiquidity,
    availableLiquidity,
    totalBorrows,
    utilizationRate,
    
    // Rates
    supplyRate: rates.supplyRate,
    borrowRate: rates.borrowRate,
    
    // Collateral
    exchangeRate,
    totalCollateralSupply: reserveData.collateral.mint_total_supply,
    totalCollateralValue,
    
    // Configuration
    loanToValueRatio: reserveData.config.loan_to_value_ratio / 100,
    liquidationThreshold: reserveData.config.liquidation_threshold / 100,
    liquidationBonus: reserveData.config.liquidation_bonus / 100,
    
    // Limits
    depositLimit: reserveData.config.deposit_limit,
    borrowLimit: reserveData.config.borrow_limit,
    
    // Health
    staleness: await calculateStaleness(reserveData),
    oracleHealth: await checkOracleHealth(reserveData.liquidity.pyth_price_key),
  };
}

interface ReserveAnalytics {
  totalValueLocked: number;
  totalLiquidity: number;
  availableLiquidity: number;
  totalBorrows: number;
  utilizationRate: number;
  supplyRate: number;
  borrowRate: number;
  exchangeRate: number;
  totalCollateralSupply: number;
  totalCollateralValue: number;
  loanToValueRatio: number;
  liquidationThreshold: number;
  liquidationBonus: number;
  depositLimit: number;
  borrowLimit: number;
  staleness: number;
  oracleHealth: boolean;
}

async function getTokenPrice(pythPriceKey: PublicKey): Promise<number> {
  // Implementation would use Pyth client
  return 1.0; // Placeholder
}

async function calculateStaleness(reserve: Reserve): Promise<number> {
  // Calculate slots since last update
  const currentSlot = await getCurrentSlot();
  return currentSlot - reserve.last_update.slot.toNumber();
}

async function checkOracleHealth(pythPriceKey: PublicKey): Promise<boolean> {
  // Implementation would check Pyth oracle health
  return true; // Placeholder
}

function getCurrentSlot(): Promise<number> {
  // Implementation would get current slot
  return Promise.resolve(0);
}
```

#### Reserve Monitoring

```typescript
class ReserveMonitor {
  constructor(
    private program: Program<BorrowLending>,
    private reserve: PublicKey,
    private alertThresholds: {
      highUtilization: number;
      lowLiquidity: number;
      staleOracle: number;
    }
  ) {}
  
  async startMonitoring() {
    setInterval(async () => {
      await this.checkReserveHealth();
    }, 30000); // Check every 30 seconds
  }
  
  private async checkReserveHealth() {
    try {
      const analytics = await analyzeReserve(this.program, this.reserve);
      
      // Check utilization
      if (analytics.utilizationRate > this.alertThresholds.highUtilization) {
        console.warn(`🔥 High utilization: ${(analytics.utilizationRate * 100).toFixed(1)}%`);
      }
      
      // Check liquidity
      if (analytics.availableLiquidity < this.alertThresholds.lowLiquidity) {
        console.warn(`💧 Low liquidity: ${analytics.availableLiquidity}`);
      }
      
      // Check oracle staleness
      if (analytics.staleness > this.alertThresholds.staleOracle) {
        console.warn(`⏰ Stale oracle: ${analytics.staleness} slots`);
      }
      
      // Check oracle health
      if (!analytics.oracleHealth) {
        console.error(`🔴 Oracle unhealthy for reserve ${this.reserve}`);
      }
      
    } catch (error) {
      console.error(`Error monitoring reserve ${this.reserve}:`, error);
    }
  }
}

// Usage
const reserveMonitor = new ReserveMonitor(
  program,
  usdcReserve,
  {
    highUtilization: 0.9,  // 90%
    lowLiquidity: 1000,    // 1000 tokens
    staleOracle: 100,      // 100 slots
  }
);

await reserveMonitor.startMonitoring();
```

#### Best Practices

**Configuration Guidelines:**
- Set conservative LTV ratios initially (60-80%)
- Use gradual liquidation thresholds (LTV + 5-10%)
- Implement reasonable liquidation bonuses (3-10%)
- Start with higher interest rates and adjust based on demand

**Operational Patterns:**
- Refresh reserves before major operations
- Monitor utilization rates for rate adjustments
- Track oracle health and price feed reliability
- Implement automated reserve health monitoring

**Integration Considerations:**
- Cache reserve data for UI performance
- Subscribe to account changes for real-time updates
- Handle rate calculations client-side for projections
- Validate reserve limits before transactions

**Security Measures:**
- Verify oracle authenticity and freshness
- Monitor for unusual utilization patterns
- Implement circuit breakers for extreme conditions
- Track large deposits/withdrawals for risk management

---

### Obligation

The `Obligation` account represents an individual borrower's position across multiple reserves, tracking all collateral deposits and outstanding loans within a lending market.

#### Structure

```rust
#[account(zero_copy)]
pub struct Obligation {
    /// Owner of the obligation
    pub owner: Pubkey,
    
    /// Lending market this obligation belongs to
    pub lending_market: Pubkey,
    
    /// Last update information
    pub last_update: LastUpdate,
    
    /// Array of reserves (deposits and borrows)
    pub reserves: [ObligationReserve; 10],
    
    /// Total market value of deposits in UAC
    pub deposited_value: SDecimal,
    
    /// Collateralized borrowed value in UAC
    pub collateralized_borrowed_value: SDecimal,
    
    /// Total borrowed value including leverage
    pub total_borrowed_value: SDecimal,
    
    /// Maximum allowed borrow value
    pub allowed_borrow_value: SDecimal,
    
    /// Unhealthy borrow value threshold
    pub unhealthy_borrow_value: SDecimal,
}
```

#### ObligationReserve Enum

```rust
#[derive(AnchorDeserialize, AnchorSerialize, Copy, Clone, Debug, PartialEq)]
pub enum ObligationReserve {
    Empty,
    Liquidity { inner: ObligationLiquidity },
    Collateral { inner: ObligationCollateral },
}
```

#### ObligationCollateral Structure

```rust
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, Eq, PartialEq, Default)]
pub struct ObligationCollateral {
    /// Reserve where collateral is deposited
    pub deposit_reserve: Pubkey,
    
    /// Amount of collateral tokens deposited
    pub deposited_amount: u64,
    
    /// Current market value in UAC
    pub market_value: SDecimal,
    
    /// Slot when deposit was made (for emissions)
    pub emissions_claimable_from_slot: u64,
}
```

#### ObligationLiquidity Structure

```rust
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, Eq, PartialEq)]
pub struct ObligationLiquidity {
    /// Reserve where liquidity is borrowed
    pub borrow_reserve: Pubkey,
    
    /// Type of loan (standard or leveraged)
    pub loan_kind: LoanKind,
    
    /// Cumulative borrow rate at loan origination
    pub cumulative_borrow_rate: SDecimal,
    
    /// Borrowed amount including accrued interest
    pub borrowed_amount: SDecimal,
    
    /// Current market value in UAC
    pub market_value: SDecimal,
    
    /// Slot when borrow was made (for emissions)
    pub emissions_claimable_from_slot: u64,
}
```

#### LoanKind Enum

```rust
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, Eq, PartialEq)]
pub enum LoanKind {
    /// Standard collateralized loan
    Standard,
    
    /// Leveraged yield farming position
    YieldFarming {
        leverage: Leverage,
    },
}
```

#### Field Descriptions

**owner: Pubkey**
- Account that controls the obligation
- Can deposit collateral, borrow funds, and manage the position
- Cannot be changed after obligation creation
- Used for authorization in all obligation operations

**lending_market: Pubkey**
- Reference to the parent lending market
- Determines which reserves can be used
- Provides market-wide configuration
- Immutable after obligation creation

**last_update: LastUpdate**
- Tracks when obligation was last refreshed
- Contains slot number for staleness checking
- Updated on every refresh operation
- Critical for accurate health calculations

**reserves: [ObligationReserve; 10]**
- Array of up to 10 reserve positions
- Can contain both collateral deposits and liquidity borrows
- Empty slots are marked as `ObligationReserve::Empty`
- Enables multi-asset positions

**Value Tracking Fields:**
- `deposited_value`: Total collateral value in Universal Asset Currency
- `collateralized_borrowed_value`: Standard loan value requiring collateral
- `total_borrowed_value`: All borrowed value including leveraged positions
- `allowed_borrow_value`: Maximum borrowing capacity based on LTV ratios
- `unhealthy_borrow_value`: Liquidation threshold value

#### Account Size

The `Obligation` account uses zero-copy serialization and requires **916 bytes** of space:
- Fixed header: 64 bytes
- Reserve array: 852 bytes (10 × 85.2 bytes per reserve)

#### Health Factor Calculation

The health factor determines the safety of an obligation:

```typescript
function calculateHealthFactor(obligation: Obligation): number {
  const totalCollateralValue = obligation.deposited_value.toNumber();
  const totalBorrowedValue = obligation.collateralized_borrowed_value.toNumber();
  
  if (totalBorrowedValue === 0) {
    return Infinity; // No debt, infinite health
  }
  
  return totalCollateralValue / totalBorrowedValue;
}

function isObligationHealthy(obligation: Obligation): boolean {
  return calculateHealthFactor(obligation) >= 1.0;
}

function getLiquidationRisk(healthFactor: number): string {
  if (healthFactor < 1.0) return "Liquidatable";
  if (healthFactor < 1.1) return "Critical";
  if (healthFactor < 1.3) return "High";
  if (healthFactor < 1.5) return "Medium";
  return "Low";
}
```

#### Position Management

```typescript
class ObligationManager {
  constructor(
    private program: Program<BorrowLending>,
    private obligation: PublicKey,
    private owner: Keypair
  ) {}
  
  async getPositionSummary(): Promise<PositionSummary> {
    const obligationData = await this.program.account.obligation.fetch(this.obligation);
    
    // Parse deposits and borrows
    const deposits = this.parseDeposits(obligationData.reserves);
    const borrows = this.parseBorrows(obligationData.reserves);
    
    // Calculate metrics
    const healthFactor = calculateHealthFactor(obligationData);
    const utilizationRate = obligationData.collateralized_borrowed_value.toNumber() / 
                           obligationData.allowed_borrow_value.toNumber();
    
    return {
      owner: obligationData.owner,
      lendingMarket: obligationData.lending_market,
      healthFactor,
      utilizationRate,
      totalCollateralValue: obligationData.deposited_value.toNumber(),
      totalBorrowedValue: obligationData.total_borrowed_value.toNumber(),
      availableBorrowValue: obligationData.allowed_borrow_value.toNumber() - 
                           obligationData.collateralized_borrowed_value.toNumber(),
      deposits,
      borrows,
      lastUpdate: obligationData.last_update,
    };
  }
  
  private parseDeposits(reserves: ObligationReserve[]): DepositPosition[] {
    return reserves
      .filter(reserve => 'Collateral' in reserve)
      .map(reserve => {
        const collateral = (reserve as any).Collateral.inner;
        return {
          reserve: collateral.deposit_reserve,
          amount: collateral.deposited_amount,
          value: collateral.market_value.toNumber(),
          emissionsSlot: collateral.emissions_claimable_from_slot,
        };
      });
  }
  
  private parseBorrows(reserves: ObligationReserve[]): BorrowPosition[] {
    return reserves
      .filter(reserve => 'Liquidity' in reserve)
      .map(reserve => {
        const liquidity = (reserve as any).Liquidity.inner;
        return {
          reserve: liquidity.borrow_reserve,
          amount: liquidity.borrowed_amount.toNumber(),
          value: liquidity.market_value.toNumber(),
          loanKind: liquidity.loan_kind,
          cumulativeRate: liquidity.cumulative_borrow_rate.toNumber(),
          emissionsSlot: liquidity.emissions_claimable_from_slot,
        };
      });
  }
  
  async addCollateral(
    reserve: PublicKey,
    amount: number
  ): Promise<string> {
    // Implementation would call deposit_obligation_collateral
    return "signature";
  }
  
  async borrowLiquidity(
    reserve: PublicKey,
    amount: number,
    loanKind: LoanKind = { standard: {} }
  ): Promise<string> {
    // Implementation would call borrow_obligation_liquidity
    return "signature";
  }
  
  async repayDebt(
    reserve: PublicKey,
    amount: number,
    loanKind: LoanKind = { standard: {} }
  ): Promise<string> {
    // Implementation would call repay_obligation_liquidity
    return "signature";
  }
  
  async withdrawCollateral(
    reserve: PublicKey,
    amount: number
  ): Promise<string> {
    // Implementation would call withdraw_obligation_collateral
    return "signature";
  }
}

interface PositionSummary {
  owner: PublicKey;
  lendingMarket: PublicKey;
  healthFactor: number;
  utilizationRate: number;
  totalCollateralValue: number;
  totalBorrowedValue: number;
  availableBorrowValue: number;
  deposits: DepositPosition[];
  borrows: BorrowPosition[];
  lastUpdate: LastUpdate;
}

interface DepositPosition {
  reserve: PublicKey;
  amount: number;
  value: number;
  emissionsSlot: number;
}

interface BorrowPosition {
  reserve: PublicKey;
  amount: number;
  value: number;
  loanKind: LoanKind;
  cumulativeRate: number;
  emissionsSlot: number;
}
```

#### Risk Management

```typescript
class ObligationRiskManager {
  constructor(
    private obligationManager: ObligationManager,
    private riskParameters: RiskParameters
  ) {}
  
  async assessRisk(): Promise<RiskAssessment> {
    const position = await this.obligationManager.getPositionSummary();
    
    const risks: Risk[] = [];
    const recommendations: string[] = [];
    
    // Health factor risk
    if (position.healthFactor < this.riskParameters.minHealthFactor) {
      risks.push({
        type: 'HealthFactor',
        severity: position.healthFactor < 1.1 ? 'Critical' : 'High',
        description: `Health factor ${position.healthFactor.toFixed(3)} is below safe threshold`,
      });
      recommendations.push('Add more collateral or repay debt to improve health factor');
    }
    
    // Concentration risk
    const concentrationRisk = this.assessConcentrationRisk(position);
    if (concentrationRisk.severity !== 'Low') {
      risks.push(concentrationRisk);
      recommendations.push('Diversify collateral across multiple assets');
    }
    
    // Leverage risk
    const leverageRisk = this.assessLeverageRisk(position);
    if (leverageRisk.severity !== 'Low') {
      risks.push(leverageRisk);
      recommendations.push('Consider reducing leverage exposure');
    }
    
    // Interest rate risk
    const interestRisk = await this.assessInterestRateRisk(position);
    if (interestRisk.severity !== 'Low') {
      risks.push(interestRisk);
      recommendations.push('Monitor interest rate changes and consider fixed-rate alternatives');
    }
    
    return {
      overallRisk: this.calculateOverallRisk(risks),
      risks,
      recommendations,
      healthScore: this.calculateHealthScore(position),
    };
  }
  
  private assessConcentrationRisk(position: PositionSummary): Risk {
    // Check if position is too concentrated in single asset
    const maxCollateralRatio = Math.max(
      ...position.deposits.map(d => d.value / position.totalCollateralValue)
    );
    
    if (maxCollateralRatio > 0.8) {
      return {
        type: 'Concentration',
        severity: 'High',
        description: `${(maxCollateralRatio * 100).toFixed(1)}% of collateral in single asset`,
      };
    } else if (maxCollateralRatio > 0.6) {
      return {
        type: 'Concentration',
        severity: 'Medium',
        description: `${(maxCollateralRatio * 100).toFixed(1)}% of collateral in single asset`,
      };
    }
    
    return {
      type: 'Concentration',
      severity: 'Low',
      description: 'Well-diversified collateral',
    };
  }
  
  private assessLeverageRisk(position: PositionSummary): Risk {
    const leverageRatio = position.totalBorrowedValue / position.totalCollateralValue;
    
    if (leverageRatio > 0.8) {
      return {
        type: 'Leverage',
        severity: 'High',
        description: `High leverage ratio: ${leverageRatio.toFixed(2)}x`,
      };
    } else if (leverageRatio > 0.6) {
      return {
        type: 'Leverage',
        severity: 'Medium',
        description: `Moderate leverage ratio: ${leverageRatio.toFixed(2)}x`,
      };
    }
    
    return {
      type: 'Leverage',
      severity: 'Low',
      description: `Conservative leverage ratio: ${leverageRatio.toFixed(2)}x`,
    };
  }
  
  private async assessInterestRateRisk(position: PositionSummary): Promise<Risk> {
    // Calculate weighted average borrow rate
    let totalBorrowValue = 0;
    let weightedRate = 0;
    
    for (const borrow of position.borrows) {
      // Would fetch current rate from reserve
      const currentRate = 0.08; // 8% placeholder
      totalBorrowValue += borrow.value;
      weightedRate += currentRate * borrow.value;
    }
    
    const avgRate = weightedRate / totalBorrowValue;
    
    if (avgRate > 0.15) {
      return {
        type: 'InterestRate',
        severity: 'High',
        description: `High average borrow rate: ${(avgRate * 100).toFixed(1)}%`,
      };
    } else if (avgRate > 0.1) {
      return {
        type: 'InterestRate',
        severity: 'Medium',
        description: `Moderate average borrow rate: ${(avgRate * 100).toFixed(1)}%`,
      };
    }
    
    return {
      type: 'InterestRate',
      severity: 'Low',
      description: `Low average borrow rate: ${(avgRate * 100).toFixed(1)}%`,
    };
  }
  
  private calculateOverallRisk(risks: Risk[]): string {
    const criticalCount = risks.filter(r => r.severity === 'Critical').length;
    const highCount = risks.filter(r => r.severity === 'High').length;
    
    if (criticalCount > 0) return 'Critical';
    if (highCount > 1) return 'High';
    if (highCount > 0) return 'Medium';
    return 'Low';
  }
  
  private calculateHealthScore(position: PositionSummary): number {
    // 0-100 score based on multiple factors
    let score = 100;
    
    // Health factor component (40% of score)
    const healthFactor = Math.min(position.healthFactor, 3);
    score *= 0.6 + 0.4 * (healthFactor / 3);
    
    // Diversification component (30% of score)
    const diversificationScore = this.calculateDiversificationScore(position);
    score *= 0.7 + 0.3 * diversificationScore;
    
    // Utilization component (30% of score)
    const utilizationPenalty = Math.min(position.utilizationRate, 1) * 0.3;
    score *= (1 - utilizationPenalty);
    
    return Math.round(score);
  }
  
  private calculateDiversificationScore(position: PositionSummary): number {
    if (position.deposits.length <= 1) return 0;
    
    // Calculate Herfindahl index for diversification
    const totalValue = position.totalCollateralValue;
    const herfindahl = position.deposits.reduce((sum, deposit) => {
      const share = deposit.value / totalValue;
      return sum + share * share;
    }, 0);
    
    // Convert to diversification score (0-1)
    const maxHerfindahl = 1; // Complete concentration
    const minHerfindahl = 1 / position.deposits.length; // Perfect diversification
    
    return (maxHerfindahl - herfindahl) / (maxHerfindahl - minHerfindahl);
  }
}

interface RiskParameters {
  minHealthFactor: number;
  maxConcentration: number;
  maxLeverageRatio: number;
  maxInterestRate: number;
}

interface Risk {
  type: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  description: string;
}

interface RiskAssessment {
  overallRisk: string;
  risks: Risk[];
  recommendations: string[];
  healthScore: number;
}

// Usage
const obligationManager = new ObligationManager(program, obligationAddress, userKeypair);
const riskManager = new ObligationRiskManager(obligationManager, {
  minHealthFactor: 1.3,
  maxConcentration: 0.7,
  maxLeverageRatio: 0.8,
  maxInterestRate: 0.12,
});

const riskAssessment = await riskManager.assessRisk();
console.log(`Overall risk: ${riskAssessment.overallRisk}`);
console.log(`Health score: ${riskAssessment.healthScore}/100`);
```

#### Leveraged Positions

```typescript
class LeveragedPositionManager extends ObligationManager {
  async createLeveragedPosition(
    collateralReserve: PublicKey,
    borrowReserve: PublicKey,
    collateralAmount: number,
    leverage: number,
    ammPool: PublicKey
  ): Promise<string> {
    // 1. Deposit initial collateral
    await this.addCollateral(collateralReserve, collateralAmount);
    
    // 2. Calculate borrow amount for desired leverage
    const borrowAmount = collateralAmount * (leverage - 1);
    
    // 3. Borrow additional funds
    await this.borrowLiquidity(
      borrowReserve, 
      borrowAmount, 
      { yieldFarming: { leverage: { value: leverage } } }
    );
    
    // 4. Add liquidity to AMM (would require AMM integration)
    const ammSignature = await this.addLiquidityToAmm(
      ammPool,
      collateralAmount + borrowAmount
    );
    
    return ammSignature;
  }
  
  async closeLeveragedPosition(
    ammPool: PublicKey,
    borrowReserve: PublicKey
  ): Promise<string> {
    // 1. Remove liquidity from AMM
    await this.removeLiquidityFromAmm(ammPool);
    
    // 2. Repay borrowed amount
    const position = await this.getPositionSummary();
    const leveragedBorrow = position.borrows.find(
      b => 'yieldFarming' in b.loanKind
    );
    
    if (leveragedBorrow) {
      await this.repayDebt(
        leveragedBorrow.reserve,
        leveragedBorrow.amount,
        leveragedBorrow.loanKind
      );
    }
    
    // 3. Withdraw remaining collateral
    return "signature";
  }
  
  private async addLiquidityToAmm(pool: PublicKey, amount: number): Promise<string> {
    // Integration with Aldrin AMM
    return "signature";
  }
  
  private async removeLiquidityFromAmm(pool: PublicKey): Promise<string> {
    // Integration with Aldrin AMM
    return "signature";
  }
}
```

#### Obligation Analytics

```typescript
async function analyzeObligationPerformance(
  program: Program<BorrowLending>,
  obligation: PublicKey,
  historicalData: HistoricalPosition[]
): Promise<PerformanceAnalytics> {
  const currentPosition = await new ObligationManager(
    program, 
    obligation, 
    null as any
  ).getPositionSummary();
  
  // Calculate performance metrics
  const initialValue = historicalData[0]?.totalCollateralValue || 0;
  const currentValue = currentPosition.totalCollateralValue;
  const totalReturn = (currentValue - initialValue) / initialValue;
  
  // Calculate interest costs and yield earned
  const interestPaid = calculateInterestPaid(historicalData);
  const yieldEarned = calculateYieldEarned(historicalData);
  const netYield = yieldEarned - interestPaid;
  
  // Risk-adjusted returns
  const volatility = calculateVolatility(historicalData);
  const sharpeRatio = netYield / volatility;
  
  // Health factor analysis
  const healthFactorHistory = historicalData.map(h => h.healthFactor);
  const minHealthFactor = Math.min(...healthFactorHistory);
  const avgHealthFactor = healthFactorHistory.reduce((a, b) => a + b, 0) / healthFactorHistory.length;
  
  return {
    totalReturn,
    netYield,
    interestPaid,
    yieldEarned,
    sharpeRatio,
    volatility,
    minHealthFactor,
    avgHealthFactor,
    currentHealthFactor: currentPosition.healthFactor,
    liquidationEvents: countLiquidationEvents(historicalData),
    maxDrawdown: calculateMaxDrawdown(historicalData),
  };
}

interface HistoricalPosition {
  timestamp: number;
  totalCollateralValue: number;
  totalBorrowedValue: number;
  healthFactor: number;
  interestPaid: number;
  yieldEarned: number;
}

interface PerformanceAnalytics {
  totalReturn: number;
  netYield: number;
  interestPaid: number;
  yieldEarned: number;
  sharpeRatio: number;
  volatility: number;
  minHealthFactor: number;
  avgHealthFactor: number;
  currentHealthFactor: number;
  liquidationEvents: number;
  maxDrawdown: number;
}

function calculateInterestPaid(history: HistoricalPosition[]): number {
  return history.reduce((sum, pos) => sum + pos.interestPaid, 0);
}

function calculateYieldEarned(history: HistoricalPosition[]): number {
  return history.reduce((sum, pos) => sum + pos.yieldEarned, 0);
}

function calculateVolatility(history: HistoricalPosition[]): number {
  const returns = [];
  for (let i = 1; i < history.length; i++) {
    const prevValue = history[i - 1].totalCollateralValue;
    const currentValue = history[i].totalCollateralValue;
    returns.push((currentValue - prevValue) / prevValue);
  }
  
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length;
  
  return Math.sqrt(variance);
}

function countLiquidationEvents(history: HistoricalPosition[]): number {
  return history.filter(pos => pos.healthFactor < 1.0).length;
}

function calculateMaxDrawdown(history: HistoricalPosition[]): number {
  let maxValue = 0;
  let maxDrawdown = 0;
  
  for (const pos of history) {
    maxValue = Math.max(maxValue, pos.totalCollateralValue);
    const drawdown = (maxValue - pos.totalCollateralValue) / maxValue;
    maxDrawdown = Math.max(maxDrawdown, drawdown);
  }
  
  return maxDrawdown;
}
```

#### Best Practices

**Position Management:**
- Maintain health factor above 1.3 for safety buffer
- Diversify collateral across multiple assets
- Monitor interest rate changes and impact on costs
- Use stop-loss strategies for leveraged positions

**Risk Management:**
- Set up automated health factor monitoring
- Implement gradual position building and unwinding
- Consider correlation between collateral and borrowed assets
- Plan for market stress scenarios

**Operational Guidelines:**
- Refresh obligations before major operations
- Use batch transactions for complex position changes
- Monitor gas costs for frequent position adjustments
- Keep detailed records for tax and performance tracking

**Integration Patterns:**
- Subscribe to obligation account changes for real-time updates
- Cache obligation data for UI performance
- Implement retry logic for failed transactions
- Provide clear position visualizations for users

---

## Data Structures

The protocol uses sophisticated data structures to manage financial calculations, state tracking, and configuration parameters.

### Mathematical Types

#### Decimal

The `Decimal` type provides high-precision arithmetic for financial calculations:

```rust
pub struct Decimal {
    pub value: u128,
}

impl Decimal {
    pub const DECIMALS: u8 = 18;
    pub const WAD: u128 = 1_000_000_000_000_000_000; // 10^18
    
    pub fn zero() -> Self {
        Self { value: 0 }
    }
    
    pub fn one() -> Self {
        Self { value: Self::WAD }
    }
    
    pub fn from_scaled_val(scaled_val: u128) -> Self {
        Self { value: scaled_val }
    }
    
    pub fn to_scaled_val(&self) -> u128 {
        self.value
    }
}
```

**Usage Examples:**
```typescript
// TypeScript wrapper for Decimal operations
class DecimalMath {
  static readonly WAD = BigInt("1000000000000000000"); // 10^18
  
  static fromNumber(num: number): BigInt {
    return BigInt(Math.floor(num * Number(this.WAD)));
  }
  
  static toNumber(decimal: BigInt): number {
    return Number(decimal) / Number(this.WAD);
  }
  
  static add(a: BigInt, b: BigInt): BigInt {
    return a + b;
  }
  
  static subtract(a: BigInt, b: BigInt): BigInt {
    return a - b;
  }
  
  static multiply(a: BigInt, b: BigInt): BigInt {
    return (a * b) / this.WAD;
  }
  
  static divide(a: BigInt, b: BigInt): BigInt {
    return (a * this.WAD) / b;
  }
  
  static percentage(amount: BigInt, percent: number): BigInt {
    const percentDecimal = this.fromNumber(percent / 100);
    return this.multiply(amount, percentDecimal);
  }
}

// Example usage
const amount = DecimalMath.fromNumber(1000); // 1000 tokens
const feeRate = DecimalMath.fromNumber(0.005); // 0.5%
const fee = DecimalMath.multiply(amount, feeRate);
console.log(`Fee: ${DecimalMath.toNumber(fee)} tokens`);
```

#### SDecimal (Signed Decimal)

Extended decimal type supporting negative values:

```rust
pub struct SDecimal {
    pub value: i128,
}

impl SDecimal {
    pub const DECIMALS: u8 = 18;
    pub const WAD: i128 = 1_000_000_000_000_000_000; // 10^18
    
    pub fn zero() -> Self {
        Self { value: 0 }
    }
    
    pub fn from_decimal(decimal: Decimal) -> Self {
        Self { value: decimal.value as i128 }
    }
    
    pub fn is_negative(&self) -> bool {
        self.value < 0
    }
    
    pub fn abs(&self) -> Self {
        Self { value: self.value.abs() }
    }
}
```

**Financial Calculations:**
```typescript
class FinancialMath {
  // Calculate compound interest
  static compoundInterest(
    principal: BigInt,
    rate: BigInt,
    periods: number
  ): BigInt {
    let result = principal;
    const oneWad = DecimalMath.WAD;
    
    for (let i = 0; i < periods; i++) {
      result = DecimalMath.multiply(result, oneWad + rate);
    }
    
    return result;
  }
  
  // Calculate net present value
  static netPresentValue(
    cashFlows: BigInt[],
    discountRate: BigInt
  ): BigInt {
    let npv = BigInt(0);
    const oneWad = DecimalMath.WAD;
    
    for (let i = 0; i < cashFlows.length; i++) {
      const discountFactor = DecimalMath.divide(
        oneWad,
        this.compoundInterest(oneWad, discountRate, i + 1)
      );
      npv = DecimalMath.add(
        npv,
        DecimalMath.multiply(cashFlows[i], discountFactor)
      );
    }
    
    return npv;
  }
  
  // Calculate loan payment amount
  static loanPayment(
    principal: BigInt,
    rate: BigInt,
    periods: number
  ): BigInt {
    if (rate === BigInt(0)) {
      return DecimalMath.divide(principal, BigInt(periods));
    }
    
    const onePlusRate = DecimalMath.WAD + rate;
    const numerator = DecimalMath.multiply(
      principal,
      rate
    );
    
    const denominator = DecimalMath.WAD - DecimalMath.divide(
      DecimalMath.WAD,
      this.compoundInterest(onePlusRate, rate, periods)
    );
    
    return DecimalMath.divide(numerator, denominator);
  }
}
```

#### PercentageInt

Integer-based percentage representation:

```rust
pub struct PercentageInt {
    pub value: u16,
}

impl PercentageInt {
    pub const BASIS_POINTS_SCALE: u16 = 10000; // 100% = 10000 basis points
    
    pub fn new(basis_points: u16) -> Self {
        assert!(basis_points <= Self::BASIS_POINTS_SCALE);
        Self { value: basis_points }
    }
    
    pub fn from_percent(percent: f64) -> Self {
        let basis_points = (percent * 100.0) as u16;
        Self::new(basis_points)
    }
    
    pub fn to_decimal(&self) -> Decimal {
        Decimal::from_scaled_val(
            (self.value as u128) * Decimal::WAD / (Self::BASIS_POINTS_SCALE as u128)
        )
    }
}
```

**Usage in Configuration:**
```typescript
class PercentageConverter {
  static readonly BASIS_POINTS_SCALE = 10000;
  
  static fromPercent(percent: number): number {
    return Math.round(percent * 100); // Convert to basis points
  }
  
  static toPercent(basisPoints: number): number {
    return basisPoints / 100;
  }
  
  static toDecimal(basisPoints: number): BigInt {
    return BigInt(basisPoints) * DecimalMath.WAD / BigInt(this.BASIS_POINTS_SCALE);
  }
  
  // Validate percentage range
  static validate(basisPoints: number): boolean {
    return basisPoints >= 0 && basisPoints <= this.BASIS_POINTS_SCALE;
  }
}

// Configuration examples
const configs = {
  // Interest rates
  minBorrowRate: PercentageConverter.fromPercent(1.0),    // 1%
  optimalBorrowRate: PercentageConverter.fromPercent(8.0), // 8%
  maxBorrowRate: PercentageConverter.fromPercent(25.0),   // 25%
  
  // Risk parameters
  loanToValueRatio: PercentageConverter.fromPercent(75.0),      // 75%
  liquidationThreshold: PercentageConverter.fromPercent(80.0),  // 80%
  liquidationBonus: PercentageConverter.fromPercent(5.0),      // 5%
  
  // Fees
  borrowFee: PercentageConverter.fromPercent(0.5),      // 0.5%
  flashLoanFee: PercentageConverter.fromPercent(0.3),  // 0.3%
  hostFeeShare: PercentageConverter.fromPercent(20.0), // 20%
};
```

### Rate Models

#### Interest Rate Model

The protocol implements a kinked interest rate model:

```rust
pub struct InterestRateModel {
    pub optimal_utilization_rate: PercentageInt,
    pub min_borrow_rate: PercentageInt,
    pub optimal_borrow_rate: PercentageInt,
    pub max_borrow_rate: PercentageInt,
}

impl InterestRateModel {
    pub fn calculate_borrow_rate(&self, utilization_rate: Decimal) -> Decimal {
        let optimal_util = self.optimal_utilization_rate.to_decimal();
        
        if utilization_rate <= optimal_util {
            // Below optimal: linear interpolation
            let utilization_factor = utilization_rate / optimal_util;
            let rate_range = self.optimal_borrow_rate.to_decimal() - 
                           self.min_borrow_rate.to_decimal();
            
            self.min_borrow_rate.to_decimal() + (rate_range * utilization_factor)
        } else {
            // Above optimal: steeper slope
            let excess_utilization = utilization_rate - optimal_util;
            let excess_factor = excess_utilization / (Decimal::one() - optimal_util);
            let rate_range = self.max_borrow_rate.to_decimal() - 
                           self.optimal_borrow_rate.to_decimal();
            
            self.optimal_borrow_rate.to_decimal() + (rate_range * excess_factor)
        }
    }
    
    pub fn calculate_supply_rate(
        &self,
        utilization_rate: Decimal,
        borrow_rate: Decimal,
        reserve_factor: Decimal,
    ) -> Decimal {
        borrow_rate * utilization_rate * (Decimal::one() - reserve_factor)
    }
}
```

**Rate Model Analysis:**
```typescript
class InterestRateAnalyzer {
  constructor(
    private optimalUtilization: number,
    private minRate: number,
    private optimalRate: number,
    private maxRate: number
  ) {}
  
  calculateRates(utilization: number): { borrowRate: number; supplyRate: number } {
    let borrowRate: number;
    
    if (utilization <= this.optimalUtilization) {
      // Below optimal utilization
      const factor = utilization / this.optimalUtilization;
      borrowRate = this.minRate + (this.optimalRate - this.minRate) * factor;
    } else {
      // Above optimal utilization
      const excessUtilization = utilization - this.optimalUtilization;
      const excessFactor = excessUtilization / (1 - this.optimalUtilization);
      borrowRate = this.optimalRate + (this.maxRate - this.optimalRate) * excessFactor;
    }
    
    // Supply rate calculation (assuming 10% reserve factor)
    const reserveFactor = 0.1;
    const supplyRate = borrowRate * utilization * (1 - reserveFactor);
    
    return { borrowRate, supplyRate };
  }
  
  findOptimalUtilization(): number {
    return this.optimalUtilization;
  }
  
  calculateSpread(utilization: number): number {
    const rates = this.calculateRates(utilization);
    return rates.borrowRate - rates.supplyRate;
  }
  
  // Generate rate curve data for visualization
  generateRateCurve(points: number = 100): Array<{
    utilization: number;
    borrowRate: number;
    supplyRate: number;
    spread: number;
  }> {
    const curve = [];
    
    for (let i = 0; i <= points; i++) {
      const utilization = i / points;
      const rates = this.calculateRates(utilization);
      const spread = this.calculateSpread(utilization);
      
      curve.push({
        utilization,
        borrowRate: rates.borrowRate,
        supplyRate: rates.supplyRate,
        spread,
      });
    }
    
    return curve;
  }
}

// Example: USDC rate model
const usdcRateModel = new InterestRateAnalyzer(
  0.8,   // 80% optimal utilization
  0.02,  // 2% minimum rate
  0.08,  // 8% optimal rate
  0.25   // 25% maximum rate
);

// Generate rate curve for charts
const rateCurve = usdcRateModel.generateRateCurve();
console.log("Rates at 90% utilization:", usdcRateModel.calculateRates(0.9));
```

#### Risk Model

Risk calculation framework:

```rust
pub struct RiskModel {
    pub loan_to_value_ratio: PercentageInt,
    pub liquidation_threshold: PercentageInt,
    pub liquidation_bonus: PercentageInt,
    pub debt_ceiling: u64,
    pub isolation_mode: bool,
}

impl RiskModel {
    pub fn calculate_max_borrow_value(
        &self,
        collateral_value: Decimal,
    ) -> Decimal {
        collateral_value * self.loan_to_value_ratio.to_decimal()
    }
    
    pub fn calculate_liquidation_threshold_value(
        &self,
        collateral_value: Decimal,
    ) -> Decimal {
        collateral_value * self.liquidation_threshold.to_decimal()
    }
    
    pub fn is_liquidatable(
        &self,
        collateral_value: Decimal,
        borrowed_value: Decimal,
    ) -> bool {
        let threshold_value = self.calculate_liquidation_threshold_value(collateral_value);
        borrowed_value > threshold_value
    }
}
```

**Risk Calculation Engine:**
```typescript
class RiskCalculator {
  constructor(
    private ltvRatio: number,
    private liquidationThreshold: number,
    private liquidationBonus: number
  ) {}
  
  calculateHealthFactor(
    collateralValue: number,
    borrowedValue: number
  ): number {
    if (borrowedValue === 0) return Infinity;
    
    const adjustedCollateralValue = collateralValue * this.liquidationThreshold;
    return adjustedCollateralValue / borrowedValue;
  }
  
  calculateMaxBorrowAmount(collateralValue: number): number {
    return collateralValue * this.ltvRatio;
  }
  
  calculateLiquidationPrice(
    collateralAmount: number,
    borrowedValue: number,
    currentPrice: number
  ): number {
    // Price at which position becomes liquidatable
    const requiredCollateralValue = borrowedValue / this.liquidationThreshold;
    return requiredCollateralValue / collateralAmount;
  }
  
  calculateLiquidationIncentive(
    liquidatedCollateralValue: number
  ): number {
    return liquidatedCollateralValue * this.liquidationBonus;
  }
  
  assessRiskLevel(healthFactor: number): {
    level: string;
    description: string;
    recommendations: string[];
  } {
    if (healthFactor < 1.0) {
      return {
        level: "Liquidatable",
        description: "Position is subject to liquidation",
        recommendations: [
          "Add collateral immediately",
          "Repay debt to improve health factor",
          "Close position if necessary"
        ]
      };
    } else if (healthFactor < 1.1) {
      return {
        level: "Critical",
        description: "Very high risk of liquidation",
        recommendations: [
          "Add significant collateral",
          "Repay substantial portion of debt",
          "Monitor position closely"
        ]
      };
    } else if (healthFactor < 1.3) {
      return {
        level: "High",
        description: "High risk of liquidation",
        recommendations: [
          "Consider adding collateral",
          "Reduce debt exposure",
          "Set up monitoring alerts"
        ]
      };
    } else if (healthFactor < 1.5) {
      return {
        level: "Medium",
        description: "Moderate risk",
        recommendations: [
          "Monitor market conditions",
          "Consider position size",
          "Maintain safety buffer"
        ]
      };
    } else {
      return {
        level: "Low",
        description: "Low risk position",
        recommendations: [
          "Position is well-collateralized",
          "Continue monitoring",
          "Consider optimizing yield"
        ]
      };
    }
  }
  
  // Calculate Value at Risk (VaR)
  calculateVaR(
    portfolioValue: number,
    volatility: number,
    confidence: number = 0.95,
    timeHorizon: number = 1 // days
  ): number {
    // Simplified VaR calculation using normal distribution
    const zScore = this.getZScore(confidence);
    const adjustedVolatility = volatility * Math.sqrt(timeHorizon);
    
    return portfolioValue * zScore * adjustedVolatility;
  }
  
  private getZScore(confidence: number): number {
    // Approximate z-scores for common confidence levels
    const zScores: { [key: number]: number } = {
      0.90: 1.28,
      0.95: 1.645,
      0.99: 2.326,
    };
    
    return zScores[confidence] || 1.645; // Default to 95%
  }
  
  // Stress test scenarios
  stressTest(
    collateralValue: number,
    borrowedValue: number,
    priceShocks: number[]
  ): Array<{
    priceShock: number;
    newCollateralValue: number;
    healthFactor: number;
    liquidatable: boolean;
  }> {
    return priceShocks.map(shock => {
      const newCollateralValue = collateralValue * (1 + shock);
      const healthFactor = this.calculateHealthFactor(newCollateralValue, borrowedValue);
      
      return {
        priceShock: shock,
        newCollateralValue,
        healthFactor,
        liquidatable: healthFactor < 1.0,
      };
    });
  }
}

// Usage examples
const riskCalc = new RiskCalculator(0.75, 0.8, 0.05);

// Calculate health factor
const healthFactor = riskCalc.calculateHealthFactor(10000, 7500);
console.log(`Health factor: ${healthFactor.toFixed(3)}`);

// Assess risk
const riskAssessment = riskCalc.assessRiskLevel(healthFactor);
console.log(`Risk level: ${riskAssessment.level}`);

// Stress test
const stressResults = riskCalc.stressTest(
  10000, // $10k collateral
  7500,  // $7.5k borrowed
  [-0.1, -0.2, -0.3, -0.4, -0.5] // Price shock scenarios
);

stressResults.forEach(result => {
  console.log(
    `${(result.priceShock * 100).toFixed(0)}% shock: ` +
    `HF=${result.healthFactor.toFixed(2)}, ` +
    `Liquidatable=${result.liquidatable}`
  );
});
```

### Fee Structures

#### Comprehensive Fee Model

```rust
pub struct FeeStructure {
    pub borrow_fee_wad: u64,
    pub flash_loan_fee_wad: u64,
    pub liquidation_fee_wad: u64,
    pub protocol_take_rate_wad: u64,
    pub insurance_fee_wad: u64,
    pub host_fee_percentage: u8,
}

impl FeeStructure {
    pub fn calculate_borrow_fee(&self, borrow_amount: u64) -> u64 {
        (borrow_amount as u128 * self.borrow_fee_wad as u128 / Decimal::WAD) as u64
    }
    
    pub fn calculate_flash_loan_fee(&self, loan_amount: u64) -> u64 {
        (loan_amount as u128 * self.flash_loan_fee_wad as u128 / Decimal::WAD) as u64
    }
    
    pub fn distribute_fees(&self, total_fee: u64) -> FeeDistribution {
        let host_fee = total_fee * self.host_fee_percentage as u64 / 100;
        let protocol_fee = total_fee - host_fee;
        
        FeeDistribution {
            protocol_fee,
            host_fee,
            insurance_fee: protocol_fee * self.insurance_fee_wad as u64 / Decimal::WAD as u64,
        }
    }
}

pub struct FeeDistribution {
    pub protocol_fee: u64,
    pub host_fee: u64,
    pub insurance_fee: u64,
}
```

**Fee Management System:**
```typescript
class FeeManager {
  constructor(
    private borrowFeeWad: BigInt,
    private flashLoanFeeWad: BigInt,
    private protocolTakeRate: BigInt,
    private hostFeePercentage: number
  ) {}
  
  calculateBorrowFees(amount: BigInt): {
    principalFee: BigInt;
    totalWithFee: BigInt;
    feeDistribution: FeeDistribution;
  } {
    const principalFee = DecimalMath.multiply(amount, this.borrowFeeWad);
    const totalWithFee = DecimalMath.add(amount, principalFee);
    const feeDistribution = this.distributeFees(principalFee);
    
    return {
      principalFee,
      totalWithFee,
      feeDistribution,
    };
  }
  
  calculateFlashLoanFees(amount: BigInt): {
    flashLoanFee: BigInt;
    totalRepayment: BigInt;
    feeDistribution: FeeDistribution;
  } {
    const flashLoanFee = DecimalMath.multiply(amount, this.flashLoanFeeWad);
    const totalRepayment = DecimalMath.add(amount, flashLoanFee);
    const feeDistribution = this.distributeFees(flashLoanFee);
    
    return {
      flashLoanFee,
      totalRepayment,
      feeDistribution,
    };
  }
  
  calculateLiquidationFees(liquidatedValue: BigInt, liquidationBonus: BigInt): {
    liquidatorReward: BigInt;
    protocolFee: BigInt;
    totalSeized: BigInt;
  } {
    const liquidatorReward = DecimalMath.multiply(liquidatedValue, liquidationBonus);
    const protocolFeeRate = DecimalMath.fromNumber(0.005); // 0.5%
    const protocolFee = DecimalMath.multiply(liquidatedValue, protocolFeeRate);
    const totalSeized = DecimalMath.add(liquidatedValue, liquidatorReward);
    
    return {
      liquidatorReward,
      protocolFee,
      totalSeized,
    };
  }
  
  private distributeFees(totalFee: BigInt): FeeDistribution {
    const hostFeeRate = DecimalMath.fromNumber(this.hostFeePercentage / 100);
    const hostFee = DecimalMath.multiply(totalFee, hostFeeRate);
    const protocolFee = DecimalMath.subtract(totalFee, hostFee);
    
    // Insurance fund gets 10% of protocol fees
    const insuranceFeeRate = DecimalMath.fromNumber(0.1);
    const insuranceFee = DecimalMath.multiply(protocolFee, insuranceFeeRate);
    const netProtocolFee = DecimalMath.subtract(protocolFee, insuranceFee);
    
    return {
      protocolFee: netProtocolFee,
      hostFee,
      insuranceFee,
      totalFee,
    };
  }
  
  // Calculate annualized fee rates
  calculateAnnualizedFees(
    borrowAmount: BigInt,
    borrowDurationDays: number
  ): {
    dailyFeeRate: number;
    annualizedFeeRate: number;
    totalFeesAnnualized: BigInt;
  } {
    const fees = this.calculateBorrowFees(borrowAmount);
    const feeRate = Number(fees.principalFee) / Number(borrowAmount);
    
    // Assuming fee is charged upfront for the duration
    const dailyFeeRate = feeRate / borrowDurationDays;
    const annualizedFeeRate = dailyFeeRate * 365;
    const totalFeesAnnualized = DecimalMath.multiply(
      borrowAmount,
      DecimalMath.fromNumber(annualizedFeeRate)
    );
    
    return {
      dailyFeeRate,
      annualizedFeeRate,
      totalFeesAnnualized,
    };
  }
  
  // Fee comparison across different scenarios
  compareFeeStructures(
    amount: BigInt,
    scenarios: FeeScenario[]
  ): FeeComparison[] {
    return scenarios.map(scenario => {
      const feeManager = new FeeManager(
        scenario.borrowFeeWad,
        scenario.flashLoanFeeWad,
        scenario.protocolTakeRate,
        scenario.hostFeePercentage
      );
      
      const borrowFees = feeManager.calculateBorrowFees(amount);
      const flashLoanFees = feeManager.calculateFlashLoanFees(amount);
      
      return {
        scenario: scenario.name,
        borrowFee: borrowFees.principalFee,
        flashLoanFee: flashLoanFees.flashLoanFee,
        protocolRevenue: DecimalMath.add(
          borrowFees.feeDistribution.protocolFee,
          flashLoanFees.feeDistribution.protocolFee
        ),
        userCost: DecimalMath.add(
          borrowFees.principalFee,
          flashLoanFees.flashLoanFee
        ),
      };
    });
  }
}

interface FeeDistribution {
  protocolFee: BigInt;
  hostFee: BigInt;
  insuranceFee: BigInt;
  totalFee: BigInt;
}

interface FeeScenario {
  name: string;
  borrowFeeWad: BigInt;
  flashLoanFeeWad: BigInt;
  protocolTakeRate: BigInt;
  hostFeePercentage: number;
}

interface FeeComparison {
  scenario: string;
  borrowFee: BigInt;
  flashLoanFee: BigInt;
  protocolRevenue: BigInt;
  userCost: BigInt;
}

// Usage examples
const feeManager = new FeeManager(
  DecimalMath.fromNumber(0.005), // 0.5% borrow fee
  DecimalMath.fromNumber(0.003), // 0.3% flash loan fee
  DecimalMath.fromNumber(0.1),   // 10% protocol take rate
  20 // 20% host fee
);

const borrowAmount = DecimalMath.fromNumber(10000); // $10,000
const borrowFees = feeManager.calculateBorrowFees(borrowAmount);

console.log(`Borrow fee: $${DecimalMath.toNumber(borrowFees.principalFee)}`);
console.log(`Total with fee: $${DecimalMath.toNumber(borrowFees.totalWithFee)}`);
console.log(`Protocol fee: $${DecimalMath.toNumber(borrowFees.feeDistribution.protocolFee)}`);

// Fee scenarios comparison
const scenarios: FeeScenario[] = [
  {
    name: "Conservative",
    borrowFeeWad: DecimalMath.fromNumber(0.01),
    flashLoanFeeWad: DecimalMath.fromNumber(0.005),
    protocolTakeRate: DecimalMath.fromNumber(0.15),
    hostFeePercentage: 15,
  },
  {
    name: "Competitive",
    borrowFeeWad: DecimalMath.fromNumber(0.003),
    flashLoanFeeWad: DecimalMath.fromNumber(0.002),
    protocolTakeRate: DecimalMath.fromNumber(0.08),
    hostFeePercentage: 25,
  },
  {
    name: "Aggressive",
    borrowFeeWad: DecimalMath.fromNumber(0.001),
    flashLoanFeeWad: DecimalMath.fromNumber(0.001),
    protocolTakeRate: DecimalMath.fromNumber(0.05),
    hostFeePercentage: 30,
  },
];

const comparison = feeManager.compareFeeStructures(borrowAmount, scenarios);
comparison.forEach(comp => {
  console.log(`${comp.scenario}:`);
  console.log(`  User cost: $${DecimalMath.toNumber(comp.userCost)}`);
  console.log(`  Protocol revenue: $${DecimalMath.toNumber(comp.protocolRevenue)}`);
});
```

### Configuration Types

#### Market Configuration

```rust
pub struct MarketConfiguration {
    pub name: String,
    pub description: String,
    pub currency: UniversalAssetCurrency,
    pub flash_loans_enabled: bool,
    pub liquidation_enabled: bool,
    pub risk_parameters: RiskParameters,
    pub fee_structure: FeeStructure,
    pub oracle_configuration: OracleConfiguration,
    pub emergency_mode: bool,
}

pub struct RiskParameters {
    pub max_reserves: u8,
    pub max_obligations_per_user: u8,
    pub min_health_factor: Decimal,
    pub liquidation_close_factor: PercentageInt,
    pub liquidation_incentive: PercentageInt,
    pub debt_ceiling_usd: u64,
}

pub struct OracleConfiguration {
    pub max_staleness_slots: u64,
    pub price_deviation_threshold: PercentageInt,
    pub confidence_threshold: PercentageInt,
    pub fallback_oracle: Option<Pubkey>,
}
```

**Configuration Management:**
```typescript
class ConfigurationManager {
  async createMarketConfig(params: MarketConfigParams): Promise<MarketConfiguration> {
    return {
      name: params.name,
      description: params.description,
      currency: params.currency,
      flashLoansEnabled: params.flashLoansEnabled ?? false,
      liquidationEnabled: params.liquidationEnabled ?? true,
      riskParameters: {
        maxReserves: params.maxReserves ?? 20,
        maxObligationsPerUser: params.maxObligationsPerUser ?? 10,
        minHealthFactor: DecimalMath.fromNumber(params.minHealthFactor ?? 1.1),
        liquidationCloseFactor: PercentageConverter.fromPercent(params.liquidationCloseFactor ?? 50),
        liquidationIncentive: PercentageConverter.fromPercent(params.liquidationIncentive ?? 5),
        debtCeilingUsd: params.debtCeilingUsd ?? 100_000_000, // $100M default
      },
      feeStructure: {
        borrowFeeWad: DecimalMath.fromNumber(params.borrowFeeRate ?? 0.005),
        flashLoanFeeWad: DecimalMath.fromNumber(params.flashLoanFeeRate ?? 0.003),
        protocolTakeRate: DecimalMath.fromNumber(params.protocolTakeRate ?? 0.1),
        hostFeePercentage: params.hostFeePercentage ?? 20,
      },
      oracleConfiguration: {
        maxStalenessSlots: params.maxOracleStaleness ?? 100,
        priceDeviationThreshold: PercentageConverter.fromPercent(params.maxPriceDeviation ?? 5),
        confidenceThreshold: PercentageConverter.fromPercent(params.maxConfidenceInterval ?? 1),
        fallbackOracle: params.fallbackOracle,
      },
      emergencyMode: false,
    };
  }
  
  validateConfiguration(config: MarketConfiguration): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Risk parameter validation
    if (config.riskParameters.maxReserves > 50) {
      warnings.push("High maximum reserves count may impact performance");
    }
    
    if (DecimalMath.toNumber(config.riskParameters.minHealthFactor) < 1.05) {
      errors.push("Minimum health factor must be at least 1.05");
    }
    
    // Fee validation
    const borrowFeeRate = DecimalMath.toNumber(config.feeStructure.borrowFeeWad);
    if (borrowFeeRate > 0.02) {
      warnings.push("Borrow fee rate above 2% may discourage usage");
    }
    
    // Oracle validation
    if (config.oracleConfiguration.maxStalenessSlots > 300) {
      warnings.push("High oracle staleness threshold increases risk");
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
  
  // Generate configuration templates
  generateTemplate(marketType: MarketType): MarketConfiguration {
    const baseConfig = {
      name: "",
      description: "",
      currency: { usd: {} },
      flashLoansEnabled: true,
      liquidationEnabled: true,
      maxReserves: 20,
      maxObligationsPerUser: 10,
      debtCeilingUsd: 100_000_000,
      maxOracleStaleness: 100,
      maxPriceDeviation: 5,
      maxConfidenceInterval: 1,
      fallbackOracle: null,
    };
    
    switch (marketType) {
      case MarketType.Conservative:
        return this.createMarketConfig({
          ...baseConfig,
          name: "Conservative Market",
          minHealthFactor: 1.3,
          liquidationCloseFactor: 30,
          liquidationIncentive: 8,
          borrowFeeRate: 0.008,
          flashLoanFeeRate: 0.005,
          protocolTakeRate: 0.15,
          hostFeePercentage: 15,
        });
        
      case MarketType.Balanced:
        return this.createMarketConfig({
          ...baseConfig,
          name: "Balanced Market",
          minHealthFactor: 1.2,
          liquidationCloseFactor: 40,
          liquidationIncentive: 6,
          borrowFeeRate: 0.005,
          flashLoanFeeRate: 0.003,
          protocolTakeRate: 0.1,
          hostFeePercentage: 20,
        });
        
      case MarketType.Aggressive:
        return this.createMarketConfig({
          ...baseConfig,
          name: "Aggressive Market",
          minHealthFactor: 1.1,
          liquidationCloseFactor: 50,
          liquidationIncentive: 5,
          borrowFeeRate: 0.003,
          flashLoanFeeRate: 0.002,
          protocolTakeRate: 0.08,
          hostFeePercentage: 25,
        });
        
      default:
        return this.createMarketConfig(baseConfig);
    }
  }
}

interface MarketConfigParams {
  name: string;
  description: string;
  currency: any;
  flashLoansEnabled?: boolean;
  liquidationEnabled?: boolean;
  maxReserves?: number;
  maxObligationsPerUser?: number;
  minHealthFactor?: number;
  liquidationCloseFactor?: number;
  liquidationIncentive?: number;
  debtCeilingUsd?: number;
  borrowFeeRate?: number;
  flashLoanFeeRate?: number;
  protocolTakeRate?: number;
  hostFeePercentage?: number;
  maxOracleStaleness?: number;
  maxPriceDeviation?: number;
  maxConfidenceInterval?: number;
  fallbackOracle?: PublicKey;
}

enum MarketType {
  Conservative,
  Balanced,
  Aggressive,
}

interface MarketConfiguration {
  name: string;
  description: string;
  currency: any;
  flashLoansEnabled: boolean;
  liquidationEnabled: boolean;
  riskParameters: any;
  feeStructure: any;
  oracleConfiguration: any;
  emergencyMode: boolean;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// Usage
const configManager = new ConfigurationManager();
const conservativeMarket = configManager.generateTemplate(MarketType.Conservative);
const validation = configManager.validateConfiguration(conservativeMarket);

if (validation.valid) {
  console.log("Configuration is valid");
  if (validation.warnings.length > 0) {
    console.log("Warnings:", validation.warnings);
  }
} else {
  console.error("Configuration errors:", validation.errors);
}
```

---

## Error Codes

The Solana Borrow-Lending Protocol defines comprehensive error codes to help developers understand and handle various failure scenarios. Understanding these errors is crucial for building robust applications.

### Error Code Categories

Error codes are organized by category and severity level:

#### Validation Errors (6000-6019)

**InvalidMarketOwner (6000)**
- **Description:** Provided owner does not match the market owner
- **Causes:** 
  - Attempting administrative operations without proper authority
  - Incorrect market owner account in transaction
  - Market ownership transferred without updating references
- **Solutions:**
  - Verify the correct market owner account
  - Update owner references after ownership transfers
  - Use proper authorization patterns

```typescript
// Example: Handling market owner validation
try {
  await program.rpc.updateLendingMarket(newConfig, {
    accounts: {
      marketOwner: currentOwner.publicKey,
      lendingMarket: marketAddress,
    },
    signers: [currentOwner],
  });
} catch (error) {
  if (error.code === 6000) {
    console.error("Invalid market owner - verify ownership");
    // Fetch current owner and update references
    const marketData = await program.account.lendingMarket.fetch(marketAddress);
    console.log(`Actual owner: ${marketData.owner}`);
  }
}
```

**MathOverflow (6001)**
- **Description:** Operation would result in an overflow
- **Causes:**
  - Arithmetic operations exceeding maximum values
  - Interest calculations with extreme parameters
  - Token amounts beyond supported precision
- **Solutions:**
  - Validate input ranges before operations
  - Use appropriate decimal precision
  - Implement overflow checks in client code

```typescript
// Example: Preventing math overflow
function safeMath(a: number, b: number, operation: 'add' | 'multiply'): number {
  const MAX_SAFE_VALUE = Number.MAX_SAFE_INTEGER;
  
  if (operation === 'add') {
    if (a > MAX_SAFE_VALUE - b) {
      throw new Error("Addition would overflow");
    }
    return a + b;
  } else if (operation === 'multiply') {
    if (a > MAX_SAFE_VALUE / b) {
      throw new Error("Multiplication would overflow");
    }
    return a * b;
  }
  
  return 0;
}
```

**InvalidConfig (6002)**
- **Description:** Provided configuration isn't in the right format or range
- **Causes:**
  - Configuration parameters outside valid ranges
  - Inconsistent configuration combinations
  - Invalid percentage or rate values
- **Solutions:**
  - Validate configuration before submission
  - Use configuration validation utilities
  - Check parameter constraints

```typescript
// Configuration validation utility
class ConfigValidator {
  static validateReserveConfig(config: ReserveConfig): ValidationResult {
    const errors: string[] = [];
    
    // Validate LTV ratio
    if (config.loanToValueRatio < 1 || config.loanToValueRatio > 97) {
      errors.push("LTV ratio must be between 1% and 97%");
    }
    
    // Validate liquidation threshold
    if (config.liquidationThreshold <= config.loanToValueRatio) {
      errors.push("Liquidation threshold must be higher than LTV ratio");
    }
    
    // Validate interest rates
    if (config.minBorrowRate > config.optimalBorrowRate) {
      errors.push("Minimum borrow rate cannot exceed optimal rate");
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
```

**InvalidOracleConfig (6003)**
- **Description:** Provided oracle configuration isn't in the right format or range
- **Causes:**
  - Invalid Pyth oracle account addresses
  - Incorrect oracle configuration parameters
  - Mismatched product and price accounts
- **Solutions:**
  - Verify oracle account addresses
  - Check Pyth network compatibility
  - Validate oracle configuration parameters

**InvalidOracleDataLayout (6004)**
- **Description:** Cannot read oracle Pyth data because they have an unexpected format
- **Causes:**
  - Corrupted oracle data
  - Incompatible Pyth client version
  - Network-specific oracle format differences
- **Solutions:**
  - Update Pyth client libraries
  - Verify network compatibility
  - Check oracle account health

**InvalidAmount (6005)**
- **Description:** Provided amount is in invalid range
- **Causes:**
  - Zero amounts where positive values required
  - Amounts exceeding limits or precision
  - Negative amounts in unsigned contexts
- **Solutions:**
  - Validate amount ranges before transactions
  - Check minimum and maximum limits
  - Use appropriate number precision

```typescript
// Amount validation utility
class AmountValidator {
  static validateDepositAmount(
    amount: number,
    reserveConfig: ReserveConfig,
    userBalance: number
  ): ValidationResult {
    const errors: string[] = [];
    
    if (amount <= 0) {
      errors.push("Deposit amount must be positive");
    }
    
    if (amount > userBalance) {
      errors.push("Insufficient balance for deposit");
    }
    
    if (amount > reserveConfig.depositLimit) {
      errors.push(`Amount exceeds deposit limit: ${reserveConfig.depositLimit}`);
    }
    
    return { valid: errors.length === 0, errors };
  }
  
  static validateBorrowAmount(
    amount: number,
    availableBorrowValue: number,
    reserveLiquidity: number
  ): ValidationResult {
    const errors: string[] = [];
    
    if (amount <= 0) {
      errors.push("Borrow amount must be positive");
    }
    
    if (amount > availableBorrowValue) {
      errors.push("Amount exceeds available borrow capacity");
    }
    
    if (amount > reserveLiquidity) {
      errors.push("Insufficient reserve liquidity");
    }
    
    return { valid: errors.length === 0, errors };
  }
}
```

#### State Errors (6020-6039)

**ReserveStale (6021)**
- **Description:** Reserve account needs to be refreshed
- **Causes:**
  - Time elapsed since last reserve update
  - Interest accrual requiring state update
  - Price changes affecting calculations
- **Solutions:**
  - Call refresh_reserve before operations
  - Implement automated refresh mechanisms
  - Monitor staleness in real-time

```typescript
// Automatic reserve refresh
async function ensureReserveFresh(
  program: Program<BorrowLending>,
  reserve: PublicKey,
  maxStalenessSlots: number = 50
): Promise<void> {
  const reserveData = await program.account.reserve.fetch(reserve);
  const currentSlot = await program.provider.connection.getSlot();
  const staleness = currentSlot - reserveData.lastUpdate.slot.toNumber();
  
  if (staleness > maxStalenessSlots) {
    console.log(`Refreshing stale reserve (${staleness} slots old)`);
    await program.rpc.refreshReserve({
      accounts: {
        reserve: reserve,
        pythPrice: reserveData.liquidity.pythPriceKey,
        clock: SYSVAR_CLOCK_PUBKEY,
      },
    });
  }
}
```

**ObligationStale (6022)**
- **Description:** Obligation account needs to be refreshed
- **Causes:**
  - Time elapsed since last obligation update
  - Associated reserve changes affecting calculations
  - Health factor requiring recalculation
- **Solutions:**
  - Call refresh_obligation before operations
  - Refresh associated reserves first
  - Implement staleness monitoring

```typescript
// Comprehensive obligation refresh
async function refreshObligationWithReserves(
  program: Program<BorrowLending>,
  obligation: PublicKey
): Promise<void> {
  const obligationData = await program.account.obligation.fetch(obligation);
  
  // Collect all associated reserves
  const reserves = new Set<string>();
  obligationData.deposits.forEach(deposit => {
    if (deposit.depositReserve) {
      reserves.add(deposit.depositReserve.toString());
    }
  });
  obligationData.borrows.forEach(borrow => {
    if (borrow.borrowReserve) {
      reserves.add(borrow.borrowReserve.toString());
    }
  });
  
  // Refresh all reserves first
  for (const reserveStr of reserves) {
    const reserve = new PublicKey(reserveStr);
    await ensureReserveFresh(program, reserve);
  }
  
  // Then refresh obligation
  await program.rpc.refreshObligation({
    accounts: {
      obligation: obligation,
      clock: SYSVAR_CLOCK_PUBKEY,
    },
    remainingAccounts: Array.from(reserves).map(r => ({
      pubkey: new PublicKey(r),
      isWritable: false,
      isSigner: false,
    })),
  });
}
```

**MissingReserveAccount (6023)**
- **Description:** A reserve account linked to an obligation was not provided
- **Causes:**
  - Incomplete reserve accounts in remaining_accounts
  - Obligation referencing reserves not included
  - Incorrect account ordering
- **Solutions:**
  - Include all obligation-linked reserves
  - Verify account ordering requirements
  - Use helper functions for account collection

**NegativeInterestRate (6024)**
- **Description:** Interest rate cannot be negative
- **Causes:**
  - Invalid interest rate model parameters
  - Calculation errors resulting in negative rates
  - Configuration with inconsistent rate bounds
- **Solutions:**
  - Validate interest rate model configuration
  - Add bounds checking to rate calculations
  - Review rate parameter relationships

#### Business Logic Errors (6040-6059)

**LendingMarketMismatch (6030)**
- **Description:** Provided accounts must belong to the same market
- **Causes:**
  - Mixing reserves from different markets
  - Obligation and reserve from different markets
  - Cross-market operations attempted
- **Solutions:**
  - Verify market relationships before transactions
  - Use market-specific account collections
  - Implement market validation checks

```typescript
// Market relationship validation
async function validateMarketAccounts(
  program: Program<BorrowLending>,
  accounts: { obligation?: PublicKey; reserves: PublicKey[] }
): Promise<void> {
  let marketAddress: PublicKey | null = null;
  
  // Check obligation market
  if (accounts.obligation) {
    const obligationData = await program.account.obligation.fetch(accounts.obligation);
    marketAddress = obligationData.lendingMarket;
  }
  
  // Check all reserves belong to same market
  for (const reserve of accounts.reserves) {
    const reserveData = await program.account.reserve.fetch(reserve);
    
    if (marketAddress === null) {
      marketAddress = reserveData.lendingMarket;
    } else if (!marketAddress.equals(reserveData.lendingMarket)) {
      throw new Error(`Reserve ${reserve} belongs to different market`);
    }
  }
}
```

**ReserveCollateralDisabled (6031)**
- **Description:** Reserve cannot be used as a collateral
- **Causes:**
  - Reserve configuration disabling collateral use
  - Asset type restrictions
  - Risk management limitations
- **Solutions:**
  - Check reserve collateral status
  - Use appropriate reserves for collateral
  - Review asset eligibility requirements

**ObligationReserveLimit (6032)**
- **Description:** Number of reserves associated with a single obligation is limited
- **Causes:**
  - Attempting to exceed maximum reserve count per obligation
  - Protocol limit for complexity management
- **Solutions:**
  - Monitor reserve count per obligation
  - Use separate obligations for additional reserves
  - Plan position structure efficiently

```typescript
// Obligation reserve management
class ObligationReserveManager {
  static readonly MAX_RESERVES = 10;
  
  static async checkReserveCapacity(
    program: Program<BorrowLending>,
    obligation: PublicKey,
    newReserveType: 'deposit' | 'borrow'
  ): Promise<{ canAdd: boolean; currentCount: number; availableSlots: number }> {
    const obligationData = await program.account.obligation.fetch(obligation);
    
    const usedSlots = obligationData.reserves.filter(
      reserve => reserve.Empty === undefined
    ).length;
    
    const availableSlots = this.MAX_RESERVES - usedSlots;
    const canAdd = availableSlots > 0;
    
    return {
      canAdd,
      currentCount: usedSlots,
      availableSlots,
    };
  }
  
  static getReserveUtilization(obligationData: any): {
    totalSlots: number;
    usedSlots: number;
    utilizationRate: number;
  } {
    const totalSlots = this.MAX_RESERVES;
    const usedSlots = obligationData.reserves.filter(
      (reserve: any) => reserve.Empty === undefined
    ).length;
    
    return {
      totalSlots,
      usedSlots,
      utilizationRate: usedSlots / totalSlots,
    };
  }
}
```

#### Collateral and Liquidity Errors (6060-6079)

**ObligationCollateralEmpty (6033)**
- **Description:** No collateral deposited in this obligation
- **Causes:**
  - Attempting operations requiring collateral without deposits
  - All collateral previously withdrawn
- **Solutions:**
  - Deposit collateral before borrowing operations
  - Check collateral status before transactions
  - Implement collateral requirement validation

**ObligationCollateralTooLow (6034)**
- **Description:** Not enough collateral to perform this action
- **Causes:**
  - Insufficient collateral for borrowing amount
  - Collateral value below required threshold
  - Market conditions affecting collateral value
- **Solutions:**
  - Add more collateral before borrowing
  - Reduce borrow amount
  - Monitor collateral value changes

```typescript
// Collateral management utilities
class CollateralManager {
  static async calculateRequiredCollateral(
    program: Program<BorrowLending>,
    borrowAmount: number,
    borrowReserve: PublicKey,
    collateralReserve: PublicKey
  ): Promise<{
    requiredCollateral: number;
    currentCollateral: number;
    additionalNeeded: number;
  }> {
    const borrowReserveData = await program.account.reserve.fetch(borrowReserve);
    const collateralReserveData = await program.account.reserve.fetch(collateralReserve);
    
    // Get prices (simplified - would use actual oracle data)
    const borrowPrice = 1; // USD price of borrow asset
    const collateralPrice = 1; // USD price of collateral asset
    
    // Calculate required collateral based on LTV
    const ltvRatio = collateralReserveData.config.loanToValueRatio / 100;
    const borrowValue = borrowAmount * borrowPrice;
    const requiredCollateralValue = borrowValue / ltvRatio;
    const requiredCollateral = requiredCollateralValue / collateralPrice;
    
    return {
      requiredCollateral,
      currentCollateral: 0, // Would fetch from obligation
      additionalNeeded: Math.max(0, requiredCollateral),
    };
  }
  
  static async validateCollateralSufficiency(
    program: Program<BorrowLending>,
    obligation: PublicKey,
    additionalBorrowValue: number
  ): Promise<{ sufficient: boolean; shortfall: number }> {
    const obligationData = await program.account.obligation.fetch(obligation);
    
    const currentBorrowValue = obligationData.collateralizedBorrowedValue.toNumber();
    const totalBorrowValue = currentBorrowValue + additionalBorrowValue;
    const allowedBorrowValue = obligationData.allowedBorrowValue.toNumber();
    
    const sufficient = totalBorrowValue <= allowedBorrowValue;
    const shortfall = Math.max(0, totalBorrowValue - allowedBorrowValue);
    
    return { sufficient, shortfall };
  }
}
```

**WithdrawTooSmall (6041)**
- **Description:** Cannot withdraw zero collateral
- **Causes:**
  - Zero withdrawal amounts
  - Rounding errors in calculations
- **Solutions:**
  - Validate withdrawal amounts
  - Handle minimum withdrawal requirements
  - Check for calculation precision issues

**WithdrawTooLarge (6042)**
- **Description:** Cannot withdraw more than allowed amount of collateral
- **Causes:**
  - Withdrawal would violate collateral requirements
  - Health factor would fall below threshold
  - Insufficient collateral deposited
- **Solutions:**
  - Calculate maximum safe withdrawal amount
  - Implement withdrawal limit checks
  - Provide user guidance on safe amounts

```typescript
// Safe withdrawal calculations
async function calculateMaxWithdrawal(
  program: Program<BorrowLending>,
  obligation: PublicKey,
  collateralReserve: PublicKey,
  minHealthFactor: number = 1.3
): Promise<{
  maxWithdrawal: number;
  currentDeposit: number;
  healthFactorAfterMax: number;
}> {
  const obligationData = await program.account.obligation.fetch(obligation);
  
  // Find collateral deposit for this reserve
  const deposit = obligationData.deposits.find(
    (d: any) => d.Collateral && d.Collateral.inner.deposit_reserve.equals(collateralReserve)
  );
  
  if (!deposit) {
    return { maxWithdrawal: 0, currentDeposit: 0, healthFactorAfterMax: 0 };
  }
  
  const currentDeposit = deposit.Collateral.inner.deposited_amount;
  const currentCollateralValue = obligationData.depositedValue.toNumber();
  const currentBorrowValue = obligationData.collateralizedBorrowedValue.toNumber();
  
  // Calculate maximum withdrawal maintaining min health factor
  const requiredCollateralValue = currentBorrowValue * minHealthFactor;
  const maxWithdrawValue = currentCollateralValue - requiredCollateralValue;
  
  // Convert to token amount (simplified)
  const collateralPrice = 1; // Would get from oracle
  const maxWithdrawal = Math.max(0, Math.min(currentDeposit, maxWithdrawValue / collateralPrice));
  
  const healthFactorAfterMax = currentCollateralValue - (maxWithdrawal * collateralPrice);
  
  return {
    maxWithdrawal,
    currentDeposit,
    healthFactorAfterMax: healthFactorAfterMax / currentBorrowValue,
  };
}
```

#### Borrowing and Repayment Errors (6080-6099)

**BorrowTooLarge (6043)**
- **Description:** Cannot borrow that amount of liquidity against this obligation
- **Causes:**
  - Borrow amount exceeds collateral capacity
  - Health factor would fall below minimum
  - Reserve liquidity insufficient
- **Solutions:**
  - Calculate maximum safe borrow amount
  - Add more collateral
  - Reduce borrow amount

**BorrowTooSmall (6044)**
- **Description:** Not enough liquidity borrowed to cover the fees
- **Causes:**
  - Borrow amount too small to pay fees
  - Minimum borrow requirements not met
- **Solutions:**
  - Increase borrow amount
  - Check minimum borrow requirements
  - Account for fees in calculations

**RepayTooSmall (6045)**
- **Description:** The amount to repay cannot be zero
- **Causes:**
  - Zero repayment amounts
  - Invalid repayment calculations
- **Solutions:**
  - Validate repayment amounts
  - Use proper debt calculation methods
  - Handle edge cases in repayment logic

#### Liquidation Errors (6100-6119)

**ObligationHealthy (6046)**
- **Description:** Healthy obligation cannot be liquidated
- **Causes:**
  - Health factor above liquidation threshold
  - Attempting liquidation on safe positions
- **Solutions:**
  - Check health factor before liquidation attempts
  - Wait for health factor to deteriorate
  - Monitor positions for liquidation opportunities

```typescript
// Liquidation eligibility checker
class LiquidationChecker {
  static async checkLiquidationEligibility(
    program: Program<BorrowLending>,
    obligation: PublicKey
  ): Promise<{
    liquidatable: boolean;
    healthFactor: number;
    liquidationThreshold: number;
    timeToLiquidation?: number;
  }> {
    const obligationData = await program.account.obligation.fetch(obligation);
    
    const collateralValue = obligationData.depositedValue.toNumber();
    const borrowedValue = obligationData.collateralizedBorrowedValue.toNumber();
    const healthFactor = collateralValue / borrowedValue;
    
    const liquidatable = healthFactor < 1.0;
    
    return {
      liquidatable,
      healthFactor,
      liquidationThreshold: 1.0,
      timeToLiquidation: liquidatable ? 0 : this.estimateTimeToLiquidation(
        healthFactor,
        obligationData
      ),
    };
  }
  
  private static estimateTimeToLiquidation(
    currentHealthFactor: number,
    obligationData: any
  ): number | undefined {
    if (currentHealthFactor < 1.1) {
      return 1; // Very close, within 1 day
    } else if (currentHealthFactor < 1.2) {
      return 7; // Within a week
    } else if (currentHealthFactor < 1.3) {
      return 30; // Within a month
    }
    
    return undefined; // Not approaching liquidation
  }
  
  static async monitorLiquidationRisk(
    program: Program<BorrowLending>,
    obligations: PublicKey[],
    alertCallback: (obligation: PublicKey, risk: any) => void
  ): Promise<void> {
    for (const obligation of obligations) {
      try {
        const eligibility = await this.checkLiquidationEligibility(program, obligation);
        
        if (eligibility.liquidatable) {
          alertCallback(obligation, {
            level: 'critical',
            message: 'Position is liquidatable',
            healthFactor: eligibility.healthFactor,
          });
        } else if (eligibility.healthFactor < 1.1) {
          alertCallback(obligation, {
            level: 'warning',
            message: 'Position at high risk of liquidation',
            healthFactor: eligibility.healthFactor,
            timeToLiquidation: eligibility.timeToLiquidation,
          });
        }
      } catch (error) {
        console.error(`Error checking obligation ${obligation}:`, error);
      }
    }
  }
}
```

**LiquidationTooSmall (6047)**
- **Description:** To receive some collateral or repay liquidity the amount of liquidity to repay must be higher
- **Causes:**
  - Liquidation amount below minimum threshold
  - Insufficient liquidation incentive
- **Solutions:**
  - Increase liquidation amount
  - Check minimum liquidation requirements
  - Calculate optimal liquidation size

#### Flash Loan Errors (6120-6139)

**InvalidFlashLoanTargetProgram (6048)**
- **Description:** Flash loan target program cannot be BLp
- **Causes:**
  - Attempting recursive flash loans
  - Invalid target program specification
- **Solutions:**
  - Use external programs for flash loan logic
  - Avoid self-referential flash loans
  - Implement proper target program validation

**FlashLoansDisabled (6049)**
- **Description:** Flash loans feature currently not enabled
- **Causes:**
  - Market configuration disabling flash loans
  - Emergency mode or security measures
- **Solutions:**
  - Check market flash loan status
  - Wait for flash loans to be re-enabled
  - Use alternative liquidity sources

```typescript
// Flash loan availability checker
async function checkFlashLoanAvailability(
  program: Program<BorrowLending>,
  market: PublicKey,
  reserve: PublicKey,
  amount: number
): Promise<{
  available: boolean;
  reason?: string;
  maxAmount?: number;
}> {
  const marketData = await program.account.lendingMarket.fetch(market);
  
  if (!marketData.enableFlashLoans) {
    return {
      available: false,
      reason: "Flash loans disabled for this market",
    };
  }
  
  const reserveData = await program.account.reserve.fetch(reserve);
  const availableLiquidity = reserveData.liquidity.availableAmount.toNumber();
  
  if (amount > availableLiquidity) {
    return {
      available: false,
      reason: "Insufficient reserve liquidity",
      maxAmount: availableLiquidity,
    };
  }
  
  return { available: true };
}
```

### Error Handling Best Practices

#### Comprehensive Error Handler

```typescript
class ProtocolErrorHandler {
  private static readonly ERROR_MESSAGES: { [key: number]: string } = {
    6000: "Invalid market owner - check authorization",
    6001: "Math overflow - reduce transaction amounts",
    6002: "Invalid configuration - check parameter ranges",
    6021: "Reserve stale - refresh before operation",
    6022: "Obligation stale - refresh before operation",
    6043: "Borrow too large - add collateral or reduce amount",
    6046: "Position healthy - cannot liquidate",
    6049: "Flash loans disabled - check market settings",
  };
  
  static async handleError(error: any, context: ErrorContext): Promise<ErrorResponse> {
    const errorCode = this.extractErrorCode(error);
    const errorMessage = this.ERROR_MESSAGES[errorCode] || "Unknown error occurred";
    
    const response: ErrorResponse = {
      code: errorCode,
      message: errorMessage,
      originalError: error.message,
      context,
      suggestedActions: [],
      retryable: false,
    };
    
    // Add specific handling logic
    switch (errorCode) {
      case 6021: // ReserveStale
      case 6022: // ObligationStale
        response.suggestedActions = ["Refresh accounts and retry"];
        response.retryable = true;
        break;
        
      case 6043: // BorrowTooLarge
        response.suggestedActions = [
          "Add more collateral",
          "Reduce borrow amount",
          "Check available borrow capacity"
        ];
        break;
        
      case 6000: // InvalidMarketOwner
        response.suggestedActions = [
          "Verify market owner account",
          "Check authorization permissions"
        ];
        break;
        
      case 6049: // FlashLoansDisabled
        response.suggestedActions = [
          "Check market flash loan status",
          "Use alternative liquidity sources",
          "Wait for flash loans to be re-enabled"
        ];
        break;
    }
    
    return response;
  }
  
  private static extractErrorCode(error: any): number {
    // Extract error code from various error formats
    if (error.code) return error.code;
    if (error.error?.errorCode?.code) return error.error.errorCode.code;
    if (typeof error === 'string' && error.includes('Error Code:')) {
      const match = error.match(/Error Code: (\d+)/);
      return match ? parseInt(match[1]) : 0;
    }
    return 0;
  }
  
  static async retryWithErrorHandling<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    context: ErrorContext
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        const errorResponse = await this.handleError(error, context);
        
        console.log(`Attempt ${attempt} failed:`, errorResponse.message);
        
        if (!errorResponse.retryable || attempt === maxRetries) {
          throw new EnhancedError(errorResponse);
        }
        
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
    
    throw lastError;
  }
}

interface ErrorContext {
  operation: string;
  accounts: { [key: string]: string };
  parameters: any;
  timestamp: number;
}

interface ErrorResponse {
  code: number;
  message: string;
  originalError: string;
  context: ErrorContext;
  suggestedActions: string[];
  retryable: boolean;
}

class EnhancedError extends Error {
  constructor(public errorResponse: ErrorResponse) {
    super(errorResponse.message);
    this.name = "ProtocolError";
  }
}

// Usage example
async function safeBorrowOperation(
  program: Program<BorrowLending>,
  obligation: PublicKey,
  reserve: PublicKey,
  amount: number
) {
  const context: ErrorContext = {
    operation: "borrow_obligation_liquidity",
    accounts: {
      obligation: obligation.toString(),
      reserve: reserve.toString(),
    },
    parameters: { amount },
    timestamp: Date.now(),
  };
  
  return await ProtocolErrorHandler.retryWithErrorHandling(
    async () => {
      // Refresh accounts first to avoid stale errors
      await refreshObligationWithReserves(program, obligation);
      
      // Attempt borrow operation
      return await program.rpc.borrowObligationLiquidity(
        0, // lending_market_bump_seed
        amount,
        {
          accounts: {
            // ... borrow accounts
          },
        }
      );
    },
    3,
    context
  );
}
```

#### Error Recovery Strategies

```typescript
class ErrorRecoveryManager {
  static async recoverFromStaleAccounts(
    program: Program<BorrowLending>,
    accounts: {
      reserves: PublicKey[];
      obligations: PublicKey[];
    }
  ): Promise<void> {
    console.log("Recovering from stale accounts...");
    
    // Refresh all reserves
    for (const reserve of accounts.reserves) {
      try {
        await ensureReserveFresh(program, reserve);
      } catch (error) {
        console.error(`Failed to refresh reserve ${reserve}:`, error);
      }
    }
    
    // Refresh all obligations
    for (const obligation of accounts.obligations) {
      try {
        await refreshObligationWithReserves(program, obligation);
      } catch (error) {
        console.error(`Failed to refresh obligation ${obligation}:`, error);
      }
    }
  }
  
  static async recoverFromInsufficientCollateral(
    program: Program<BorrowLending>,
    obligation: PublicKey,
    targetHealthFactor: number = 1.5
  ): Promise<{
    recovered: boolean;
    actions: string[];
  }> {
    const actions: string[] = [];
    
    try {
      const obligationData = await program.account.obligation.fetch(obligation);
      const currentHealthFactor = obligationData.depositedValue.toNumber() / 
                                 obligationData.collateralizedBorrowedValue.toNumber();
      
      if (currentHealthFactor >= targetHealthFactor) {
        return { recovered: true, actions: ["Position already healthy"] };
      }
      
      const requiredCollateralValue = obligationData.collateralizedBorrowedValue.toNumber() * 
                                    targetHealthFactor;
      const additionalCollateralNeeded = requiredCollateralValue - 
                                       obligationData.depositedValue.toNumber();
      
      actions.push(`Add $${additionalCollateralNeeded.toFixed(2)} in collateral`);
      
      // Alternative: partial debt repayment
      const debtToRepay = (obligationData.collateralizedBorrowedValue.toNumber() - 
                          obligationData.depositedValue.toNumber() / targetHealthFactor);
      
      if (debtToRepay > 0) {
        actions.push(`Alternatively, repay $${debtToRepay.toFixed(2)} of debt`);
      }
      
      return { recovered: false, actions };
    } catch (error) {
      return { 
        recovered: false, 
        actions: ["Failed to analyze position - check account status"] 
      };
    }
  }
}
```

### Testing Error Scenarios

```typescript
describe("Error Handling Tests", () => {
  test("should handle stale reserve gracefully", async () => {
    // Create stale condition by advancing time
    await program.provider.connection.confirmTransaction(
      await program.provider.connection.requestAirdrop(
        user.publicKey,
        1000000000
      )
    );
    
    // Wait for staleness
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    try {
      await program.rpc.depositReserveLiquidity(1000, {
        accounts: {
          // ... accounts
        },
      });
      
      expect.fail("Should have thrown stale reserve error");
    } catch (error) {
      expect(error.code).toBe(6021); // ReserveStale
      
      // Verify error handling
      const errorResponse = await ProtocolErrorHandler.handleError(error, {
        operation: "deposit",
        accounts: {},
        parameters: { amount: 1000 },
        timestamp: Date.now(),
      });
      
      expect(errorResponse.retryable).toBe(true);
      expect(errorResponse.suggestedActions).toContain("Refresh accounts and retry");
    }
  });
  
  test("should handle insufficient collateral error", async () => {
    try {
      await program.rpc.borrowObligationLiquidity(
        0,
        10000000, // Very large amount
        {
          accounts: {
            // ... accounts
          },
        }
      );
      
      expect.fail("Should have thrown borrow too large error");
    } catch (error) {
      expect(error.code).toBe(6043); // BorrowTooLarge
      
      const recovery = await ErrorRecoveryManager.recoverFromInsufficientCollateral(
        program,
        obligationAddress,
        1.5
      );
      
      expect(recovery.actions.length).toBeGreaterThan(0);
      expect(recovery.actions[0]).toContain("Add");
    }
  });
});
```

---

## TypeScript SDK

The TypeScript SDK provides a comprehensive interface for interacting with the Solana Borrow-Lending Protocol. It abstracts complex operations and provides type-safe interfaces for all protocol functionality.
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