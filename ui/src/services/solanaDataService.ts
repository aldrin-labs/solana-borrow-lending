import { Connection, PublicKey } from '@solana/web3.js';
import { formatCurrency, formatPercentage } from '../utils/formatters';
import { 
  PRICE_VARIANCE, 
  CACHE, 
  NETWORK, 
  HEALTH_FACTOR, 
  INTEREST_RATES, 
  CHARTS,
  TOKEN_DECIMALS,
  LIQUIDATION 
} from '../utils/constants';

// Solana RPC endpoints with fallback
const RPC_ENDPOINTS = [
  'https://solana-mainnet.g.alchemy.com/v2/demo',
  'https://api.mainnet-beta.solana.com',
  'https://mainnet.helius-rpc.com/?api-key=demo',
  'https://rpc.ankr.com/solana',
  'https://solana-api.projectserum.com',
];

// Create connection with fallback endpoints
export const createConnection = (): Connection => {
  // Try endpoints in order, start with most reliable free endpoints
  const endpoint = RPC_ENDPOINTS[0];
  return new Connection(endpoint, {
    commitment: NETWORK.COMMITMENT,
    confirmTransactionInitialTimeout: NETWORK.CONFIRMATION_TIMEOUT_MS,
    disableRetryOnRateLimit: true,
    wsEndpoint: undefined, // Disable WebSocket for demo to avoid connection issues
  });
};

// Interface definitions with numeric values
export interface MarketData {
  id: string;
  token: string;
  totalSupplyValue: number; // Numeric value
  totalSupply: string; // Formatted display string
  supplyApy: number; // Numeric percentage (0-100)
  supplyApyFormatted: string; // Formatted display string
  totalBorrowValue: number; // Numeric value
  totalBorrow: string; // Formatted display string
  borrowApy: number; // Numeric percentage (0-100)
  borrowApyFormatted: string; // Formatted display string
  utilizationRate: number; // Numeric percentage (0-100)
  utilizationRateFormatted: string; // Formatted display string
  mint: string;
  reserveAddress: string;
}

export interface ProtocolAnalytics {
  totalValueLocked: Array<{ time: string; value: number }>;
  totalBorrowed: Array<{ time: string; value: number }>;
  totalSupplied: Array<{ time: string; value: number }>;
  utilizationTrend: Array<{ time: string; utilization: number }>;
  apyComparison: Array<{ token: string; supplyAPY: number; borrowAPY: number }>;
  healthFactor: number;
  liquidationThreshold: number;
}

export interface UserPosition {
  id: string;
  token: string;
  amount: string;
  amountNumeric: number; // Numeric amount
  value: string;
  valueNumeric: number; // Numeric value
  apy: string;
  apyNumeric: number; // Numeric percentage
  collateral?: boolean;
  healthFactor?: string;
  healthFactorNumeric?: number; // Numeric health factor
}

// Known token mints for major tokens
const KNOWN_TOKENS = {
  SOL: {
    mint: 'So11111111111111111111111111111111111111112', // Wrapped SOL
    symbol: 'SOL',
    decimals: TOKEN_DECIMALS.SOL,
  },
  USDC: {
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    symbol: 'USDC',
    decimals: TOKEN_DECIMALS.USDC,
  },
  USDT: {
    mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    symbol: 'USDT',
    decimals: TOKEN_DECIMALS.USDT,
  },
  ETH: {
    mint: '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs', // Ethereum (Portal)
    symbol: 'ETH',
    decimals: TOKEN_DECIMALS.ETH,
  },
  BTC: {
    mint: '9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E', // Bitcoin (Portal)
    symbol: 'BTC',
    decimals: TOKEN_DECIMALS.BTC,
  },
};

// Mock data generators for realistic simulation
const generateRealisticTrendData = (baseValue: number, days: number = CHARTS.DEFAULT_DAYS): Array<{ time: string; value: number }> => {
  const data = [];
  const now = new Date();
  
  for (let i = days; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const variance = (Math.random() - 0.5) * CHARTS.TREND_VARIANCE;
    const trend = -i * CHARTS.TREND_DECLINE_FACTOR;
    const value = Math.round(baseValue * (1 + variance + trend));
    
    data.push({
      time: date.toISOString().split('T')[0],
      value: Math.max(value, baseValue * CHARTS.MIN_VALUE_PERCENTAGE),
    });
  }
  
  return data;
};

const generateUtilizationData = (baseUtilization: number): Array<{ time: string; utilization: number }> => {
  const data = [];
  const now = new Date();
  
  for (let i = CHARTS.DEFAULT_DAYS - 1; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const variance = (Math.random() - 0.5) * 20; // ±20% variance
    const utilization = Math.max(0, Math.min(100, baseUtilization + variance));
    
    data.push({
      time: date.toISOString().split('T')[0],
      utilization: Math.round(utilization * 100) / 100,
    });
  }
  
  return data;
};

export class SolanaDataService {
  private connection: Connection;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = CACHE.DURATION_MS;

  constructor() {
    this.connection = createConnection();
  }

  private isCacheValid(key: string): boolean {
    const cached = this.cache.get(key);
    if (!cached) return false;
    return Date.now() - cached.timestamp < this.CACHE_DURATION;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  private getCache(key: string): any {
    const cached = this.cache.get(key);
    return cached ? cached.data : null;
  }

  // Fetch real token prices from Solana account data
  async fetchTokenPrices(): Promise<Record<string, number>> {
    const cacheKey = CACHE.TOKEN_PRICES_KEY;
    
    if (this.isCacheValid(cacheKey)) {
      return this.getCache(cacheKey);
    }

    try {
      // For demo purposes, we'll use simulated realistic prices
      // In a real implementation, you would fetch from a price oracle like Pyth
      const prices = {
        SOL: PRICE_VARIANCE.SOL.BASE + (Math.random() - 0.5) * PRICE_VARIANCE.SOL.RANGE,
        USDC: PRICE_VARIANCE.USDC.BASE + (Math.random() - 0.5) * PRICE_VARIANCE.USDC.RANGE,
        USDT: PRICE_VARIANCE.USDT.BASE + (Math.random() - 0.5) * PRICE_VARIANCE.USDT.RANGE,
        ETH: PRICE_VARIANCE.ETH.BASE + (Math.random() - 0.5) * PRICE_VARIANCE.ETH.RANGE,
        BTC: PRICE_VARIANCE.BTC.BASE + (Math.random() - 0.5) * PRICE_VARIANCE.BTC.RANGE,
      };

      this.setCache(cacheKey, prices);
      return prices;
    } catch (error) {
      console.error('Error fetching token prices:', error);
      // Return fallback prices
      return {
        SOL: PRICE_VARIANCE.SOL.BASE,
        USDC: PRICE_VARIANCE.USDC.BASE,
        USDT: PRICE_VARIANCE.USDT.BASE,
        ETH: PRICE_VARIANCE.ETH.BASE,
        BTC: PRICE_VARIANCE.BTC.BASE,
      };
    }
  }

  // Fetch market data for lending protocol
  async fetchMarketData(): Promise<MarketData[]> {
    const cacheKey = CACHE.MARKET_DATA_KEY;
    
    if (this.isCacheValid(cacheKey)) {
      return this.getCache(cacheKey);
    }

    try {
      const prices = await this.fetchTokenPrices();
      
      // Generate realistic market data based on current token information
      const markets: MarketData[] = Object.entries(KNOWN_TOKENS).map(([symbol, tokenInfo], index) => {
        const price = prices[symbol] || 1;
        const baseSupply = [50000000, 100000000, 25000000, 5000000, 1000000][index];
        const totalSupplyValue = baseSupply * price;
        const utilizationRate = INTEREST_RATES.UTILIZATION_RATE.MIN + 
          Math.random() * (INTEREST_RATES.UTILIZATION_RATE.MAX - INTEREST_RATES.UTILIZATION_RATE.MIN);
        const totalBorrowValue = totalSupplyValue * (utilizationRate / 100);
        
        // Realistic APY calculation based on utilization
        const baseSupplyAPY = INTEREST_RATES.BASE_SUPPLY_APY.MIN + 
          (utilizationRate / 100) * INTEREST_RATES.BASE_SUPPLY_APY.MULTIPLIER;
        const borrowAPY = baseSupplyAPY * INTEREST_RATES.BORROW_APY_MULTIPLIER + 
          Math.random() * INTEREST_RATES.ADDITIONAL_BORROW_VARIANCE;
        
        return {
          id: (index + 1).toString(),
          token: symbol,
          totalSupplyValue,
          totalSupply: formatCurrency(totalSupplyValue),
          supplyApy: baseSupplyAPY,
          supplyApyFormatted: formatPercentage(baseSupplyAPY),
          totalBorrowValue,
          totalBorrow: formatCurrency(totalBorrowValue),
          borrowApy: borrowAPY,
          borrowApyFormatted: formatPercentage(borrowAPY),
          utilizationRate,
          utilizationRateFormatted: formatPercentage(utilizationRate),
          mint: tokenInfo.mint,
          reserveAddress: `Reserve${index + 1}...`, // Placeholder
        };
      });

      this.setCache(cacheKey, markets);
      return markets;
    } catch (error) {
      console.error('Error fetching market data:', error);
      throw error;
    }
  }

  // Fetch user positions (requires wallet connection)
  async fetchUserPositions(walletAddress: string): Promise<{
    supplied: UserPosition[];
    borrowed: UserPosition[];
  }> {
    const cacheKey = `${CACHE.USER_POSITIONS_PREFIX}${walletAddress}`;
    
    if (this.isCacheValid(cacheKey)) {
      return this.getCache(cacheKey);
    }

    try {
      // In a real implementation, this would query user's token accounts
      // and lending protocol positions
      const userPubkey = new PublicKey(walletAddress);
      
      // Simulate realistic user positions
      const prices = await this.fetchTokenPrices();
      
      const solAmount = 10.0;
      const usdcAmount = 2000;
      const borrowedUsdcAmount = 800;
      const healthFactorValue = HEALTH_FACTOR.DEFAULT_VALUE + 
        (Math.random() - 0.5) * HEALTH_FACTOR.VARIANCE_RANGE;
      
      const supplied: UserPosition[] = [
        {
          id: '1',
          token: 'SOL',
          amount: `${solAmount.toFixed(1)} SOL`,
          amountNumeric: solAmount,
          value: formatCurrency(solAmount * prices.SOL),
          valueNumeric: solAmount * prices.SOL,
          apy: formatPercentage(3.2),
          apyNumeric: 3.2,
          collateral: true,
        },
        {
          id: '2',
          token: 'USDC',
          amount: `${usdcAmount.toLocaleString()} USDC`,
          amountNumeric: usdcAmount,
          value: formatCurrency(usdcAmount * prices.USDC),
          valueNumeric: usdcAmount * prices.USDC,
          apy: formatPercentage(2.8),
          apyNumeric: 2.8,
          collateral: true,
        },
      ];

      const borrowed: UserPosition[] = [
        {
          id: '1',
          token: 'USDC',
          amount: `${borrowedUsdcAmount} USDC`,
          amountNumeric: borrowedUsdcAmount,
          value: formatCurrency(borrowedUsdcAmount * prices.USDC),
          valueNumeric: borrowedUsdcAmount * prices.USDC,
          apy: formatPercentage(4.5),
          apyNumeric: 4.5,
          healthFactor: healthFactorValue.toFixed(1),
          healthFactorNumeric: healthFactorValue,
        },
      ];

      const result = { supplied, borrowed };
      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      console.error('Error fetching user positions:', error);
      return { supplied: [], borrowed: [] };
    }
  }

  // Fetch protocol analytics
  async fetchProtocolAnalytics(): Promise<ProtocolAnalytics> {
    const cacheKey = CACHE.PROTOCOL_ANALYTICS_KEY;
    
    if (this.isCacheValid(cacheKey)) {
      return this.getCache(cacheKey);
    }

    try {
      const markets = await this.fetchMarketData();
      
      // Calculate totals from market data
      const totalSupplied = markets.reduce((sum, market) => sum + market.totalSupplyValue, 0);
      const totalBorrowed = markets.reduce((sum, market) => sum + market.totalBorrowValue, 0);

      const analytics: ProtocolAnalytics = {
        totalValueLocked: generateRealisticTrendData(totalSupplied),
        totalBorrowed: generateRealisticTrendData(totalBorrowed),
        totalSupplied: generateRealisticTrendData(totalSupplied),
        utilizationTrend: generateUtilizationData(INTEREST_RATES.UTILIZATION_RATE.OPTIMAL),
        apyComparison: markets.map(market => ({
          token: market.token,
          supplyAPY: market.supplyApy,
          borrowAPY: market.borrowApy,
        })),
        healthFactor: HEALTH_FACTOR.DEFAULT_VALUE + 
          (Math.random() - 0.5) * HEALTH_FACTOR.VARIANCE_RANGE,
        liquidationThreshold: LIQUIDATION.THRESHOLD_PERCENTAGE,
      };

      this.setCache(cacheKey, analytics);
      return analytics;
    } catch (error) {
      console.error('Error fetching protocol analytics:', error);
      throw error;
    }
  }

  // Health check for connection with fallback
  async healthCheck(): Promise<boolean> {
    for (let i = 0; i < RPC_ENDPOINTS.length; i++) {
      try {
        const testConnection = new Connection(RPC_ENDPOINTS[i], {
          commitment: NETWORK.COMMITMENT,
          confirmTransactionInitialTimeout: NETWORK.HEALTH_CHECK_TIMEOUT_MS,
          disableRetryOnRateLimit: true,
          wsEndpoint: undefined,
        });
        
        // Test with a simple, lightweight call
        const slot = await Promise.race([
          testConnection.getSlot(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), NETWORK.HEALTH_CHECK_TIMEOUT_MS)
          )
        ]) as number;
        
        if (slot > 0) {
          // If this endpoint works, update our main connection
          if (i !== 0) {
            this.connection = testConnection;
            console.log(`Switched to RPC endpoint: ${RPC_ENDPOINTS[i]}`);
          }
          return true;
        }
      } catch (error) {
        console.warn(`RPC endpoint ${RPC_ENDPOINTS[i]} failed:`, error);
        continue;
      }
    }
    
    console.error('All Solana RPC endpoints failed');
    return false;
  }
}

// Export singleton instance
export const solanaDataService = new SolanaDataService();