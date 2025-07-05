import { Connection, PublicKey } from '@solana/web3.js';

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
    commitment: 'confirmed',
    confirmTransactionInitialTimeout: 30000,
    disableRetryOnRateLimit: true,
    wsEndpoint: undefined, // Disable WebSocket for demo to avoid connection issues
  });
};

// Interface definitions
export interface MarketData {
  id: string;
  token: string;
  totalSupply: string;
  supplyApy: string;
  totalBorrow: string;
  borrowApy: string;
  utilizationRate: string;
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
  value: string;
  apy: string;
  collateral?: boolean;
  healthFactor?: string;
}

// Known token mints for major tokens
const KNOWN_TOKENS = {
  SOL: {
    mint: 'So11111111111111111111111111111111111111112', // Wrapped SOL
    symbol: 'SOL',
    decimals: 9,
  },
  USDC: {
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    symbol: 'USDC',
    decimals: 6,
  },
  USDT: {
    mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    symbol: 'USDT',
    decimals: 6,
  },
  ETH: {
    mint: '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs', // Ethereum (Portal)
    symbol: 'ETH',
    decimals: 8,
  },
  BTC: {
    mint: '9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E', // Bitcoin (Portal)
    symbol: 'BTC',
    decimals: 8,
  },
};

// Mock data generators for realistic simulation
const generateRealisticTrendData = (baseValue: number, days: number = 30): Array<{ time: string; value: number }> => {
  const data = [];
  const now = new Date();
  
  for (let i = days; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const variance = (Math.random() - 0.5) * 0.1; // ±10% variance
    const trend = -i * 0.001; // Slight downward trend over time
    const value = Math.round(baseValue * (1 + variance + trend));
    
    data.push({
      time: date.toISOString().split('T')[0],
      value: Math.max(value, baseValue * 0.5), // Minimum 50% of base value
    });
  }
  
  return data;
};

const generateUtilizationData = (baseUtilization: number): Array<{ time: string; utilization: number }> => {
  const data = [];
  const now = new Date();
  
  for (let i = 29; i >= 0; i--) {
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

// Solana Data Service Class
export class SolanaDataService {
  private connection: Connection;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 30000; // 30 seconds

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
    const cacheKey = 'tokenPrices';
    
    if (this.isCacheValid(cacheKey)) {
      return this.getCache(cacheKey);
    }

    try {
      // For demo purposes, we'll use simulated realistic prices
      // In a real implementation, you would fetch from a price oracle like Pyth
      const prices = {
        SOL: 100 + (Math.random() - 0.5) * 10, // $100 ± $5
        USDC: 1.0 + (Math.random() - 0.5) * 0.01, // $1.00 ± $0.005
        USDT: 1.0 + (Math.random() - 0.5) * 0.01, // $1.00 ± $0.005
        ETH: 2500 + (Math.random() - 0.5) * 100, // $2500 ± $50
        BTC: 45000 + (Math.random() - 0.5) * 1000, // $45000 ± $500
      };

      this.setCache(cacheKey, prices);
      return prices;
    } catch (error) {
      console.error('Error fetching token prices:', error);
      // Return fallback prices
      return {
        SOL: 100,
        USDC: 1.0,
        USDT: 1.0,
        ETH: 2500,
        BTC: 45000,
      };
    }
  }

  // Fetch market data for lending protocol
  async fetchMarketData(): Promise<MarketData[]> {
    const cacheKey = 'marketData';
    
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
        const utilizationRate = 40 + Math.random() * 30; // 40-70%
        const totalBorrowValue = totalSupplyValue * (utilizationRate / 100);
        
        // Realistic APY calculation based on utilization
        const baseSupplyAPY = 1 + (utilizationRate / 100) * 4; // 1-5%
        const borrowAPY = baseSupplyAPY * 1.5 + Math.random() * 2; // 1.5x supply + 0-2%
        
        return {
          id: (index + 1).toString(),
          token: symbol,
          totalSupply: `$${Math.round(totalSupplyValue).toLocaleString()}`,
          supplyApy: `${baseSupplyAPY.toFixed(1)}%`,
          totalBorrow: `$${Math.round(totalBorrowValue).toLocaleString()}`,
          borrowApy: `${borrowAPY.toFixed(1)}%`,
          utilizationRate: `${Math.round(utilizationRate)}%`,
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
    const cacheKey = `userPositions_${walletAddress}`;
    
    if (this.isCacheValid(cacheKey)) {
      return this.getCache(cacheKey);
    }

    try {
      // In a real implementation, this would query user's token accounts
      // and lending protocol positions
      const userPubkey = new PublicKey(walletAddress);
      
      // Simulate realistic user positions
      const prices = await this.fetchTokenPrices();
      
      const supplied: UserPosition[] = [
        {
          id: '1',
          token: 'SOL',
          amount: '10.0 SOL',
          value: `$${(10 * prices.SOL).toLocaleString()}`,
          apy: '3.2%',
          collateral: true,
        },
        {
          id: '2',
          token: 'USDC',
          amount: '2,000 USDC',
          value: `$${(2000 * prices.USDC).toLocaleString()}`,
          apy: '2.8%',
          collateral: true,
        },
      ];

      const borrowed: UserPosition[] = [
        {
          id: '1',
          token: 'USDC',
          amount: '800 USDC',
          value: `$${(800 * prices.USDC).toLocaleString()}`,
          apy: '4.5%',
          healthFactor: '2.1',
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
    const cacheKey = 'protocolAnalytics';
    
    if (this.isCacheValid(cacheKey)) {
      return this.getCache(cacheKey);
    }

    try {
      const markets = await this.fetchMarketData();
      
      // Calculate totals from market data
      const totalSupplied = markets.reduce((sum, market) => {
        const value = parseInt(market.totalSupply.replace(/[$,]/g, ''));
        return sum + value;
      }, 0);
      
      const totalBorrowed = markets.reduce((sum, market) => {
        const value = parseInt(market.totalBorrow.replace(/[$,]/g, ''));
        return sum + value;
      }, 0);

      const analytics: ProtocolAnalytics = {
        totalValueLocked: generateRealisticTrendData(totalSupplied),
        totalBorrowed: generateRealisticTrendData(totalBorrowed),
        totalSupplied: generateRealisticTrendData(totalSupplied),
        utilizationTrend: generateUtilizationData(48),
        apyComparison: markets.map(market => ({
          token: market.token,
          supplyAPY: parseFloat(market.supplyApy.replace('%', '')),
          borrowAPY: parseFloat(market.borrowApy.replace('%', '')),
        })),
        healthFactor: 1.85 + (Math.random() - 0.5) * 0.3, // 1.7 - 2.0
        liquidationThreshold: 80,
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
          commitment: 'confirmed',
          confirmTransactionInitialTimeout: 10000,
          disableRetryOnRateLimit: true,
          wsEndpoint: undefined,
        });
        
        // Test with a simple, lightweight call
        const slot = await Promise.race([
          testConnection.getSlot(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 5000)
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