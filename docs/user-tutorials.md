# User Tutorials

This guide provides step-by-step tutorials for common use cases in the Solana Borrow-Lending Protocol.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Tutorial 1: Lending Tokens](#tutorial-1-lending-tokens)
3. [Tutorial 2: Borrowing Against Collateral](#tutorial-2-borrowing-against-collateral)
4. [Tutorial 3: Managing Your Position](#tutorial-3-managing-your-position)
5. [Tutorial 4: Understanding Liquidation](#tutorial-4-understanding-liquidation)
6. [Tutorial 5: Using Flash Loans](#tutorial-5-using-flash-loans)
7. [Tutorial 6: Leveraged Yield Farming](#tutorial-6-leveraged-yield-farming)
8. [Common Use Cases](#common-use-cases)
9. [Troubleshooting](#troubleshooting)

## Getting Started

### Prerequisites

Before you begin, ensure you have:

1. **A Solana wallet** with SOL for transaction fees
2. **The tokens you want to lend or use as collateral**
3. **Basic understanding** of DeFi concepts (lending, borrowing, collateral)

### Environment Setup

For developers wanting to interact programmatically:

```bash
# Install dependencies
npm install @project-serum/anchor @solana/web3.js @solana/spl-token

# Or using yarn
yarn add @project-serum/anchor @solana/web3.js @solana/spl-token
```

### Understanding Key Concepts

- **Lending**: Deposit tokens to earn interest
- **Collateral**: Tokens you deposit to secure a loan
- **Borrowing**: Taking a loan against your collateral
- **Health Factor**: Measure of your position's safety
- **Liquidation**: When unhealthy positions are closed

## Tutorial 1: Lending Tokens

Learn how to lend tokens and earn interest.

### Step 1: Choose a Token to Lend

First, identify which tokens are supported as reserves in the lending market:

```typescript
import * as anchor from "@project-serum/anchor";
import { PublicKey } from "@solana/web3.js";

// Connect to the program
const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);
const program = anchor.workspace.BorrowLending;

// Get all reserves for a lending market
async function getAvailableReserves(lendingMarketPubkey: PublicKey) {
  const reserves = await program.account.reserve.all([
    {
      memcmp: {
        offset: 8, // Skip discriminator
        bytes: lendingMarketPubkey.toBase58(),
      },
    },
  ]);
  
  console.log("Available reserves:");
  reserves.forEach((reserve) => {
    console.log(`- ${reserve.account.liquidity.mintPubkey.toBase58()}`);
    console.log(`  Supply APY: ${calculateSupplyAPY(reserve.account)}%`);
  });
  
  return reserves;
}
```

### Step 2: Deposit Liquidity

Deposit your tokens into a reserve to start earning interest:

```typescript
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";

async function depositLiquidity(
  reservePubkey: PublicKey,
  amount: number,
  userKeypair: anchor.web3.Keypair
) {
  // Get reserve account
  const reserve = await program.account.reserve.fetch(reservePubkey);
  
  // Calculate token accounts
  const liquidityMint = reserve.liquidity.mintPubkey;
  const collateralMint = reserve.collateral.mintPubkey;
  
  const sourceLiquidityWallet = await getAssociatedTokenAddress(
    liquidityMint,
    userKeypair.publicKey
  );
  
  const destinationCollateralWallet = await getAssociatedTokenAddress(
    collateralMint,
    userKeypair.publicKey
  );
  
  // Execute deposit
  const tx = await program.rpc.depositReserveLiquidity(
    new anchor.BN(amount * Math.pow(10, 6)), // Assuming 6 decimals
    {
      accounts: {
        sourceLiquidityWallet,
        destinationCollateralWallet,
        reserve: reservePubkey,
        reserveLiquidityWallet: reserve.liquidity.supplyPubkey,
        reserveCollateralMint: collateralMint,
        lendingMarket: reserve.lendingMarket,
        transferAuthority: userKeypair.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
      },
      signers: [userKeypair],
    }
  );
  
  console.log(`Deposited ${amount} tokens. Transaction: ${tx}`);
  return tx;
}
```

### Step 3: Monitor Your Earnings

Check your current position and accrued interest:

```typescript
async function checkLendingPosition(
  collateralMint: PublicKey,
  userPubkey: PublicKey
) {
  // Get user's collateral token balance
  const collateralWallet = await getAssociatedTokenAddress(
    collateralMint,
    userPubkey
  );
  
  const balance = await provider.connection.getTokenAccountBalance(collateralWallet);
  console.log(`Collateral tokens: ${balance.value.uiAmount}`);
  
  // Calculate equivalent liquidity value
  const reserve = await program.account.reserve.fetch(reservePubkey);
  const exchangeRate = calculateExchangeRate(reserve);
  const liquidityValue = balance.value.uiAmount * exchangeRate;
  
  console.log(`Equivalent liquidity value: ${liquidityValue}`);
  console.log(`Current APY: ${calculateSupplyAPY(reserve)}%`);
}
```

### Step 4: Withdraw Your Funds

When you want to withdraw your deposited tokens plus interest:

```typescript
async function withdrawLiquidity(
  reservePubkey: PublicKey,
  collateralAmount: number,
  userKeypair: anchor.web3.Keypair
) {
  const reserve = await program.account.reserve.fetch(reservePubkey);
  const [lendingMarketPda] = await PublicKey.findProgramAddress(
    [reserve.lendingMarket.toBytes()],
    program.programId
  );
  
  const liquidityMint = reserve.liquidity.mintPubkey;
  const collateralMint = reserve.collateral.mintPubkey;
  
  const sourceCollateralWallet = await getAssociatedTokenAddress(
    collateralMint,
    userKeypair.publicKey
  );
  
  const destinationLiquidityWallet = await getAssociatedTokenAddress(
    liquidityMint,
    userKeypair.publicKey
  );
  
  const tx = await program.rpc.redeemReserveCollateral(
    new anchor.BN(collateralAmount * Math.pow(10, 6)),
    {
      accounts: {
        sourceCollateralWallet,
        destinationLiquidityWallet,
        reserve: reservePubkey,
        reserveCollateralMint: collateralMint,
        reserveLiquidityWallet: reserve.liquidity.supplyPubkey,
        lendingMarket: reserve.lendingMarket,
        lendingMarketPda,
        transferAuthority: userKeypair.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
      },
      signers: [userKeypair],
    }
  );
  
  console.log(`Withdrew liquidity. Transaction: ${tx}`);
  return tx;
}
```

## Tutorial 2: Borrowing Against Collateral

Learn how to borrow tokens by using your deposits as collateral.

### Step 1: Create an Obligation

Before borrowing, you need to create an obligation account:

```typescript
async function createObligation(
  lendingMarketPubkey: PublicKey,
  userKeypair: anchor.web3.Keypair
) {
  const obligationKeypair = anchor.web3.Keypair.generate();
  
  const tx = await program.rpc.initObligation({
    accounts: {
      obligation: obligationKeypair.publicKey,
      lendingMarket: lendingMarketPubkey,
      obligationOwner: userKeypair.publicKey,
      clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      tokenProgram: TOKEN_PROGRAM_ID,
    },
    signers: [obligationKeypair, userKeypair],
  });
  
  console.log(`Obligation created: ${obligationKeypair.publicKey.toBase58()}`);
  console.log(`Transaction: ${tx}`);
  
  return obligationKeypair.publicKey;
}
```

### Step 2: Deposit Collateral

Deposit your collateral tokens into the obligation:

```typescript
async function depositCollateral(
  obligationPubkey: PublicKey,
  reservePubkey: PublicKey,
  collateralAmount: number,
  userKeypair: anchor.web3.Keypair
) {
  const reserve = await program.account.reserve.fetch(reservePubkey);
  const collateralMint = reserve.collateral.mintPubkey;
  
  const sourceCollateralWallet = await getAssociatedTokenAddress(
    collateralMint,
    userKeypair.publicKey
  );
  
  // Create destination collateral wallet for the obligation
  const destinationCollateralWallet = await getAssociatedTokenAddress(
    collateralMint,
    obligationPubkey
  );
  
  const tx = await program.rpc.depositObligationCollateral(
    new anchor.BN(collateralAmount * Math.pow(10, 6)),
    {
      accounts: {
        sourceCollateralWallet,
        destinationCollateralWallet,
        reserve: reservePubkey,
        obligation: obligationPubkey,
        lendingMarket: reserve.lendingMarket,
        obligationOwner: userKeypair.publicKey,
        transferAuthority: userKeypair.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
      },
      signers: [userKeypair],
    }
  );
  
  console.log(`Deposited ${collateralAmount} collateral. Transaction: ${tx}`);
  return tx;
}
```

### Step 3: Calculate Borrowing Power

Before borrowing, check how much you can safely borrow:

```typescript
async function calculateBorrowingPower(obligationPubkey: PublicKey) {
  const obligation = await program.account.obligation.fetch(obligationPubkey);
  
  let totalCollateralValue = 0;
  let maxBorrowValue = 0;
  
  for (const deposit of obligation.deposits) {
    const reserve = await program.account.reserve.fetch(deposit.depositReserve);
    
    // Get collateral value in UAC
    const collateralValue = calculateCollateralValue(deposit, reserve);
    totalCollateralValue += collateralValue;
    
    // Calculate max borrow value based on LTV ratio
    const ltvRatio = reserve.config.loanToValueRatio / 100;
    maxBorrowValue += collateralValue * ltvRatio;
  }
  
  console.log(`Total collateral value: ${totalCollateralValue} UAC`);
  console.log(`Max borrow value: ${maxBorrowValue} UAC`);
  console.log(`Available to borrow: ${maxBorrowValue - obligation.borrowedValue} UAC`);
  
  return { totalCollateralValue, maxBorrowValue };
}
```

### Step 4: Borrow Liquidity

Borrow tokens against your collateral:

```typescript
async function borrowLiquidity(
  obligationPubkey: PublicKey,
  reservePubkey: PublicKey,
  borrowAmount: number,
  userKeypair: anchor.web3.Keypair
) {
  const reserve = await program.account.reserve.fetch(reservePubkey);
  const [lendingMarketPda, bumpSeed] = await PublicKey.findProgramAddress(
    [reserve.lendingMarket.toBytes()],
    program.programId
  );
  
  const liquidityMint = reserve.liquidity.mintPubkey;
  
  const destinationLiquidityWallet = await getAssociatedTokenAddress(
    liquidityMint,
    userKeypair.publicKey
  );
  
  const tx = await program.rpc.borrowObligationLiquidity(
    bumpSeed,
    new anchor.BN(borrowAmount * Math.pow(10, 6)),
    {
      accounts: {
        sourceLiquidityWallet: reserve.liquidity.supplyPubkey,
        destinationLiquidityWallet,
        reserve: reservePubkey,
        feeReceiver: reserve.liquidity.feeReceiver,
        obligation: obligationPubkey,
        lendingMarket: reserve.lendingMarket,
        lendingMarketPda,
        obligationOwner: userKeypair.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
      },
      signers: [userKeypair],
    }
  );
  
  console.log(`Borrowed ${borrowAmount} tokens. Transaction: ${tx}`);
  return tx;
}
```

### Step 5: Monitor Your Health Factor

Keep track of your position's health to avoid liquidation:

```typescript
async function monitorHealthFactor(obligationPubkey: PublicKey) {
  const obligation = await program.account.obligation.fetch(obligationPubkey);
  
  let totalCollateralValue = 0;
  let totalBorrowValue = 0;
  let unhealthyBorrowValue = 0;
  
  // Calculate collateral value
  for (const deposit of obligation.deposits) {
    const reserve = await program.account.reserve.fetch(deposit.depositReserve);
    totalCollateralValue += calculateCollateralValue(deposit, reserve);
  }
  
  // Calculate borrow value and liquidation threshold
  for (const borrow of obligation.borrows) {
    const reserve = await program.account.reserve.fetch(borrow.borrowReserve);
    const borrowValue = calculateBorrowValue(borrow, reserve);
    totalBorrowValue += borrowValue;
    
    const liquidationThreshold = reserve.config.liquidationThreshold / 100;
    unhealthyBorrowValue += totalCollateralValue * liquidationThreshold;
  }
  
  const healthFactor = totalCollateralValue / totalBorrowValue;
  const isHealthy = totalBorrowValue < unhealthyBorrowValue;
  
  console.log(`Health Factor: ${healthFactor.toFixed(2)}`);
  console.log(`Position Status: ${isHealthy ? 'Healthy' : 'At Risk'}`);
  console.log(`Collateral Value: ${totalCollateralValue} UAC`);
  console.log(`Borrowed Value: ${totalBorrowValue} UAC`);
  
  if (healthFactor < 1.2) {
    console.warn("⚠️  Your position is at risk of liquidation!");
    console.warn("Consider adding more collateral or repaying debt.");
  }
  
  return { healthFactor, isHealthy };
}
```

## Tutorial 3: Managing Your Position

Learn how to maintain and optimize your lending/borrowing position.

### Repaying Loans

```typescript
async function repayLoan(
  obligationPubkey: PublicKey,
  reservePubkey: PublicKey,
  repayAmount: number,
  userKeypair: anchor.web3.Keypair
) {
  const reserve = await program.account.reserve.fetch(reservePubkey);
  const liquidityMint = reserve.liquidity.mintPubkey;
  
  const sourceLiquidityWallet = await getAssociatedTokenAddress(
    liquidityMint,
    userKeypair.publicKey
  );
  
  const tx = await program.rpc.repayObligationLiquidity(
    new anchor.BN(repayAmount * Math.pow(10, 6)),
    { standard: {} }, // LoanKind::Standard
    {
      accounts: {
        sourceLiquidityWallet,
        destinationLiquidityWallet: reserve.liquidity.supplyPubkey,
        reserve: reservePubkey,
        obligation: obligationPubkey,
        repayer: userKeypair.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
      },
      signers: [userKeypair],
    }
  );
  
  console.log(`Repaid ${repayAmount} tokens. Transaction: ${tx}`);
  return tx;
}
```

### Withdrawing Collateral

```typescript
async function withdrawCollateral(
  obligationPubkey: PublicKey,
  reservePubkey: PublicKey,
  collateralAmount: number,
  userKeypair: anchor.web3.Keypair
) {
  const reserve = await program.account.reserve.fetch(reservePubkey);
  const [lendingMarketPda, bumpSeed] = await PublicKey.findProgramAddress(
    [reserve.lendingMarket.toBytes()],
    program.programId
  );
  
  const collateralMint = reserve.collateral.mintPubkey;
  
  const sourceCollateralWallet = await getAssociatedTokenAddress(
    collateralMint,
    obligationPubkey
  );
  
  const destinationCollateralWallet = await getAssociatedTokenAddress(
    collateralMint,
    userKeypair.publicKey
  );
  
  const tx = await program.rpc.withdrawObligationCollateral(
    bumpSeed,
    new anchor.BN(collateralAmount * Math.pow(10, 6)),
    {
      accounts: {
        sourceCollateralWallet,
        destinationCollateralWallet,
        reserve: reservePubkey,
        obligation: obligationPubkey,
        lendingMarket: reserve.lendingMarket,
        lendingMarketPda,
        obligationOwner: userKeypair.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
      },
      signers: [userKeypair],
    }
  );
  
  console.log(`Withdrew ${collateralAmount} collateral. Transaction: ${tx}`);
  return tx;
}
```

## Tutorial 4: Understanding Liquidation

Learn how liquidation works and how to participate as a liquidator.

### Identifying Liquidation Opportunities

```typescript
async function findLiquidationOpportunities(lendingMarketPubkey: PublicKey) {
  // Get all obligations in the market
  const obligations = await program.account.obligation.all([
    {
      memcmp: {
        offset: 8, // Skip discriminator
        bytes: lendingMarketPubkey.toBase58(),
      },
    },
  ]);
  
  const liquidationOpportunities = [];
  
  for (const obligationAccount of obligations) {
    const obligation = obligationAccount.account;
    const isUnhealthy = await checkObligationHealth(obligation);
    
    if (!isUnhealthy) {
      liquidationOpportunities.push({
        obligation: obligationAccount.publicKey,
        account: obligation,
      });
    }
  }
  
  console.log(`Found ${liquidationOpportunities.length} liquidation opportunities`);
  return liquidationOpportunities;
}

async function checkObligationHealth(obligation: any): Promise<boolean> {
  // Refresh obligation to get latest state
  let totalCollateralValue = 0;
  let unhealthyBorrowValue = 0;
  
  for (const deposit of obligation.deposits) {
    const reserve = await program.account.reserve.fetch(deposit.depositReserve);
    totalCollateralValue += calculateCollateralValue(deposit, reserve);
  }
  
  for (const borrow of obligation.borrows) {
    const reserve = await program.account.reserve.fetch(borrow.borrowReserve);
    const liquidationThreshold = reserve.config.liquidationThreshold / 100;
    unhealthyBorrowValue += totalCollateralValue * liquidationThreshold;
  }
  
  return obligation.borrowedValue < unhealthyBorrowValue;
}
```

### Performing Liquidation

```typescript
async function liquidateObligation(
  obligationPubkey: PublicKey,
  repayReservePubkey: PublicKey,
  withdrawReservePubkey: PublicKey,
  liquidationAmount: number,
  liquidatorKeypair: anchor.web3.Keypair
) {
  const repayReserve = await program.account.reserve.fetch(repayReservePubkey);
  const withdrawReserve = await program.account.reserve.fetch(withdrawReservePubkey);
  
  const [lendingMarketPda, bumpSeed] = await PublicKey.findProgramAddress(
    [repayReserve.lendingMarket.toBytes()],
    program.programId
  );
  
  const sourceLiquidityWallet = await getAssociatedTokenAddress(
    repayReserve.liquidity.mintPubkey,
    liquidatorKeypair.publicKey
  );
  
  const destinationCollateralWallet = await getAssociatedTokenAddress(
    withdrawReserve.collateral.mintPubkey,
    liquidatorKeypair.publicKey
  );
  
  const tx = await program.rpc.liquidateObligation(
    bumpSeed,
    new anchor.BN(liquidationAmount * Math.pow(10, 6)),
    { standard: {} }, // LoanKind::Standard
    {
      accounts: {
        liquidator: liquidatorKeypair.publicKey,
        sourceLiquidityWallet,
        destinationCollateralWallet,
        repayReserve: repayReservePubkey,
        repayReserveLiquidityWallet: repayReserve.liquidity.supplyPubkey,
        withdrawReserve: withdrawReservePubkey,
        withdrawReserveCollateralWallet: await getAssociatedTokenAddress(
          withdrawReserve.collateral.mintPubkey,
          obligationPubkey
        ),
        obligation: obligationPubkey,
        lendingMarket: repayReserve.lendingMarket,
        lendingMarketPda,
        tokenProgram: TOKEN_PROGRAM_ID,
        clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
      },
      signers: [liquidatorKeypair],
    }
  );
  
  console.log(`Liquidation successful. Transaction: ${tx}`);
  return tx;
}
```

## Tutorial 5: Using Flash Loans

Learn how to use flash loans for arbitrage and other strategies.

### Basic Flash Loan

```typescript
async function executeFlashLoan(
  reservePubkey: PublicKey,
  loanAmount: number,
  targetProgramId: PublicKey,
  userKeypair: anchor.web3.Keypair
) {
  const reserve = await program.account.reserve.fetch(reservePubkey);
  const [lendingMarketPda, bumpSeed] = await PublicKey.findProgramAddress(
    [reserve.lendingMarket.toBytes()],
    program.programId
  );
  
  const liquidityMint = reserve.liquidity.mintPubkey;
  const userLiquidityWallet = await getAssociatedTokenAddress(
    liquidityMint,
    userKeypair.publicKey
  );
  
  // Data to pass to the target program
  const flashLoanData = Buffer.concat([
    Buffer.from([bumpSeed]), // First byte is bump seed
    Buffer.from(new anchor.BN(loanAmount).toArray("le", 8)), // Next 8 bytes is amount
    Buffer.from("Your custom data here"), // Additional data
  ]);
  
  const tx = await program.rpc.flashLoan(
    bumpSeed,
    new anchor.BN(loanAmount * Math.pow(10, 6)),
    flashLoanData,
    {
      accounts: {
        sourceLiquidityWallet: reserve.liquidity.supplyPubkey,
        destinationLiquidityWallet: userLiquidityWallet,
        reserve: reservePubkey,
        feeReceiver: reserve.liquidity.feeReceiver,
        lendingMarket: reserve.lendingMarket,
        lendingMarketPda,
        tokenProgram: TOKEN_PROGRAM_ID,
        flashLoanReceiverProgram: targetProgramId,
        clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
      },
      remainingAccounts: [
        // Additional accounts for the target program
      ],
      signers: [userKeypair],
    }
  );
  
  console.log(`Flash loan executed. Transaction: ${tx}`);
  return tx;
}
```

## Tutorial 6: Leveraged Yield Farming

Learn how to use leveraged positions for yield farming.

*Note: This feature requires integration with Aldrin AMM and is more advanced.*

### Opening a Leveraged Position

```typescript
async function openLeveragedPosition(
  obligationPubkey: PublicKey,
  reservePubkey: PublicKey,
  ammPoolPubkey: PublicKey,
  leverage: number,
  userKeypair: anchor.web3.Keypair
) {
  // This is a simplified example - actual implementation requires
  // integration with Aldrin AMM and additional setup
  
  console.log("Opening leveraged position...");
  console.log(`Leverage: ${leverage}x`);
  console.log(`Pool: ${ammPoolPubkey.toBase58()}`);
  
  // Implementation would go here
  // See the actual AMM integration endpoints for details
}
```

## Common Use Cases

### Use Case 1: Earning Yield on Stablecoins

```typescript
// Deposit USDC to earn interest
async function earnYieldOnStablecoins() {
  const usdcReserve = new PublicKey("YOUR_USDC_RESERVE_PUBKEY");
  const depositAmount = 1000; // 1000 USDC
  
  await depositLiquidity(usdcReserve, depositAmount, userKeypair);
  
  // Monitor earnings
  setInterval(async () => {
    await checkLendingPosition(usdcCollateralMint, userKeypair.publicKey);
  }, 60000); // Check every minute
}
```

### Use Case 2: Leveraging SOL Holdings

```typescript
// Use SOL as collateral to borrow USDC
async function leverageSOL() {
  const obligation = await createObligation(lendingMarket, userKeypair);
  
  // Deposit SOL collateral
  await depositCollateral(obligation, solReserve, 10, userKeypair); // 10 SOL
  
  // Borrow USDC (up to 75% LTV)
  await borrowLiquidity(obligation, usdcReserve, 750, userKeypair); // $750 USDC
  
  // Use borrowed USDC for other investments
}
```

### Use Case 3: Arbitrage with Flash Loans

```typescript
// Use flash loans for arbitrage opportunities
async function arbitrageOpportunity() {
  const flashLoanAmount = 10000; // Borrow 10k tokens
  
  // Execute flash loan with custom arbitrage logic
  await executeFlashLoan(
    reservePubkey,
    flashLoanAmount,
    arbitrageProgram.programId,
    userKeypair
  );
}
```

## Troubleshooting

### Common Errors and Solutions

#### 1. "Reserve is stale"
**Problem**: Reserve data needs to be refreshed before the operation.
**Solution**: Call `refresh_reserve` before your transaction.

```typescript
await program.rpc.refreshReserve({
  accounts: {
    reserve: reservePubkey,
    pythPrice: pythPriceAccount,
    clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
  },
});
```

#### 2. "Obligation is not healthy"
**Problem**: Your position doesn't have enough collateral for the operation.
**Solution**: Add more collateral or repay some debt.

#### 3. "Insufficient liquidity"
**Problem**: Not enough tokens available in the reserve.
**Solution**: Try a smaller amount or wait for more liquidity.

#### 4. "Flash loan not repaid"
**Problem**: Flash loan wasn't fully repaid within the transaction.
**Solution**: Ensure your flash loan callback repays the loan plus fees.

### Best Practices

1. **Always refresh** reserves and obligations before operations
2. **Monitor health factor** regularly to avoid liquidation
3. **Use appropriate slippage** for AMM operations
4. **Test with small amounts** first
5. **Keep SOL for transaction fees**

### Getting Help

- Check the [API Reference](./api-reference.md) for detailed function signatures
- Review the [main documentation](./documentation.md) for architectural details
- Look at the test files in `tests/src/` for working examples
- Join the community Discord for support

---

*This tutorial covers the most common use cases. For advanced features and integrations, refer to the complete [documentation](./documentation.md) and [API reference](./api-reference.md).*