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

Learn how to lend tokens and earn interest in the Solana Borrow-Lending Protocol. This comprehensive tutorial covers everything from basic concepts to advanced strategies.

### Overview

Lending tokens is the foundational activity in any lending protocol. When you lend tokens, you:
- Earn interest on your deposited assets
- Help provide liquidity for borrowers
- Receive collateral tokens representing your deposit
- Maintain liquidity through the ability to withdraw at any time

### Understanding Lending Mechanics

#### How Interest Accrual Works

Interest in the protocol accrues continuously based on:
- **Utilization Rate**: Percentage of deposited tokens that are borrowed
- **Interest Rate Model**: Mathematical formula determining rates
- **Time**: Interest compounds over time

**Example Calculation:**
```
Deposit: 1000 USDC
Annual Interest Rate: 8%
Daily Rate: 8% / 365 = 0.0219%
After 30 days: 1000 × (1 + 0.0219%)^30 = 1006.59 USDC
```

#### Collateral Token System

When you deposit tokens, you receive collateral tokens that:
- Represent your share of the total pool
- Appreciate in value as interest accrues
- Can be redeemed for underlying tokens plus earned interest
- Have a constantly increasing exchange rate

**Exchange Rate Formula:**
```
Exchange Rate = (Total Deposited + Interest Earned) / Total Collateral Tokens
```

### Step-by-Step Lending Guide

#### Step 1: Choose Your Asset

First, decide which token you want to lend. Consider:

**Popular Lending Assets:**
- **USDC**: Stable coin with predictable returns
- **SOL**: Native Solana token with higher volatility
- **USDT**: Alternative stable coin option
- **ETH**: Cross-chain asset with growth potential

**Factors to Consider:**
- **Risk Level**: Stable coins vs volatile assets
- **Interest Rates**: Current and historical rates
- **Liquidity**: How easily you can withdraw
- **Market Outlook**: Your view on the asset's future

#### Step 2: Check Market Conditions

Before lending, research current market conditions:

**Using the CLI:**
```bash
# Check current interest rates for USDC
solana-borrow-lending market-info \
  --market 5ZWj7a1TsYKqN1jjsxiH5xRoUakQBBT4F1SkUh9bUW7n \
  --asset USDC

# Expected output:
# USDC Reserve Information:
# Current Supply Rate: 6.5% APY
# Current Borrow Rate: 8.2% APY
# Utilization Rate: 79.3%
# Total Liquidity: $12,450,000
# Available to Borrow: $2,580,000
```

**Key Metrics to Monitor:**
- **Supply Rate**: Interest you'll earn
- **Utilization Rate**: How much is borrowed (affects rates)
- **Total Liquidity**: Size of the pool
- **Historical Performance**: Rate stability over time

#### Step 3: Prepare Your Tokens

Ensure you have:

**Sufficient Token Balance:**
```bash
# Check your USDC balance
spl-token balance EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v

# Expected output: 5000
```

**Sufficient SOL for Fees:**
```bash
# Check SOL balance (need ~0.01 SOL for transactions)
solana balance

# Expected output: 1.5 SOL
```

**Token Account Setup:**
Most wallets automatically create token accounts, but you can verify:
```bash
# List all your token accounts
spl-token accounts

# Create token account if needed
spl-token create-account EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
```

#### Step 4: Execute the Deposit

**Using the CLI:**
```bash
# Deposit 1000 USDC to start earning interest
solana-borrow-lending deposit \
  --market 5ZWj7a1TsYKqN1jjsxiH5xRoUakQBBT4F1SkUh9bUW7n \
  --reserve 8GWTTbNiXdmyZREXbjsZBmCRuzdPrW55dnZGDkTRjWvb \
  --amount 1000 \
  --wallet ./your-wallet.json \
  --rpc-url https://api.mainnet-beta.solana.com

# Successful output:
# ✅ Deposit successful!
# Transaction: 3vZ8t2KGp9...(signature)
# Deposited: 1000 USDC
# Received: 1000 cUSDC (collateral tokens)
# Current Exchange Rate: 1.000000
```

**Using TypeScript:**
```typescript
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { Program, AnchorProvider, Wallet } from '@project-serum/anchor';
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token';

async function depositTokens() {
  // Setup connection and wallet
  const connection = new Connection('https://api.mainnet-beta.solana.com');
  const wallet = new Wallet(userKeypair);
  const provider = new AnchorProvider(connection, wallet, {});
  const program = new Program(idl, programId, provider);
  
  // Asset and market configuration
  const marketAddress = new PublicKey('5ZWj7a1TsYKqN1jjsxiH5xRoUakQBBT4F1SkUh9bUW7n');
  const reserveAddress = new PublicKey('8GWTTbNiXdmyZREXbjsZBmCRuzdPrW55dnZGDkTRjWvb');
  const usdcMint = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
  const depositAmount = 1000 * 1e6; // 1000 USDC (6 decimals)
  
  try {
    // Get reserve data
    const reserveData = await program.account.reserve.fetch(reserveAddress);
    console.log(`Current supply rate: ${reserveData.currentSupplyRate * 100}%`);
    
    // Get user's token accounts
    const token = new Token(connection, usdcMint, TOKEN_PROGRAM_ID, userKeypair);
    const sourceAccount = await token.getOrCreateAssociatedAccountInfo(userKeypair.publicKey);
    
    // Get collateral token account
    const collateralMint = reserveData.collateralMint;
    const collateralToken = new Token(connection, collateralMint, TOKEN_PROGRAM_ID, userKeypair);
    const destinationAccount = await collateralToken.getOrCreateAssociatedAccountInfo(userKeypair.publicKey);
    
    // Check balance
    const balance = sourceAccount.amount.toNumber();
    if (balance < depositAmount) {
      throw new Error(`Insufficient balance. Have: ${balance / 1e6} USDC, Need: ${depositAmount / 1e6} USDC`);
    }
    
    console.log(`Depositing ${depositAmount / 1e6} USDC...`);
    
    // Execute deposit
    const signature = await program.rpc.depositReserveLiquidity(depositAmount, {
      accounts: {
        sourceLiquidity: sourceAccount.address,
        destinationCollateral: destinationAccount.address,
        reserve: reserveAddress,
        reserveLiquiditySupply: reserveData.liquidity.supply,
        reserveCollateralMint: collateralMint,
        lendingMarket: reserveData.lendingMarket,
        lendingMarketAuthority: reserveData.lendingMarketAuthority,
        userTransferAuthority: userKeypair.publicKey,
        clock: SYSVAR_CLOCK_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      signers: [userKeypair],
    });
    
    console.log(`✅ Deposit successful! Transaction: ${signature}`);
    
    // Calculate collateral tokens received
    const exchangeRate = calculateExchangeRate(reserveData);
    const collateralReceived = depositAmount / exchangeRate;
    console.log(`Received ${collateralReceived / 1e6} collateral tokens`);
    
    return signature;
  } catch (error) {
    console.error('Deposit failed:', error);
    throw error;
  }
}

function calculateExchangeRate(reserveData: any): number {
  const totalLiquidity = reserveData.liquidity.availableAmount.toNumber() + 
                        reserveData.liquidity.borrowedAmountWads.toNumber();
  const totalCollateral = reserveData.collateralMintTotalSupply.toNumber();
  
  return totalCollateral > 0 ? totalLiquidity / totalCollateral : 1;
}

// Execute the deposit
depositTokens().catch(console.error);
```

#### Step 5: Monitor Your Position

After depositing, track your earning position:

**Check Position Status:**
```bash
# View your lending position
solana-borrow-lending position \
  --wallet ./your-wallet.json \
  --market 5ZWj7a1TsYKqN1jjsxiH5xRoUakQBBT4F1SkUh9bUW7n

# Expected output:
# Your Lending Positions:
# ┌─────────────┬──────────────┬──────────────┬─────────────┬─────────────┐
# │ Asset       │ Deposited    │ Current Value│ Interest    │ APY         │
# ├─────────────┼──────────────┼──────────────┼─────────────┼─────────────┤
# │ USDC        │ 1,000.00     │ 1,006.59     │ 6.59        │ 6.5%        │
# └─────────────┴──────────────┴──────────────┴─────────────┴─────────────┘
# 
# Total Deposited Value: $1,006.59
# Total Interest Earned: $6.59
# Average APY: 6.5%
```

**Calculate Real-time Earnings:**
```typescript
async function calculateCurrentEarnings(
  program: Program,
  userWallet: PublicKey,
  reserve: PublicKey
): Promise<{
  deposited: number;
  currentValue: number;
  interestEarned: number;
  annualizedReturn: number;
}> {
  // Get reserve data
  const reserveData = await program.account.reserve.fetch(reserve);
  
  // Get user's collateral balance
  const collateralMint = reserveData.collateralMint;
  const collateralToken = new Token(connection, collateralMint, TOKEN_PROGRAM_ID, null);
  const collateralAccount = await collateralToken.getAccountInfo(
    await collateralToken.getOrCreateAssociatedAccountInfo(userWallet).address
  );
  
  // Calculate current value
  const exchangeRate = calculateExchangeRate(reserveData);
  const collateralBalance = collateralAccount.amount.toNumber();
  const currentValue = collateralBalance * exchangeRate;
  
  // Estimate original deposit (simplified)
  const deposited = collateralBalance; // Assuming 1:1 initial rate
  const interestEarned = currentValue - deposited;
  
  // Calculate annualized return
  const daysSinceDeposit = 30; // Would track actual deposit time
  const annualizedReturn = (interestEarned / deposited) * (365 / daysSinceDeposit);
  
  return {
    deposited: deposited / 1e6,
    currentValue: currentValue / 1e6,
    interestEarned: interestEarned / 1e6,
    annualizedReturn: annualizedReturn * 100,
  };
}
```

### Advanced Lending Strategies

#### Strategy 1: Dollar-Cost Averaging (DCA)

Gradually build your lending position to reduce timing risk:

```bash
# Weekly DCA script
#!/bin/bash
WEEKLY_AMOUNT=200
MARKET="5ZWj7a1TsYKqN1jjsxiH5xRoUakQBBT4F1SkUh9bUW7n"
RESERVE="8GWTTbNiXdmyZREXbjsZBmCRuzdPrW55dnZGDkTRjWvb"

echo "Executing weekly DCA deposit of $WEEKLY_AMOUNT USDC"

solana-borrow-lending deposit \
  --market $MARKET \
  --reserve $RESERVE \
  --amount $WEEKLY_AMOUNT \
  --wallet ./wallet.json \
  --rpc-url https://api.mainnet-beta.solana.com

# Schedule this script to run weekly using cron
# crontab -e
# 0 9 * * 1 /path/to/dca-deposit.sh
```

#### Strategy 2: Rate Chasing

Move funds to reserves with better rates:

```typescript
class RateOptimizer {
  async findBestRates(
    program: Program,
    markets: PublicKey[],
    asset: string
  ): Promise<Array<{
    market: PublicKey;
    reserve: PublicKey;
    supplyRate: number;
    utilizationRate: number;
    riskScore: number;
  }>> {
    const opportunities = [];
    
    for (const market of markets) {
      try {
        const reserves = await this.getMarketReserves(program, market, asset);
        
        for (const reserve of reserves) {
          const reserveData = await program.account.reserve.fetch(reserve);
          const supplyRate = reserveData.currentSupplyRate * 100;
          const utilizationRate = this.calculateUtilization(reserveData);
          const riskScore = this.assessRisk(reserveData, market);
          
          opportunities.push({
            market,
            reserve,
            supplyRate,
            utilizationRate,
            riskScore,
          });
        }
      } catch (error) {
        console.error(`Error analyzing market ${market}:`, error);
      }
    }
    
    // Sort by rate adjusted for risk
    return opportunities.sort((a, b) => {
      const scoreA = a.supplyRate * (1 - a.riskScore);
      const scoreB = b.supplyRate * (1 - b.riskScore);
      return scoreB - scoreA;
    });
  }
  
  private calculateUtilization(reserveData: any): number {
    const totalBorrows = reserveData.liquidity.borrowedAmountWads.toNumber();
    const totalLiquidity = reserveData.liquidity.availableAmount.toNumber() + totalBorrows;
    return totalBorrows / totalLiquidity;
  }
  
  private assessRisk(reserveData: any, market: PublicKey): number {
    let riskScore = 0;
    
    // High utilization increases risk
    const utilization = this.calculateUtilization(reserveData);
    if (utilization > 0.9) riskScore += 0.3;
    else if (utilization > 0.8) riskScore += 0.1;
    
    // New markets are riskier
    // (Would check market age and track record)
    
    // Oracle risk assessment
    // (Would check oracle quality and freshness)
    
    return Math.min(riskScore, 1);
  }
  
  async moveToOptimalRate(
    program: Program,
    currentReserve: PublicKey,
    targetReserve: PublicKey,
    amount: number
  ): Promise<string[]> {
    const signatures = [];
    
    // Withdraw from current position
    const withdrawSig = await this.withdrawFromReserve(program, currentReserve, amount);
    signatures.push(withdrawSig);
    
    // Wait for confirmation
    await program.provider.connection.confirmTransaction(withdrawSig);
    
    // Deposit to new position
    const depositSig = await this.depositToReserve(program, targetReserve, amount);
    signatures.push(depositSig);
    
    console.log(`Moved ${amount} tokens to better rate opportunity`);
    return signatures;
  }
}

// Usage
const optimizer = new RateOptimizer();
const opportunities = await optimizer.findBestRates(program, knownMarkets, 'USDC');
console.log('Best lending opportunities:', opportunities.slice(0, 3));
```

#### Strategy 3: Multi-Asset Diversification

Spread risk across multiple assets:

```typescript
interface DiversificationTarget {
  asset: string;
  reserve: PublicKey;
  targetPercentage: number;
  currentPercentage: number;
  minAmount: number;
}

class PortfolioDiversifier {
  async rebalancePortfolio(
    program: Program,
    targets: DiversificationTarget[],
    totalValue: number
  ): Promise<void> {
    console.log('Starting portfolio rebalancing...');
    
    for (const target of targets) {
      const targetAmount = totalValue * target.targetPercentage;
      const currentAmount = totalValue * target.currentPercentage;
      const difference = targetAmount - currentAmount;
      
      if (Math.abs(difference) > target.minAmount) {
        if (difference > 0) {
          // Need to increase allocation
          console.log(`Increasing ${target.asset} by ${difference}`);
          await this.increaseAllocation(program, target.reserve, difference);
        } else {
          // Need to decrease allocation
          console.log(`Decreasing ${target.asset} by ${Math.abs(difference)}`);
          await this.decreaseAllocation(program, target.reserve, Math.abs(difference));
        }
      }
    }
    
    console.log('Portfolio rebalancing complete');
  }
  
  private async increaseAllocation(
    program: Program,
    reserve: PublicKey,
    amount: number
  ): Promise<void> {
    // Implementation would deposit to the reserve
    // Could involve moving funds from other reserves or external sources
  }
  
  private async decreaseAllocation(
    program: Program,
    reserve: PublicKey,
    amount: number
  ): Promise<void> {
    // Implementation would withdraw from the reserve
    // Could involve redistributing to other reserves
  }
}

// Example target allocation
const diversificationTargets: DiversificationTarget[] = [
  {
    asset: 'USDC',
    reserve: new PublicKey('8GWTTbNiXdmyZREXbjsZBmCRuzdPrW55dnZGDkTRjWvb'),
    targetPercentage: 0.4, // 40%
    currentPercentage: 0.5, // Currently 50%
    minAmount: 100, // Only rebalance if difference > $100
  },
  {
    asset: 'SOL',
    reserve: new PublicKey('5ZWj7a1TsYKqN1jjsxiH5xRoUakQBBT4F1SkUh9bUW7n'),
    targetPercentage: 0.3, // 30%
    currentPercentage: 0.2, // Currently 20%
    minAmount: 0.5, // Min 0.5 SOL
  },
  {
    asset: 'USDT',
    reserve: new PublicKey('7dWfGaaXi9fJHN1Hm7pSb3w9s4Qb5nE8kL4xR2pM3Qd9'),
    targetPercentage: 0.3, // 30%
    currentPercentage: 0.3, // Currently 30% - balanced
    minAmount: 100,
  },
];

const diversifier = new PortfolioDiversifier();
await diversifier.rebalancePortfolio(program, diversificationTargets, 10000);
```

### Risk Management for Lenders

#### Understanding Lending Risks

**Smart Contract Risk:**
- Protocol bugs or vulnerabilities
- Upgrade risks and governance decisions
- Integration risks with external protocols

**Market Risk:**
- Interest rate volatility
- Asset price fluctuations affecting demand
- Liquidity crunches during market stress

**Operational Risk:**
- Oracle failures affecting interest calculations
- Network congestion preventing withdrawals
- Key management and wallet security

#### Risk Mitigation Strategies

**1. Diversification by Protocol:**
```typescript
interface ProtocolAllocation {
  protocol: string;
  markets: PublicKey[];
  allocation: number;
  riskRating: 'A' | 'B' | 'C';
}

const protocolDiversification: ProtocolAllocation[] = [
  {
    protocol: 'Solend',
    markets: [new PublicKey('...')],
    allocation: 0.4, // 40% allocation
    riskRating: 'A', // Established protocol
  },
  {
    protocol: 'Mango Markets',
    markets: [new PublicKey('...')],
    allocation: 0.35, // 35% allocation
    riskRating: 'A',
  },
  {
    protocol: 'Our Protocol',
    markets: [new PublicKey('5ZWj7a1TsYKqN1jjsxiH5xRoUakQBBT4F1SkUh9bUW7n')],
    allocation: 0.25, // 25% allocation
    riskRating: 'B', // Newer protocol
  },
];
```

**2. Liquidity Monitoring:**
```typescript
class LiquidityMonitor {
  async checkWithdrawalCapacity(
    program: Program,
    reserve: PublicKey,
    amount: number
  ): Promise<{
    canWithdraw: boolean;
    availableLiquidity: number;
    utilizationRate: number;
    estimatedWaitTime?: number;
  }> {
    const reserveData = await program.account.reserve.fetch(reserve);
    const availableLiquidity = reserveData.liquidity.availableAmount.toNumber();
    const totalBorrows = reserveData.liquidity.borrowedAmountWads.toNumber();
    const totalLiquidity = availableLiquidity + totalBorrows;
    const utilizationRate = totalBorrows / totalLiquidity;
    
    const canWithdraw = amount <= availableLiquidity;
    let estimatedWaitTime: number | undefined;
    
    if (!canWithdraw) {
      // Estimate time for liquidity to become available
      // Based on historical repayment patterns
      estimatedWaitTime = this.estimateWaitTime(utilizationRate, amount - availableLiquidity);
    }
    
    return {
      canWithdraw,
      availableLiquidity: availableLiquidity / 1e6,
      utilizationRate,
      estimatedWaitTime,
    };
  }
  
  private estimateWaitTime(utilizationRate: number, shortfall: number): number {
    // Simple estimation based on utilization rate
    if (utilizationRate > 0.95) return 7; // 7 days for very high utilization
    if (utilizationRate > 0.9) return 3; // 3 days for high utilization
    if (utilizationRate > 0.8) return 1; // 1 day for moderate utilization
    return 0.5; // Half day for normal utilization
  }
  
  async setupLiquidityAlerts(
    program: Program,
    reserves: PublicKey[],
    thresholds: { warning: number; critical: number }
  ): Promise<void> {
    setInterval(async () => {
      for (const reserve of reserves) {
        try {
          const reserveData = await program.account.reserve.fetch(reserve);
          const utilization = this.calculateUtilization(reserveData);
          
          if (utilization > thresholds.critical) {
            console.error(`🚨 CRITICAL: ${reserve} utilization at ${(utilization * 100).toFixed(1)}%`);
            // Send alert notification
          } else if (utilization > thresholds.warning) {
            console.warn(`⚠️  WARNING: ${reserve} utilization at ${(utilization * 100).toFixed(1)}%`);
          }
        } catch (error) {
          console.error(`Error monitoring ${reserve}:`, error);
        }
      }
    }, 300000); // Check every 5 minutes
  }
  
  private calculateUtilization(reserveData: any): number {
    const totalBorrows = reserveData.liquidity.borrowedAmountWads.toNumber();
    const totalLiquidity = reserveData.liquidity.availableAmount.toNumber() + totalBorrows;
    return totalBorrows / totalLiquidity;
  }
}

// Setup monitoring
const liquidityMonitor = new LiquidityMonitor();
await liquidityMonitor.setupLiquidityAlerts(
  program,
  [usdcReserve, solReserve, usdtReserve],
  { warning: 0.85, critical: 0.95 }
);
```

**3. Interest Rate Protection:**
```typescript
class RateProtection {
  async implementRateFloor(
    program: Program,
    positions: Array<{ reserve: PublicKey; amount: number }>,
    minimumRate: number
  ): Promise<void> {
    console.log(`Protecting positions with ${minimumRate}% minimum rate`);
    
    for (const position of positions) {
      const reserveData = await program.account.reserve.fetch(position.reserve);
      const currentRate = reserveData.currentSupplyRate * 100;
      
      if (currentRate < minimumRate) {
        console.log(`Rate ${currentRate}% below minimum, moving position`);
        await this.moveToFixedRate(program, position.reserve, position.amount);
      }
    }
  }
  
  private async moveToFixedRate(
    program: Program,
    reserve: PublicKey,
    amount: number
  ): Promise<void> {
    // Implementation would move funds to a fixed-rate product
    // or hedge with interest rate derivatives
    console.log(`Moving ${amount} to fixed rate alternative`);
  }
  
  async trackRateVolatility(
    program: Program,
    reserve: PublicKey,
    days: number = 30
  ): Promise<{
    averageRate: number;
    volatility: number;
    minRate: number;
    maxRate: number;
  }> {
    // Implementation would fetch historical rate data
    // and calculate volatility metrics
    return {
      averageRate: 6.5,
      volatility: 0.15, // 15% volatility
      minRate: 5.2,
      maxRate: 8.1,
    };
  }
}
```

### Withdrawal Strategies

#### Strategy 1: Systematic Withdrawal

Set up regular withdrawals for income:

```bash
# Monthly withdrawal script
#!/bin/bash
MONTHLY_AMOUNT=500
MARKET="5ZWj7a1TsYKqN1jjsxiH5xRoUakQBBT4F1SkUh9bUW7n"
RESERVE="8GWTTbNiXdmyZREXbjsZBmCRuzdPrW55dnZGDkTRjWvb"

echo "Executing monthly withdrawal of $MONTHLY_AMOUNT USDC"

# Check if sufficient funds available
AVAILABLE=$(solana-borrow-lending reserve-info --reserve $RESERVE --field available_liquidity)

if (( $(echo "$AVAILABLE >= $MONTHLY_AMOUNT" | bc -l) )); then
  solana-borrow-lending withdraw \
    --market $MARKET \
    --reserve $RESERVE \
    --amount $MONTHLY_AMOUNT \
    --wallet ./wallet.json \
    --rpc-url https://api.mainnet-beta.solana.com
    
  echo "✅ Monthly withdrawal successful"
else
  echo "❌ Insufficient liquidity for withdrawal. Available: $AVAILABLE"
fi
```

#### Strategy 2: Interest-Only Withdrawal

Withdraw only earned interest, keeping principal invested:

```typescript
class InterestHarvester {
  async harvestInterest(
    program: Program,
    userWallet: PublicKey,
    reserves: PublicKey[]
  ): Promise<void> {
    console.log('Harvesting accrued interest...');
    
    for (const reserve of reserves) {
      try {
        const earnings = await this.calculateAccruedInterest(program, userWallet, reserve);
        
        if (earnings.interestEarned > 0.01) { // Only harvest if > $0.01
          console.log(`Harvesting ${earnings.interestEarned} from ${reserve}`);
          
          // Calculate collateral tokens to redeem for interest amount
          const collateralToRedeem = earnings.interestEarned / earnings.exchangeRate;
          
          await this.withdrawCollateral(program, reserve, collateralToRedeem);
        }
      } catch (error) {
        console.error(`Error harvesting from ${reserve}:`, error);
      }
    }
  }
  
  private async calculateAccruedInterest(
    program: Program,
    userWallet: PublicKey,
    reserve: PublicKey
  ): Promise<{
    originalDeposit: number;
    currentValue: number;
    interestEarned: number;
    exchangeRate: number;
  }> {
    // Get current position value
    const reserveData = await program.account.reserve.fetch(reserve);
    const exchangeRate = this.calculateExchangeRate(reserveData);
    
    // Get user's collateral balance
    const collateralBalance = await this.getCollateralBalance(userWallet, reserveData.collateralMint);
    const currentValue = collateralBalance * exchangeRate;
    
    // Retrieve original deposit amount (would store this during deposit)
    const originalDeposit = await this.getOriginalDeposit(userWallet, reserve);
    const interestEarned = currentValue - originalDeposit;
    
    return {
      originalDeposit,
      currentValue,
      interestEarned,
      exchangeRate,
    };
  }
  
  private async withdrawCollateral(
    program: Program,
    reserve: PublicKey,
    amount: number
  ): Promise<string> {
    // Implementation of collateral withdrawal
    return "transaction_signature";
  }
  
  private calculateExchangeRate(reserveData: any): number {
    const totalLiquidity = reserveData.liquidity.availableAmount.toNumber() + 
                          reserveData.liquidity.borrowedAmountWads.toNumber();
    const totalCollateral = reserveData.collateralMintTotalSupply.toNumber();
    
    return totalCollateral > 0 ? totalLiquidity / totalCollateral : 1;
  }
  
  private async getCollateralBalance(wallet: PublicKey, mint: PublicKey): Promise<number> {
    // Implementation to get user's collateral token balance
    return 0;
  }
  
  private async getOriginalDeposit(wallet: PublicKey, reserve: PublicKey): Promise<number> {
    // Implementation to retrieve original deposit amount
    // This would need to be stored during initial deposit
    return 0;
  }
}

// Usage
const harvester = new InterestHarvester();
await harvester.harvestInterest(program, userWallet, [usdcReserve, solReserve]);
```

### Performance Tracking and Analytics

#### Comprehensive Performance Dashboard

```typescript
interface PerformanceMetrics {
  totalDeposited: number;
  currentValue: number;
  totalInterestEarned: number;
  realizedGains: number;
  unrealizedGains: number;
  averageAPY: number;
  bestAPY: number;
  worstAPY: number;
  timeWeightedReturn: number;
  sharpeRatio: number;
}

class PerformanceTracker {
  async generateReport(
    program: Program,
    userWallet: PublicKey,
    startDate: Date,
    endDate: Date
  ): Promise<PerformanceMetrics> {
    const positions = await this.getUserPositions(program, userWallet);
    const transactions = await this.getTransactionHistory(userWallet, startDate, endDate);
    
    let totalDeposited = 0;
    let currentValue = 0;
    let totalInterestEarned = 0;
    let realizedGains = 0;
    
    // Calculate metrics for each position
    for (const position of positions) {
      const positionMetrics = await this.calculatePositionMetrics(
        program,
        position,
        transactions.filter(tx => tx.reserve.equals(position.reserve))
      );
      
      totalDeposited += positionMetrics.deposited;
      currentValue += positionMetrics.currentValue;
      totalInterestEarned += positionMetrics.interestEarned;
      realizedGains += positionMetrics.realizedGains;
    }
    
    const unrealizedGains = currentValue - totalDeposited;
    const totalReturn = (currentValue + realizedGains - totalDeposited) / totalDeposited;
    const daysPeriod = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    const annualizedReturn = (totalReturn + 1) ** (365 / daysPeriod) - 1;
    
    return {
      totalDeposited,
      currentValue,
      totalInterestEarned,
      realizedGains,
      unrealizedGains,
      averageAPY: annualizedReturn * 100,
      bestAPY: await this.getBestHistoricalAPY(positions),
      worstAPY: await this.getWorstHistoricalAPY(positions),
      timeWeightedReturn: await this.calculateTimeWeightedReturn(transactions),
      sharpeRatio: await this.calculateSharpeRatio(transactions),
    };
  }
  
  async generateDetailedReport(
    program: Program,
    userWallet: PublicKey
  ): Promise<void> {
    const report = await this.generateReport(
      program,
      userWallet,
      new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year ago
      new Date()
    );
    
    console.log('\n📊 LENDING PERFORMANCE REPORT');
    console.log('════════════════════════════════════════');
    console.log(`💰 Total Deposited: $${report.totalDeposited.toLocaleString()}`);
    console.log(`📈 Current Value: $${report.currentValue.toLocaleString()}`);
    console.log(`💵 Interest Earned: $${report.totalInterestEarned.toLocaleString()}`);
    console.log(`🎯 Average APY: ${report.averageAPY.toFixed(2)}%`);
    console.log(`⬆️  Best APY: ${report.bestAPY.toFixed(2)}%`);
    console.log(`⬇️  Worst APY: ${report.worstAPY.toFixed(2)}%`);
    console.log(`📊 Sharpe Ratio: ${report.sharpeRatio.toFixed(2)}`);
    console.log(`💎 Total Return: ${((report.currentValue / report.totalDeposited - 1) * 100).toFixed(2)}%`);
    console.log('════════════════════════════════════════\n');
    
    // Generate position breakdown
    await this.generatePositionBreakdown(program, userWallet);
  }
  
  private async generatePositionBreakdown(
    program: Program,
    userWallet: PublicKey
  ): Promise<void> {
    console.log('🔍 POSITION BREAKDOWN');
    console.log('────────────────────────────────────────');
    
    const positions = await this.getUserPositions(program, userWallet);
    
    for (const position of positions) {
      const reserveData = await program.account.reserve.fetch(position.reserve);
      const currentRate = reserveData.currentSupplyRate * 100;
      const utilization = this.calculateUtilization(reserveData);
      
      console.log(`\n💱 ${position.asset}`);
      console.log(`   Deposited: ${position.deposited.toLocaleString()} ${position.asset}`);
      console.log(`   Current Value: $${position.currentValue.toLocaleString()}`);
      console.log(`   Current APY: ${currentRate.toFixed(2)}%`);
      console.log(`   Utilization: ${(utilization * 100).toFixed(1)}%`);
      console.log(`   P&L: $${(position.currentValue - position.depositedValue).toLocaleString()}`);
    }
  }
  
  private async getUserPositions(
    program: Program,
    userWallet: PublicKey
  ): Promise<Array<{
    reserve: PublicKey;
    asset: string;
    deposited: number;
    currentValue: number;
    depositedValue: number;
  }>> {
    // Implementation would scan user's collateral token accounts
    // and calculate positions
    return [];
  }
  
  private async getTransactionHistory(
    userWallet: PublicKey,
    startDate: Date,
    endDate: Date
  ): Promise<Array<{
    signature: string;
    type: 'deposit' | 'withdraw';
    amount: number;
    reserve: PublicKey;
    timestamp: Date;
  }>> {
    // Implementation would fetch transaction history from chain
    return [];
  }
  
  private calculateUtilization(reserveData: any): number {
    const totalBorrows = reserveData.liquidity.borrowedAmountWads.toNumber();
    const totalLiquidity = reserveData.liquidity.availableAmount.toNumber() + totalBorrows;
    return totalBorrows / totalLiquidity;
  }
  
  private async calculatePositionMetrics(
    program: Program,
    position: any,
    transactions: any[]
  ): Promise<{
    deposited: number;
    currentValue: number;
    interestEarned: number;
    realizedGains: number;
  }> {
    // Implementation would calculate detailed position metrics
    return {
      deposited: 0,
      currentValue: 0,
      interestEarned: 0,
      realizedGains: 0,
    };
  }
  
  private async getBestHistoricalAPY(positions: any[]): Promise<number> {
    // Implementation would track historical APY data
    return 0;
  }
  
  private async getWorstHistoricalAPY(positions: any[]): Promise<number> {
    // Implementation would track historical APY data
    return 0;
  }
  
  private async calculateTimeWeightedReturn(transactions: any[]): Promise<number> {
    // Implementation would calculate time-weighted returns
    return 0;
  }
  
  private async calculateSharpeRatio(transactions: any[]): Promise<number> {
    // Implementation would calculate risk-adjusted returns
    return 0;
  }
}

// Usage
const tracker = new PerformanceTracker();
await tracker.generateDetailedReport(program, userWallet);
```

### Tax Implications and Record Keeping

#### Tax Considerations

**Interest Income:**
- Interest earned from lending is generally taxable as ordinary income
- Must be reported when earned, not when withdrawn
- Keep detailed records of daily accruals

**Realized vs Unrealized Gains:**
- Withdrawing interest = realized taxable income
- Accrued but not withdrawn = unrealized (may still be taxable)
- Consult tax professional for specific jurisdiction rules

#### Record Keeping System

```typescript
interface TaxRecord {
  date: Date;
  type: 'deposit' | 'withdraw' | 'interest_accrual';
  asset: string;
  amount: number;
  valueUSD: number;
  transactionHash: string;
  reserve: PublicKey;
}

class TaxRecordKeeper {
  private records: TaxRecord[] = [];
  
  async trackDeposit(
    asset: string,
    amount: number,
    valueUSD: number,
    transactionHash: string,
    reserve: PublicKey
  ): Promise<void> {
    this.records.push({
      date: new Date(),
      type: 'deposit',
      asset,
      amount,
      valueUSD,
      transactionHash,
      reserve,
    });
    
    await this.saveRecords();
  }
  
  async trackWithdrawal(
    asset: string,
    amount: number,
    valueUSD: number,
    transactionHash: string,
    reserve: PublicKey
  ): Promise<void> {
    this.records.push({
      date: new Date(),
      type: 'withdraw',
      asset,
      amount,
      valueUSD,
      transactionHash,
      reserve,
    });
    
    await this.saveRecords();
  }
  
  async trackDailyInterest(
    program: Program,
    userWallet: PublicKey
  ): Promise<void> {
    const positions = await this.getUserPositions(program, userWallet);
    
    for (const position of positions) {
      const dailyInterest = await this.calculateDailyInterest(program, position);
      
      if (dailyInterest > 0) {
        this.records.push({
          date: new Date(),
          type: 'interest_accrual',
          asset: position.asset,
          amount: dailyInterest,
          valueUSD: dailyInterest * position.price,
          transactionHash: 'ACCRUAL',
          reserve: position.reserve,
        });
      }
    }
    
    await this.saveRecords();
  }
  
  generateTaxReport(year: number): {
    totalInterest: number;
    totalWithdrawals: number;
    totalDeposits: number;
    records: TaxRecord[];
  } {
    const yearRecords = this.records.filter(
      record => record.date.getFullYear() === year
    );
    
    const totalInterest = yearRecords
      .filter(r => r.type === 'interest_accrual')
      .reduce((sum, r) => sum + r.valueUSD, 0);
    
    const totalWithdrawals = yearRecords
      .filter(r => r.type === 'withdraw')
      .reduce((sum, r) => sum + r.valueUSD, 0);
    
    const totalDeposits = yearRecords
      .filter(r => r.type === 'deposit')
      .reduce((sum, r) => sum + r.valueUSD, 0);
    
    return {
      totalInterest,
      totalWithdrawals,
      totalDeposits,
      records: yearRecords,
    };
  }
  
  exportToCSV(year: number): string {
    const report = this.generateTaxReport(year);
    const header = 'Date,Type,Asset,Amount,Value USD,Transaction Hash,Reserve\n';
    
    const rows = report.records.map(record => 
      `${record.date.toISOString().split('T')[0]},` +
      `${record.type},` +
      `${record.asset},` +
      `${record.amount},` +
      `${record.valueUSD},` +
      `${record.transactionHash},` +
      `${record.reserve.toString()}`
    ).join('\n');
    
    return header + rows;
  }
  
  private async saveRecords(): Promise<void> {
    // Implementation would save to persistent storage
    localStorage.setItem('taxRecords', JSON.stringify(this.records));
  }
  
  private async loadRecords(): Promise<void> {
    // Implementation would load from persistent storage
    const saved = localStorage.getItem('taxRecords');
    if (saved) {
      this.records = JSON.parse(saved);
    }
  }
  
  private async getUserPositions(program: Program, userWallet: PublicKey): Promise<any[]> {
    // Implementation would get user positions
    return [];
  }
  
  private async calculateDailyInterest(program: Program, position: any): Promise<number> {
    // Implementation would calculate daily interest accrual
    return 0;
  }
}

// Usage
const taxKeeper = new TaxRecordKeeper();

// Track transactions
await taxKeeper.trackDeposit('USDC', 1000, 1000, '3vZ8t2KGp9...', usdcReserve);

// Generate tax report
const taxReport2024 = taxKeeper.generateTaxReport(2024);
console.log(`Total taxable interest for 2024: $${taxReport2024.totalInterest}`);

// Export for tax filing
const csvData = taxKeeper.exportToCSV(2024);
console.log('Tax records CSV:\n', csvData);
```

### Troubleshooting Common Issues

#### Issue 1: Transaction Failures

**Symptom:** Deposit transactions fail with various errors

**Common Causes & Solutions:**

```typescript
class TroubleshootingGuide {
  async diagnoseProblem(error: any, operation: string): Promise<string[]> {
    const suggestions: string[] = [];
    
    if (error.message.includes('insufficient funds')) {
      suggestions.push('Check SOL balance for transaction fees');
      suggestions.push('Verify token balance is sufficient');
      suggestions.push('Consider transaction fee estimation');
    }
    
    if (error.message.includes('stale')) {
      suggestions.push('Refresh reserve accounts before retrying');
      suggestions.push('Wait a few seconds and try again');
      suggestions.push('Check network status');
    }
    
    if (error.message.includes('slippage')) {
      suggestions.push('Reduce transaction amount');
      suggestions.push('Try again when network is less congested');
      suggestions.push('Increase slippage tolerance if available');
    }
    
    if (error.code === 6001) { // Math overflow
      suggestions.push('Reduce deposit/withdrawal amount');
      suggestions.push('Check for reasonable decimal precision');
      suggestions.push('Verify amount is within protocol limits');
    }
    
    if (error.code === 6021) { // Reserve stale
      suggestions.push('Call refresh_reserve instruction first');
      suggestions.push('Use automatic refresh in SDK');
      suggestions.push('Check oracle price feed status');
    }
    
    return suggestions;
  }
  
  async autoRecovery(
    program: Program,
    operation: () => Promise<any>,
    maxRetries: number = 3
  ): Promise<any> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        console.log(`Attempt ${attempt} failed:`, error.message);
        
        if (attempt === maxRetries) {
          const suggestions = await this.diagnoseProblem(error, 'operation');
          console.log('Suggested solutions:');
          suggestions.forEach((suggestion, i) => {
            console.log(`  ${i + 1}. ${suggestion}`);
          });
          throw error;
        }
        
        // Auto-recovery strategies
        if (error.code === 6021 || error.code === 6022) {
          console.log('Attempting automatic refresh...');
          await this.refreshAccounts(program);
        }
        
        // Wait before retry with exponential backoff
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }
  
  private async refreshAccounts(program: Program): Promise<void> {
    // Implementation would refresh stale accounts
    console.log('Refreshed stale accounts');
  }
}

// Usage
const troubleshooter = new TroubleshootingGuide();

await troubleshooter.autoRecovery(program, async () => {
  return await depositTokens(); // Your operation here
}, 3);
```

#### Issue 2: Low Interest Rates

**Analysis & Solutions:**

```bash
# Check market conditions
solana-borrow-lending market-analysis \
  --market 5ZWj7a1TsYKqN1jjsxiH5xRoUakQBBT4F1SkUh9bUW7n

# Expected output showing utilization and rate trends
# Low rates often mean:
# - Low utilization (few borrowers)
# - High liquidity supply
# - Market-wide rate environment

# Solutions:
# 1. Switch to higher-yield assets
# 2. Consider other protocols
# 3. Wait for market conditions to improve
# 4. Use rate optimization strategies
```

#### Issue 3: Unable to Withdraw

**Diagnostic Steps:**

```typescript
async function diagnoseWithdrawalIssue(
  program: Program,
  reserve: PublicKey,
  requestedAmount: number
): Promise<void> {
  console.log('🔍 Diagnosing withdrawal issue...\n');
  
  // Check reserve liquidity
  const reserveData = await program.account.reserve.fetch(reserve);
  const availableLiquidity = reserveData.liquidity.availableAmount.toNumber() / 1e6;
  
  console.log(`Available Liquidity: ${availableLiquidity.toLocaleString()} tokens`);
  console.log(`Requested Amount: ${(requestedAmount / 1e6).toLocaleString()} tokens`);
  
  if (requestedAmount / 1e6 > availableLiquidity) {
    console.log('❌ Issue: Insufficient liquidity in reserve');
    console.log(`💡 Solution: Reduce amount to ${availableLiquidity.toLocaleString()} or less`);
    
    const utilization = this.calculateUtilization(reserveData);
    console.log(`📊 Current utilization: ${(utilization * 100).toFixed(1)}%`);
    
    if (utilization > 0.95) {
      console.log('🔥 High utilization - may need to wait for repayments');
    }
    return;
  }
  
  // Check user balance
  const userBalance = await this.getUserCollateralBalance(
    program.provider.connection,
    userWallet,
    reserveData.collateralMint
  );
  
  console.log(`Your Collateral Balance: ${(userBalance / 1e6).toLocaleString()} tokens`);
  
  if (requestedAmount > userBalance) {
    console.log('❌ Issue: Insufficient collateral token balance');
    console.log(`💡 Solution: Reduce amount to ${(userBalance / 1e6).toLocaleString()} or less`);
    return;
  }
  
  // Check for other constraints
  console.log('✅ Basic checks passed - issue may be temporary');
  console.log('💡 Suggestions:');
  console.log('   1. Refresh reserve and try again');
  console.log('   2. Check network congestion');
  console.log('   3. Verify wallet connection');
  console.log('   4. Try smaller amount first');
}
```

### Summary

This comprehensive tutorial covered:

1. **Basic Lending Operations** - How to deposit tokens and earn interest
2. **Advanced Strategies** - DCA, rate chasing, diversification
3. **Risk Management** - Understanding and mitigating lending risks
4. **Withdrawal Strategies** - Different approaches to accessing funds
5. **Performance Tracking** - Monitoring and analyzing returns
6. **Tax Considerations** - Record keeping and reporting
7. **Troubleshooting** - Common issues and solutions

Key takeaways for successful lending:
- Start with stable assets and conservative amounts
- Diversify across assets and potentially protocols
- Monitor rates and market conditions regularly
- Keep detailed records for performance and tax purposes
- Understand the risks and have exit strategies
- Stay informed about protocol updates and market changes

Remember that lending in DeFi carries smart contract risk, market risk, and operational risk. Never invest more than you can afford to lose, and always do your own research before participating in any protocol.

---

## Tutorial 2: Borrowing Against Collateral

Learn how to borrow liquidity against your deposited collateral, understand health factors, and manage borrowing risks effectively.

### Overview

Borrowing against collateral is one of the most powerful features of DeFi lending protocols. It allows you to:
- Access liquidity without selling your assets
- Maintain exposure to potential asset appreciation
- Leverage your positions for additional investment opportunities
- Optimize capital efficiency across your portfolio

### Understanding Borrowing Mechanics

#### Collateral-Based Lending

The protocol uses a collateral-based system where:
- **Collateral**: Assets you deposit to secure loans
- **Loan-to-Value (LTV)**: Maximum percentage you can borrow against collateral value
- **Health Factor**: Safety measure indicating liquidation risk
- **Interest**: Cost of borrowing that accrues over time

#### Health Factor Calculation

The health factor determines your position's safety:

```
Health Factor = Total Collateral Value / Total Borrowed Value

Where:
- Health Factor > 1.0 = Safe position
- Health Factor = 1.0 = At liquidation threshold  
- Health Factor < 1.0 = Subject to liquidation
```

**Example:**
```
Collateral: 1000 USDC (worth $1,000)
LTV Ratio: 75%
Max Borrow: $750
Borrowed: $600
Health Factor: $1,000 / $600 = 1.67 (Safe)
```

#### Interest Rate Models

Borrowing costs are determined by:
- **Base Rate**: Minimum interest rate
- **Utilization Rate**: Percentage of reserves being borrowed
- **Rate Slope**: How quickly rates increase with utilization

```
Borrow Rate = Base Rate + (Utilization Rate × Rate Slope)

Example:
Base Rate: 2%
Utilization: 80%
Rate Slope: 0.1
Borrow Rate: 2% + (80% × 0.1) = 10%
```

### Step-by-Step Borrowing Guide

#### Step 1: Deposit Collateral

Before borrowing, you need collateral in the protocol:

**Option A: Fresh Deposit**
```bash
# Deposit USDC as collateral
solana-borrow-lending deposit \
  --market 5ZWj7a1TsYKqN1jjsxiH5xRoUakQBBT4F1SkUh9bUW7n \
  --reserve 8GWTTbNiXdmyZREXbjsZBmCRuzdPrW55dnZGDkTRjWvb \
  --amount 2000 \
  --wallet ./wallet.json
```

**Option B: Use Existing Deposits**
```bash
# Check existing collateral deposits
solana-borrow-lending position \
  --wallet ./wallet.json \
  --market 5ZWj7a1TsYKqN1jjsxiH5xRoUakQBBT4F1SkUh9bUW7n
```

#### Step 2: Create an Obligation

An obligation tracks your borrowing positions:

```bash
# Create new obligation account
solana-borrow-lending init-obligation \
  --market 5ZWj7a1TsYKqN1jjsxiH5xRoUakQBBT4F1SkUh9bUW7n \
  --wallet ./wallet.json

# Output: Created obligation at address: 5ZWj7a1TsYKqN1jjsxiH5xRoUakQBBT4F1SkUh9bUW7n
```

#### Step 3: Move Collateral to Obligation

Transfer your collateral tokens to the obligation:

```bash
# Deposit collateral to obligation
solana-borrow-lending deposit-collateral \
  --obligation 5ZWj7a1TsYKqN1jjsxiH5xRoUakQBBT4F1SkUh9bUW7n \
  --reserve 8GWTTbNiXdmyZREXbjsZBmCRuzdPrW55dnZGDkTRjWvb \
  --amount 2000 \
  --wallet ./wallet.json

# Output:
# ✅ Collateral deposited successfully!
# Health Factor: ∞ (no debt yet)
# Available to Borrow: $1,500 (75% LTV)
```

#### Step 4: Calculate Safe Borrow Amount

Always borrow conservatively to maintain healthy positions:

```typescript
interface BorrowCalculation {
  maxBorrowValue: number;
  safeBorrowValue: number;
  recommendedAmount: number;
  healthFactorAfter: number;
}

function calculateSafeBorrow(
  collateralValue: number,
  ltvRatio: number,
  targetHealthFactor: number = 2.0
): BorrowCalculation {
  const maxBorrowValue = collateralValue * ltvRatio;
  const safeBorrowValue = collateralValue / targetHealthFactor;
  const recommendedAmount = Math.min(maxBorrowValue, safeBorrowValue);
  const healthFactorAfter = collateralValue / recommendedAmount;
  
  return {
    maxBorrowValue,
    safeBorrowValue,
    recommendedAmount,
    healthFactorAfter,
  };
}

// Example calculation
const calculation = calculateSafeBorrow(
  2000, // $2000 collateral
  0.75, // 75% LTV
  2.0   // Target 2.0x health factor
);

console.log(`Max borrowable: $${calculation.maxBorrowValue}`);      // $1500
console.log(`Safe amount: $${calculation.recommendedAmount}`);      // $1000  
console.log(`Health factor: ${calculation.healthFactorAfter}x`);    // 2.0x
```

#### Step 5: Execute the Borrow

With safe parameters calculated, execute the borrow:

```bash
# Borrow SOL against USDC collateral
solana-borrow-lending borrow \
  --obligation 5ZWj7a1TsYKqN1jjsxiH5xRoUakQBBT4F1SkUh9bUW7n \
  --reserve 7dWfGaaXi9fJHN1Hm7pSb3w9s4Qb5nE8kL4xR2pM3Qd9 \
  --amount 8 \
  --wallet ./wallet.json

# Output:
# ✅ Borrow successful!
# Borrowed: 8 SOL (~$1000)
# Health Factor: 2.0x
# Interest Rate: 8.5% APY
# Next Payment Due: Continuous accrual
```

**Using TypeScript for More Control:**
```typescript
async function executeBorrow(
  program: Program<BorrowLending>,
  borrower: Keypair,
  obligation: PublicKey,
  borrowReserve: PublicKey,
  borrowAmount: number
): Promise<string> {
  try {
    // Pre-borrow safety checks
    const obligationData = await program.account.obligation.fetch(obligation);
    const reserveData = await program.account.reserve.fetch(borrowReserve);
    
    // Check health factor after borrow
    const collateralValue = obligationData.depositedValue.toNumber();
    const currentDebt = obligationData.collateralizedBorrowedValue.toNumber();
    const newDebt = currentDebt + borrowAmount;
    const newHealthFactor = collateralValue / newDebt;
    
    if (newHealthFactor < 1.2) {
      throw new Error(`Health factor ${newHealthFactor.toFixed(2)} too low. Minimum 1.2 recommended.`);
    }
    
    // Check reserve liquidity
    const availableLiquidity = reserveData.liquidity.availableAmount.toNumber();
    if (borrowAmount > availableLiquidity) {
      throw new Error(`Insufficient reserve liquidity. Available: ${availableLiquidity}`);
    }
    
    console.log(`Borrowing ${borrowAmount} tokens...`);
    console.log(`Health factor after: ${newHealthFactor.toFixed(2)}x`);
    
    // Get lending market PDA
    const [lendingMarketPda, bump] = await PublicKey.findProgramAddress(
      [obligationData.lendingMarket.toBuffer()],
      program.programId
    );
    
    // Get borrower's token account
    const liquidityMint = reserveData.liquidity.mint;
    const liquidityToken = new Token(
      program.provider.connection,
      liquidityMint,
      TOKEN_PROGRAM_ID,
      borrower
    );
    const destinationAccount = await liquidityToken.getOrCreateAssociatedAccountInfo(
      borrower.publicKey
    );
    
    // Execute borrow transaction
    const signature = await program.rpc.borrowObligationLiquidity(
      bump,
      borrowAmount,
      {
        accounts: {
          borrower: borrower.publicKey,
          obligation: obligation,
          reserve: borrowReserve,
          lendingMarketPda: lendingMarketPda,
          sourceLiquidityWallet: reserveData.liquidity.supply,
          destinationLiquidityWallet: destinationAccount.address,
          feeReceiver: reserveData.liquidity.feeReceiver,
          tokenProgram: TOKEN_PROGRAM_ID,
          clock: SYSVAR_CLOCK_PUBKEY,
        },
        signers: [borrower],
      }
    );
    
    console.log(`✅ Borrow successful! Transaction: ${signature}`);
    return signature;
    
  } catch (error) {
    console.error('Borrow failed:', error);
    throw error;
  }
}
```

### Managing Your Borrowing Position

#### Monitoring Health Factor

Regular monitoring prevents liquidation:

```typescript
class HealthFactorMonitor {
  private alertThresholds = {
    warning: 1.5,
    critical: 1.2,
    emergency: 1.05
  };
  
  async checkPosition(
    program: Program<BorrowLending>,
    obligation: PublicKey
  ): Promise<{
    healthFactor: number;
    riskLevel: 'safe' | 'warning' | 'critical' | 'emergency';
    recommendedActions: string[];
  }> {
    const obligationData = await program.account.obligation.fetch(obligation);
    
    const collateralValue = obligationData.depositedValue.toNumber();
    const borrowedValue = obligationData.collateralizedBorrowedValue.toNumber();
    const healthFactor = collateralValue / borrowedValue;
    
    let riskLevel: 'safe' | 'warning' | 'critical' | 'emergency';
    const recommendedActions: string[] = [];
    
    if (healthFactor >= this.alertThresholds.warning) {
      riskLevel = 'safe';
      recommendedActions.push('Continue monitoring regularly');
    } else if (healthFactor >= this.alertThresholds.critical) {
      riskLevel = 'warning';
      recommendedActions.push('Consider adding collateral');
      recommendedActions.push('Monitor more frequently');
    } else if (healthFactor >= this.alertThresholds.emergency) {
      riskLevel = 'critical';
      recommendedActions.push('Add collateral immediately');
      recommendedActions.push('Consider partial debt repayment');
      recommendedActions.push('Monitor continuously');
    } else {
      riskLevel = 'emergency';
      recommendedActions.push('URGENT: Add significant collateral');
      recommendedActions.push('Repay debt immediately');
      recommendedActions.push('Risk of imminent liquidation');
    }
    
    return {
      healthFactor,
      riskLevel,
      recommendedActions,
    };
  }
  
  async startMonitoring(
    program: Program<BorrowLending>,
    obligations: PublicKey[],
    checkInterval: number = 300000 // 5 minutes
  ): Promise<void> {
    console.log(`🏥 Starting health monitoring for ${obligations.length} positions`);
    
    setInterval(async () => {
      for (const obligation of obligations) {
        try {
          const status = await this.checkPosition(program, obligation);
          
          if (status.riskLevel !== 'safe') {
            console.log(`\n🚨 ALERT: Position ${obligation.toString().slice(0, 8)}...`);
            console.log(`Health Factor: ${status.healthFactor.toFixed(3)}x (${status.riskLevel.toUpperCase()})`);
            console.log('Recommended actions:');
            status.recommendedActions.forEach((action, i) => {
              console.log(`  ${i + 1}. ${action}`);
            });
          }
        } catch (error) {
          console.error(`Error monitoring ${obligation}:`, error);
        }
      }
    }, checkInterval);
  }
}

// Usage
const monitor = new HealthFactorMonitor();
await monitor.startMonitoring(program, [obligationAddress]);
```

#### Adding More Collateral

When health factor drops, add collateral to improve safety:

```bash
# Check current position
solana-borrow-lending position \
  --obligation 5ZWj7a1TsYKqN1jjsxiH5xRoUakQBBT4F1SkUh9bUW7n \
  --wallet ./wallet.json

# Add more USDC collateral  
solana-borrow-lending deposit-collateral \
  --obligation 5ZWj7a1TsYKqN1jjsxiH5xRoUakQBBT4F1SkUh9bUW7n \
  --reserve 8GWTTbNiXdmyZREXbjsZBmCRuzdPrW55dnZGDkTRjWvb \
  --amount 500 \
  --wallet ./wallet.json

# Result: Health factor improves from 1.2x to 1.5x
```

#### Repaying Debt

Reduce borrowing to improve health factor or close positions:

```bash
# Repay part of SOL debt
solana-borrow-lending repay \
  --obligation 5ZWj7a1TsYKqN1jjsxiH5xRoUakQBBT4F1SkUh9bUW7n \
  --reserve 7dWfGaaXi9fJHN1Hm7pSb3w9s4Qb5nE8kL4xR2pM3Qd9 \
  --amount 2 \
  --wallet ./wallet.json

# Repay all debt for a reserve
solana-borrow-lending repay-all \
  --obligation 5ZWj7a1TsYKqN1jjsxiH5xRoUakQBBT4F1SkUh9bUW7n \
  --reserve 7dWfGaaXi9fJHN1Hm7pSb3w9s4Qb5nE8kL4xR2pM3Qd9 \
  --wallet ./wallet.json
```

**Automated Repayment Strategy:**
```typescript
class AutoRepayment {
  async setupEmergencyRepayment(
    program: Program<BorrowLending>,
    obligation: PublicKey,
    reserves: Array<{ reserve: PublicKey; emergencyFunds: PublicKey }>,
    triggerHealthFactor: number = 1.15
  ): Promise<void> {
    console.log('🛡️  Setting up emergency repayment system...');
    
    setInterval(async () => {
      try {
        const obligationData = await program.account.obligation.fetch(obligation);
        const healthFactor = obligationData.depositedValue.toNumber() / 
                           obligationData.collateralizedBorrowedValue.toNumber();
        
        if (healthFactor <= triggerHealthFactor) {
          console.log(`🚨 Emergency repayment triggered! HF: ${healthFactor.toFixed(3)}`);
          await this.executeEmergencyRepayment(program, obligation, reserves);
        }
      } catch (error) {
        console.error('Emergency repayment check failed:', error);
      }
    }, 60000); // Check every minute
  }
  
  private async executeEmergencyRepayment(
    program: Program<BorrowLending>,
    obligation: PublicKey,
    reserves: Array<{ reserve: PublicKey; emergencyFunds: PublicKey }>
  ): Promise<void> {
    const obligationData = await program.account.obligation.fetch(obligation);
    
    // Find largest debt position
    let largestDebt = { reserve: null, amount: 0 };
    
    for (const borrow of obligationData.borrows) {
      if (borrow.borrowedAmountWads && borrow.borrowedAmountWads.toNumber() > largestDebt.amount) {
        largestDebt = {
          reserve: borrow.borrowReserve,
          amount: borrow.borrowedAmountWads.toNumber()
        };
      }
    }
    
    if (largestDebt.reserve) {
      // Repay 25% of largest debt
      const repayAmount = largestDebt.amount * 0.25;
      
      console.log(`Repaying ${repayAmount} from largest debt position`);
      
      // Implementation would execute actual repayment
      // using emergency funds
    }
  }
}
```

### Advanced Borrowing Strategies

#### Strategy 1: Cash and Carry

Borrow stablecoins against volatile collateral to maintain exposure:

```typescript
interface CashCarryPosition {
  collateralAsset: string;
  collateralAmount: number;
  borrowAsset: string;
  borrowAmount: number;
  healthFactor: number;
  costOfBorrow: number;
  netPosition: number;
}

class CashCarryStrategy {
  async createCashCarryPosition(
    program: Program<BorrowLending>,
    user: Keypair,
    params: {
      collateralReserve: PublicKey;
      borrowReserve: PublicKey;
      collateralAmount: number;
      borrowPercentage: number; // 0.5 = 50% of max
    }
  ): Promise<CashCarryPosition> {
    
    // Step 1: Deposit collateral
    await this.depositCollateral(
      program,
      user,
      params.collateralReserve,
      params.collateralAmount
    );
    
    // Step 2: Calculate borrow amount
    const collateralPrice = await this.getAssetPrice(params.collateralReserve);
    const collateralValue = params.collateralAmount * collateralPrice;
    const ltv = await this.getLTV(program, params.collateralReserve);
    const maxBorrow = collateralValue * ltv;
    const actualBorrow = maxBorrow * params.borrowPercentage;
    
    // Step 3: Execute borrow
    const borrowAmount = actualBorrow / await this.getAssetPrice(params.borrowReserve);
    await this.executeBorrow(program, user, params.borrowReserve, borrowAmount);
    
    // Step 4: Calculate position metrics
    const borrowRate = await this.getBorrowRate(program, params.borrowReserve);
    const healthFactor = collateralValue / actualBorrow;
    
    return {
      collateralAsset: 'SOL', // Would determine from reserve
      collateralAmount: params.collateralAmount,
      borrowAsset: 'USDC',
      borrowAmount: borrowAmount,
      healthFactor,
      costOfBorrow: borrowRate,
      netPosition: collateralValue - actualBorrow,
    };
  }
  
  async manageCashCarryPosition(
    program: Program<BorrowLending>,
    position: CashCarryPosition,
    priceChange: number
  ): Promise<void> {
    const newCollateralValue = position.collateralAmount * (1 + priceChange);
    const newHealthFactor = newCollateralValue / position.borrowAmount;
    
    console.log(`Price change: ${(priceChange * 100).toFixed(1)}%`);
    console.log(`New health factor: ${newHealthFactor.toFixed(2)}x`);
    
    if (newHealthFactor < 1.5) {
      console.log('⚠️  Health factor low, consider adding collateral');
    } else if (newHealthFactor > 3.0) {
      console.log('💰 High health factor, could borrow more or take profits');
    }
  }
  
  private async depositCollateral(
    program: Program<BorrowLending>,
    user: Keypair,
    reserve: PublicKey,
    amount: number
  ): Promise<void> {
    // Implementation
  }
  
  private async executeBorrow(
    program: Program<BorrowLending>,
    user: Keypair,
    reserve: PublicKey,
    amount: number
  ): Promise<void> {
    // Implementation
  }
  
  private async getAssetPrice(reserve: PublicKey): Promise<number> {
    // Implementation would fetch from oracle
    return 100; // Placeholder
  }
  
  private async getLTV(program: Program<BorrowLending>, reserve: PublicKey): Promise<number> {
    const reserveData = await program.account.reserve.fetch(reserve);
    return reserveData.config.loanToValueRatio / 100;
  }
  
  private async getBorrowRate(program: Program<BorrowLending>, reserve: PublicKey): Promise<number> {
    const reserveData = await program.account.reserve.fetch(reserve);
    return reserveData.currentBorrowRate;
  }
}

// Usage
const strategy = new CashCarryStrategy();
const position = await strategy.createCashCarryPosition(program, userKeypair, {
  collateralReserve: solReserve,
  borrowReserve: usdcReserve,
  collateralAmount: 10, // 10 SOL
  borrowPercentage: 0.6, // 60% of max borrowing capacity
});

console.log('Cash & Carry Position Created:');
console.log(`Collateral: ${position.collateralAmount} ${position.collateralAsset}`);
console.log(`Borrowed: ${position.borrowAmount} ${position.borrowAsset}`);
console.log(`Health Factor: ${position.healthFactor.toFixed(2)}x`);
```

#### Strategy 2: Yield Farming with Borrowed Funds

Use borrowed assets for additional yield opportunities:

```typescript
class YieldFarmingWithBorrows {
  async farmWithBorrowedFunds(
    program: Program<BorrowLending>,
    user: Keypair,
    params: {
      collateralAmount: number;
      farmingOpportunity: {
        protocol: string;
        apy: number;
        asset: string;
        minAmount: number;
      };
    }
  ): Promise<void> {
    console.log('🚜 Starting yield farming with borrowed funds...');
    
    // Step 1: Analyze profitability
    const borrowRate = 0.08; // 8% borrow rate
    const farmAPY = params.farmingOpportunity.apy;
    const netAPY = farmAPY - borrowRate;
    
    if (netAPY <= 0) {
      throw new Error(`Unprofitable: Farm APY ${farmAPY}% - Borrow Rate ${borrowRate}% = ${netAPY}%`);
    }
    
    console.log(`Expected net APY: ${(netAPY * 100).toFixed(2)}%`);
    
    // Step 2: Setup borrowing position
    const borrowAmount = params.collateralAmount * 0.75; // 75% LTV
    await this.setupBorrowingPosition(program, user, borrowAmount);
    
    // Step 3: Farm borrowed funds
    await this.deployToFarm(
      borrowAmount,
      params.farmingOpportunity.protocol,
      params.farmingOpportunity.asset
    );
    
    // Step 4: Setup monitoring
    await this.monitorFarmingPosition(program, user, {
      borrowAmount,
      farmAPY,
      borrowRate,
    });
  }
  
  private async setupBorrowingPosition(
    program: Program<BorrowLending>,
    user: Keypair,
    borrowAmount: number
  ): Promise<void> {
    // Implementation would:
    // 1. Create obligation
    // 2. Deposit collateral  
    // 3. Borrow required amount
    console.log(`Setting up borrowing position for ${borrowAmount} USDC`);
  }
  
  private async deployToFarm(
    amount: number,
    protocol: string,
    asset: string
  ): Promise<void> {
    console.log(`Deploying ${amount} ${asset} to ${protocol} farm`);
    // Implementation would integrate with external farming protocol
  }
  
  private async monitorFarmingPosition(
    program: Program<BorrowLending>,
    user: Keypair,
    position: {
      borrowAmount: number;
      farmAPY: number;
      borrowRate: number;
    }
  ): Promise<void> {
    console.log('📊 Setting up farming position monitoring...');
    
    setInterval(async () => {
      // Check health factor
      const healthCheck = await this.checkHealthFactor(program, user);
      
      // Check farming yields
      const farmingReturns = await this.checkFarmingReturns(position.borrowAmount);
      
      // Calculate current profitability
      const dailyBorrowCost = position.borrowAmount * (position.borrowRate / 365);
      const dailyFarmEarnings = farmingReturns.dailyEarnings;
      const netDailyProfit = dailyFarmEarnings - dailyBorrowCost;
      
      console.log(`Net daily profit: $${netDailyProfit.toFixed(2)}`);
      
      if (netDailyProfit < 0) {
        console.warn('⚠️  Position becoming unprofitable, consider closing');
      }
      
      if (healthCheck.healthFactor < 1.5) {
        console.warn('⚠️  Health factor low, consider reducing position');
      }
      
    }, 3600000); // Check hourly
  }
  
  private async checkHealthFactor(
    program: Program<BorrowLending>,
    user: Keypair
  ): Promise<{ healthFactor: number }> {
    // Implementation would check actual health factor
    return { healthFactor: 2.0 };
  }
  
  private async checkFarmingReturns(
    amount: number
  ): Promise<{ dailyEarnings: number }> {
    // Implementation would check actual farming returns
    return { dailyEarnings: amount * 0.0003 }; // 0.03% daily
  }
}

// Usage
const yieldFarmer = new YieldFarmingWithBorrows();
await yieldFarmer.farmWithBorrowedFunds(program, userKeypair, {
  collateralAmount: 5000, // $5000 collateral
  farmingOpportunity: {
    protocol: 'Orca',
    apy: 0.15, // 15% APY
    asset: 'USDC',
    minAmount: 1000,
  },
});
```

#### Strategy 3: Leveraged Asset Accumulation

Gradually build larger positions using borrowed funds:

```typescript
class LeveragedAccumulation {
  async accumulateAsset(
    program: Program<BorrowLending>,
    user: Keypair,
    params: {
      targetAsset: PublicKey;
      collateralAsset: PublicKey;
      targetPosition: number;
      maxLeverage: number;
      durationDays: number;
    }
  ): Promise<void> {
    console.log('📈 Starting leveraged accumulation strategy...');
    
    const strategy = this.calculateAccumulationPlan(params);
    console.log('Accumulation Plan:');
    console.log(`- Target: ${strategy.targetPosition} tokens`);
    console.log(`- Leverage: ${strategy.leverage.toFixed(2)}x`);
    console.log(`- Weekly buys: ${strategy.weeklyBuys}`);
    console.log(`- Duration: ${strategy.durationWeeks} weeks`);
    
    // Execute accumulation over time
    for (let week = 0; week < strategy.durationWeeks; week++) {
      await this.executeWeeklyAccumulation(program, user, {
        buyAmount: strategy.weeklyBuys,
        targetAsset: params.targetAsset,
        collateralAsset: params.collateralAsset,
      });
      
      console.log(`Week ${week + 1}: Accumulated ${strategy.weeklyBuys} tokens`);
      
      // Wait for next week (in production, would use scheduling)
      if (week < strategy.durationWeeks - 1) {
        console.log('Waiting for next week...');
        // await new Promise(resolve => setTimeout(resolve, 7 * 24 * 60 * 60 * 1000));
      }
    }
    
    console.log('✅ Accumulation strategy completed');
  }
  
  private calculateAccumulationPlan(params: {
    targetPosition: number;
    maxLeverage: number;
    durationDays: number;
  }): {
    targetPosition: number;
    leverage: number;
    durationWeeks: number;
    weeklyBuys: number;
  } {
    const durationWeeks = Math.ceil(params.durationDays / 7);
    const leverage = Math.min(params.maxLeverage, 2.0); // Cap at 2x for safety
    const weeklyBuys = params.targetPosition / durationWeeks;
    
    return {
      targetPosition: params.targetPosition,
      leverage,
      durationWeeks,
      weeklyBuys,
    };
  }
  
  private async executeWeeklyAccumulation(
    program: Program<BorrowLending>,
    user: Keypair,
    params: {
      buyAmount: number;
      targetAsset: PublicKey;
      collateralAsset: PublicKey;
    }
  ): Promise<void> {
    // 1. Use existing collateral to borrow funds
    const borrowAmount = params.buyAmount * 0.5; // 50% borrowed
    await this.borrowForAccumulation(program, user, borrowAmount);
    
    // 2. Use borrowed + own funds to buy target asset
    const totalBuyAmount = params.buyAmount;
    await this.purchaseTargetAsset(totalBuyAmount, params.targetAsset);
    
    // 3. Deposit purchased asset as additional collateral
    await this.depositAsCollateral(program, user, params.targetAsset, totalBuyAmount);
  }
  
  private async borrowForAccumulation(
    program: Program<BorrowLending>,
    user: Keypair,
    amount: number
  ): Promise<void> {
    console.log(`Borrowing ${amount} for accumulation`);
    // Implementation would execute actual borrow
  }
  
  private async purchaseTargetAsset(
    amount: number,
    asset: PublicKey
  ): Promise<void> {
    console.log(`Purchasing ${amount} of target asset`);
    // Implementation would use DEX to swap funds for target asset
  }
  
  private async depositAsCollateral(
    program: Program<BorrowLending>,
    user: Keypair,
    asset: PublicKey,
    amount: number
  ): Promise<void> {
    console.log(`Depositing ${amount} as collateral`);
    // Implementation would deposit to increase collateral base
  }
}

// Usage
const accumulator = new LeveragedAccumulation();
await accumulator.accumulateAsset(program, userKeypair, {
  targetAsset: solReserve,
  collateralAsset: usdcReserve,
  targetPosition: 100, // Accumulate 100 SOL
  maxLeverage: 1.5,    // Max 1.5x leverage
  durationDays: 90,    // Over 3 months
});
```

### Risk Management for Borrowers

#### Understanding Borrowing Risks

**Liquidation Risk:**
- Most immediate and severe risk
- Occurs when health factor drops below 1.0
- Results in forced sale of collateral at discount

**Interest Rate Risk:**
- Borrowing costs can increase with market conditions
- Variable rates change based on utilization
- Can impact profitability of leveraged strategies

**Market Risk:**
- Collateral value fluctuations affect health factor
- Correlated movements between collateral and borrowed assets
- Flash crashes can trigger rapid liquidations

**Smart Contract Risk:**
- Protocol bugs or exploits
- Oracle failures affecting price feeds
- Governance risks and parameter changes

#### Comprehensive Risk Mitigation

```typescript
class BorrowingRiskManager {
  private riskLimits = {
    maxHealthFactor: 5.0,  // Too high indicates inefficient capital use
    minHealthFactor: 1.5,  // Safety buffer above liquidation
    maxPositionSize: 100000, // Maximum USD value per position
    maxBorrowRate: 0.25,   // 25% maximum acceptable borrow rate
  };
  
  async assessPositionRisk(
    program: Program<BorrowLending>,
    obligation: PublicKey
  ): Promise<{
    overallRisk: 'low' | 'medium' | 'high' | 'critical';
    riskFactors: Array<{
      factor: string;
      level: string;
      impact: string;
      mitigation: string;
    }>;
    recommendedActions: string[];
  }> {
    const obligationData = await program.account.obligation.fetch(obligation);
    const riskFactors = [];
    const recommendedActions = [];
    
    // Health factor risk
    const healthFactor = obligationData.depositedValue.toNumber() / 
                        obligationData.collateralizedBorrowedValue.toNumber();
    
    if (healthFactor < this.riskLimits.minHealthFactor) {
      riskFactors.push({
        factor: 'Health Factor',
        level: healthFactor < 1.2 ? 'High' : 'Medium',
        impact: 'Liquidation risk',
        mitigation: 'Add collateral or repay debt',
      });
      recommendedActions.push('Increase health factor immediately');
    }
    
    // Concentration risk
    const concentrationRisk = await this.assessConcentrationRisk(obligationData);
    if (concentrationRisk.level !== 'Low') {
      riskFactors.push({
        factor: 'Concentration',
        level: concentrationRisk.level,
        impact: 'Correlated price movements',
        mitigation: 'Diversify collateral assets',
      });
    }
    
    // Interest rate risk
    const interestRisk = await this.assessInterestRateRisk(program, obligationData);
    if (interestRisk.level !== 'Low') {
      riskFactors.push({
        factor: 'Interest Rate',
        level: interestRisk.level,
        impact: 'Increasing borrowing costs',
        mitigation: 'Consider fixed-rate alternatives',
      });
    }
    
    // Determine overall risk
    const highRiskFactors = riskFactors.filter(f => f.level === 'High').length;
    const mediumRiskFactors = riskFactors.filter(f => f.level === 'Medium').length;
    
    let overallRisk: 'low' | 'medium' | 'high' | 'critical';
    if (healthFactor < 1.1) {
      overallRisk = 'critical';
    } else if (highRiskFactors > 0) {
      overallRisk = 'high';
    } else if (mediumRiskFactors > 1) {
      overallRisk = 'medium';
    } else {
      overallRisk = 'low';
    }
    
    return {
      overallRisk,
      riskFactors,
      recommendedActions,
    };
  }
  
  async implementRiskControls(
    program: Program<BorrowLending>,
    obligation: PublicKey,
    controls: {
      stopLoss: number;        // Health factor trigger for position closure
      autoRebalance: boolean;  // Automatic rebalancing
      alertLevels: number[];   // Health factor alert thresholds
    }
  ): Promise<void> {
    console.log('🛡️  Implementing risk controls...');
    
    setInterval(async () => {
      const riskAssessment = await this.assessPositionRisk(program, obligation);
      const obligationData = await program.account.obligation.fetch(obligation);
      const healthFactor = obligationData.depositedValue.toNumber() / 
                          obligationData.collateralizedBorrowedValue.toNumber();
      
      // Check stop loss
      if (healthFactor <= controls.stopLoss) {
        console.log('🚨 STOP LOSS TRIGGERED - Closing position');
        await this.emergencyPositionClosure(program, obligation);
        return;
      }
      
      // Check alert levels
      for (const alertLevel of controls.alertLevels) {
        if (healthFactor <= alertLevel && healthFactor > controls.stopLoss) {
          console.log(`⚠️  ALERT: Health factor ${healthFactor.toFixed(2)} below ${alertLevel}`);
          
          if (controls.autoRebalance) {
            await this.autoRebalancePosition(program, obligation, alertLevel);
          }
        }
      }
      
      // Risk level alerts
      if (riskAssessment.overallRisk === 'critical') {
        console.log('🚨 CRITICAL RISK LEVEL');
        riskAssessment.recommendedActions.forEach(action => {
          console.log(`   - ${action}`);
        });
      }
      
    }, 300000); // Check every 5 minutes
  }
  
  private async assessConcentrationRisk(obligationData: any): Promise<{
    level: 'Low' | 'Medium' | 'High';
    details: string;
  }> {
    // Analyze collateral and debt concentration
    const collateralAssets = obligationData.deposits.length;
    const debtAssets = obligationData.borrows.length;
    
    if (collateralAssets === 1 && debtAssets === 1) {
      return {
        level: 'High',
        details: 'Single asset collateral and debt concentration',
      };
    } else if (collateralAssets <= 2) {
      return {
        level: 'Medium',
        details: 'Limited collateral diversification',
      };
    } else {
      return {
        level: 'Low',
        details: 'Well diversified position',
      };
    }
  }
  
  private async assessInterestRateRisk(
    program: Program<BorrowLending>,
    obligationData: any
  ): Promise<{
    level: 'Low' | 'Medium' | 'High';
    currentRate: number;
  }> {
    // Check current borrow rates across positions
    let weightedRate = 0;
    let totalDebt = 0;
    
    for (const borrow of obligationData.borrows) {
      if (borrow.borrowedAmountWads && borrow.borrowedAmountWads.toNumber() > 0) {
        const reserveData = await program.account.reserve.fetch(borrow.borrowReserve);
        const rate = reserveData.currentBorrowRate;
        const amount = borrow.borrowedAmountWads.toNumber();
        
        weightedRate += rate * amount;
        totalDebt += amount;
      }
    }
    
    const averageRate = totalDebt > 0 ? weightedRate / totalDebt : 0;
    
    if (averageRate > this.riskLimits.maxBorrowRate) {
      return { level: 'High', currentRate: averageRate };
    } else if (averageRate > 0.15) {
      return { level: 'Medium', currentRate: averageRate };
    } else {
      return { level: 'Low', currentRate: averageRate };
    }
  }
  
  private async emergencyPositionClosure(
    program: Program<BorrowLending>,
    obligation: PublicKey
  ): Promise<void> {
    console.log('Executing emergency position closure...');
    // Implementation would:
    // 1. Repay all debts using available collateral
    // 2. Withdraw remaining collateral
    // 3. Close obligation
  }
  
  private async autoRebalancePosition(
    program: Program<BorrowLending>,
    obligation: PublicKey,
    targetHealthFactor: number
  ): Promise<void> {
    console.log(`Auto-rebalancing to ${targetHealthFactor}x health factor`);
    // Implementation would:
    // 1. Calculate required collateral addition or debt reduction
    // 2. Execute optimal rebalancing strategy
    // 3. Verify new health factor meets target
  }
}

// Usage
const riskManager = new BorrowingRiskManager();

// Assess current position risk
const riskAssessment = await riskManager.assessPositionRisk(program, obligationAddress);
console.log(`Overall risk: ${riskAssessment.overallRisk}`);
riskAssessment.riskFactors.forEach(factor => {
  console.log(`${factor.factor}: ${factor.level} - ${factor.impact}`);
});

// Implement risk controls
await riskManager.implementRiskControls(program, obligationAddress, {
  stopLoss: 1.1,           // Close position if health factor drops to 1.1
  autoRebalance: true,     // Enable automatic rebalancing
  alertLevels: [2.0, 1.5, 1.3], // Alert at these health factor levels
});
```

### Cost Management and Optimization

#### Understanding Borrowing Costs

Total borrowing costs include:
- **Interest Charges**: Based on borrowed amount and time
- **Borrowing Fees**: Upfront fees when taking loans
- **Gas Fees**: Network transaction costs
- **Opportunity Costs**: Returns missed on collateral

#### Cost Optimization Strategies

```typescript
class BorrowingCostOptimizer {
  async optimizeBorrowingCosts(
    program: Program<BorrowLending>,
    user: Keypair,
    borrowingNeeds: {
      amount: number;
      duration: number; // days
      purpose: 'liquidity' | 'leverage' | 'arbitrage';
    }
  ): Promise<{
    recommendedStrategy: string;
    estimatedCosts: number;
    alternatives: Array<{
      strategy: string;
      cost: number;
      pros: string[];
      cons: string[];
    }>;
  }> {
    const alternatives = [];
    
    // Strategy 1: Traditional borrowing
    const traditionalCost = await this.calculateTraditionalBorrowCost(
      program,
      borrowingNeeds.amount,
      borrowingNeeds.duration
    );
    
    alternatives.push({
      strategy: 'Traditional Borrowing',
      cost: traditionalCost,
      pros: ['Simple', 'Flexible repayment', 'Keep full collateral exposure'],
      cons: ['Higher interest rates', 'Liquidation risk', 'Requires overcollateralization'],
    });
    
    // Strategy 2: Flash loan (if applicable)
    if (borrowingNeeds.duration < 1 && borrowingNeeds.purpose === 'arbitrage') {
      const flashLoanCost = await this.calculateFlashLoanCost(
        program,
        borrowingNeeds.amount
      );
      
      alternatives.push({
        strategy: 'Flash Loan',
        cost: flashLoanCost,
        pros: ['No collateral required', 'Lower total cost', 'Atomic execution'],
        cons: ['Must repay in same transaction', 'Complex implementation', 'Limited use cases'],
      });
    }
    
    // Strategy 3: Leveraged liquidity provision
    if (borrowingNeeds.purpose === 'leverage') {
      const leveragedLPCost = await this.calculateLeveragedLPCost(
        borrowingNeeds.amount,
        borrowingNeeds.duration
      );
      
      alternatives.push({
        strategy: 'Leveraged LP',
        cost: leveragedLPCost,
        pros: ['Earn LP fees', 'Potentially profitable', 'Diversified exposure'],
        cons: ['Impermanent loss risk', 'Complex management', 'Market risk'],
      });
    }
    
    // Find best strategy
    const bestStrategy = alternatives.reduce((best, current) => 
      current.cost < best.cost ? current : best
    );
    
    return {
      recommendedStrategy: bestStrategy.strategy,
      estimatedCosts: bestStrategy.cost,
      alternatives,
    };
  }
  
  async trackBorrowingCosts(
    program: Program<BorrowLending>,
    obligation: PublicKey,
    startDate: Date
  ): Promise<{
    totalCost: number;
    breakdown: {
      interestPaid: number;
      fees: number;
      gasCosts: number;
    };
    averageRate: number;
    efficiency: number;
  }> {
    const obligationData = await program.account.obligation.fetch(obligation);
    const daysSinceStart = (Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    
    let totalInterest = 0;
    let totalFees = 0;
    let totalDebt = 0;
    
    // Calculate accumulated costs for each borrow
    for (const borrow of obligationData.borrows) {
      if (borrow.borrowedAmountWads && borrow.borrowedAmountWads.toNumber() > 0) {
        const debtAmount = borrow.borrowedAmountWads.toNumber();
        const reserveData = await program.account.reserve.fetch(borrow.borrowReserve);
        const currentRate = reserveData.currentBorrowRate;
        
        // Calculate accrued interest (simplified)
        const dailyRate = currentRate / 365;
        const accruedInterest = debtAmount * dailyRate * daysSinceStart;
        
        totalInterest += accruedInterest;
        totalDebt += debtAmount;
        
        // Estimate fees (would track actual fees in production)
        const borrowFee = debtAmount * 0.005; // 0.5% borrow fee
        totalFees += borrowFee;
      }
    }
    
    const averageRate = totalDebt > 0 ? (totalInterest / totalDebt) * (365 / daysSinceStart) : 0;
    const gasCosts = 50; // Estimate based on transaction count
    const totalCost = totalInterest + totalFees + gasCosts;
    
    // Calculate efficiency (return generated / cost incurred)
    const efficiency = await this.calculatePositionROI(program, obligation, startDate) / totalCost;
    
    return {
      totalCost,
      breakdown: {
        interestPaid: totalInterest,
        fees: totalFees,
        gasCosts,
      },
      averageRate,
      efficiency,
    };
  }
  
  private async calculateTraditionalBorrowCost(
    program: Program<BorrowLending>,
    amount: number,
    days: number
  ): Promise<number> {
    // Get representative borrow rate
    const avgBorrowRate = 0.08; // 8% average
    const borrowFee = amount * 0.005; // 0.5% upfront fee
    const dailyRate = avgBorrowRate / 365;
    const interestCost = amount * dailyRate * days;
    
    return borrowFee + interestCost;
  }
  
  private async calculateFlashLoanCost(
    program: Program<BorrowLending>,
    amount: number
  ): Promise<number> {
    const flashLoanFee = amount * 0.003; // 0.3% flash loan fee
    const gasCost = 20; // Higher gas for complex transactions
    
    return flashLoanFee + gasCost;
  }
  
  private async calculateLeveragedLPCost(
    amount: number,
    days: number
  ): Promise<number> {
    const borrowCost = amount * 0.08 * (days / 365); // 8% borrow rate
    const lpFees = amount * 0.003 * (days / 365); // 0.3% daily LP fees (simplified)
    const impermanentLoss = amount * 0.02; // 2% estimated IL
    
    return borrowCost - lpFees + impermanentLoss;
  }
  
  private async calculatePositionROI(
    program: Program<BorrowLending>,
    obligation: PublicKey,
    startDate: Date
  ): Promise<number> {
    // Calculate total return generated by the position
    // This would include:
    // - Asset appreciation
    // - Yield farming returns
    // - Trading profits
    // - Any other income generated
    
    return 100; // Placeholder
  }
}

// Usage
const costOptimizer = new BorrowingCostOptimizer();

// Get optimization recommendations
const optimization = await costOptimizer.optimizeBorrowingCosts(
  program,
  userKeypair,
  {
    amount: 10000,      // $10,000 needed
    duration: 30,       // 30 days
    purpose: 'leverage', // For leveraged position
  }
);

console.log(`Recommended: ${optimization.recommendedStrategy}`);
console.log(`Estimated cost: $${optimization.estimatedCosts.toFixed(2)}`);

optimization.alternatives.forEach(alt => {
  console.log(`\n${alt.strategy}: $${alt.cost.toFixed(2)}`);
  console.log(`Pros: ${alt.pros.join(', ')}`);
  console.log(`Cons: ${alt.cons.join(', ')}`);
});

// Track ongoing costs
const costTracking = await costOptimizer.trackBorrowingCosts(
  program,
  obligationAddress,
  new Date('2024-01-01')
);

console.log('\n📊 Cost Tracking:');
console.log(`Total cost: $${costTracking.totalCost.toFixed(2)}`);
console.log(`Interest: $${costTracking.breakdown.interestPaid.toFixed(2)}`);
console.log(`Fees: $${costTracking.breakdown.fees.toFixed(2)}`);
console.log(`Average rate: ${(costTracking.averageRate * 100).toFixed(2)}%`);
console.log(`Efficiency: ${costTracking.efficiency.toFixed(2)}x`);
```

### Summary

This comprehensive Tutorial 2 covered:

1. **Borrowing Fundamentals** - Understanding collateral, health factors, and interest rates
2. **Step-by-Step Process** - From depositing collateral to executing borrows
3. **Position Management** - Monitoring health, adding collateral, and repaying debt
4. **Advanced Strategies** - Cash & carry, yield farming, and leveraged accumulation
5. **Risk Management** - Comprehensive risk assessment and mitigation strategies
6. **Cost Optimization** - Understanding and minimizing borrowing costs

Key principles for safe borrowing:
- **Conservative Health Factors**: Maintain 2x+ for safety
- **Diversification**: Use multiple assets and avoid concentration
- **Active Monitoring**: Check positions regularly and set up alerts
- **Risk Controls**: Implement stop-losses and automatic rebalancing
- **Cost Awareness**: Understand all costs and optimize strategies
- **Exit Planning**: Always have a plan for position closure

Remember that borrowing amplifies both gains and losses. Start with small amounts, understand the mechanics thoroughly, and never borrow more than you can afford to lose.

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