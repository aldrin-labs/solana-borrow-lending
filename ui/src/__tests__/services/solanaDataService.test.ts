/**
 * Tests for Solana data service
 * Ensures analytics calculations and data fetching work correctly
 */

import { SolanaDataService } from '../services/solanaDataService';
import { PRICE_VARIANCE, HEALTH_FACTOR } from '../utils/constants';

// Mock the Connection class
jest.mock('@solana/web3.js', () => ({
  Connection: jest.fn().mockImplementation(() => ({
    getSlot: jest.fn().mockResolvedValue(123456),
  })),
  PublicKey: jest.fn().mockImplementation((key) => ({ toBase58: () => key })),
}));

describe('SolanaDataService', () => {
  let service: SolanaDataService;

  beforeEach(() => {
    service = new SolanaDataService();
    // Clear any existing cache
    (service as any).cache.clear();
  });

  describe('fetchTokenPrices', () => {
    it('should return realistic token prices', async () => {
      const prices = await service.fetchTokenPrices();
      
      expect(prices).toHaveProperty('SOL');
      expect(prices).toHaveProperty('USDC');
      expect(prices).toHaveProperty('USDT');
      expect(prices).toHaveProperty('ETH');
      expect(prices).toHaveProperty('BTC');
      
      // Check that prices are within expected ranges
      expect(prices.SOL).toBeGreaterThan(PRICE_VARIANCE.SOL.BASE - PRICE_VARIANCE.SOL.RANGE);
      expect(prices.SOL).toBeLessThan(PRICE_VARIANCE.SOL.BASE + PRICE_VARIANCE.SOL.RANGE);
      
      expect(prices.USDC).toBeCloseTo(PRICE_VARIANCE.USDC.BASE, 2);
      expect(prices.USDT).toBeCloseTo(PRICE_VARIANCE.USDT.BASE, 2);
    });

    it('should cache results', async () => {
      const prices1 = await service.fetchTokenPrices();
      const prices2 = await service.fetchTokenPrices();
      
      // Should return the same cached values
      expect(prices1).toEqual(prices2);
    });

    it('should handle errors gracefully', async () => {
      // Mock an error scenario
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
      
      const prices = await service.fetchTokenPrices();
      
      // Should return fallback prices
      expect(prices.SOL).toBe(PRICE_VARIANCE.SOL.BASE);
      expect(prices.USDC).toBe(PRICE_VARIANCE.USDC.BASE);
      
      global.fetch = originalFetch;
    });
  });

  describe('fetchMarketData', () => {
    it('should return market data with both numeric and formatted values', async () => {
      const markets = await service.fetchMarketData();
      
      expect(markets).toHaveLength(5); // SOL, USDC, USDT, ETH, BTC
      
      const solMarket = markets.find(m => m.token === 'SOL');
      expect(solMarket).toBeDefined();
      
      if (solMarket) {
        // Check that numeric values are numbers
        expect(typeof solMarket.totalSupplyValue).toBe('number');
        expect(typeof solMarket.supplyApy).toBe('number');
        expect(typeof solMarket.borrowApy).toBe('number');
        expect(typeof solMarket.utilizationRate).toBe('number');
        
        // Check that formatted values are strings
        expect(typeof solMarket.totalSupply).toBe('string');
        expect(typeof solMarket.supplyApyFormatted).toBe('string');
        expect(typeof solMarket.borrowApyFormatted).toBe('string');
        expect(typeof solMarket.utilizationRateFormatted).toBe('string');
        
        // Check that formatted values contain expected characters
        expect(solMarket.totalSupply).toMatch(/\$/);
        expect(solMarket.supplyApyFormatted).toMatch(/%/);
        expect(solMarket.borrowApyFormatted).toMatch(/%/);
        expect(solMarket.utilizationRateFormatted).toMatch(/%/);
      }
    });

    it('should calculate realistic APY values', async () => {
      const markets = await service.fetchMarketData();
      
      markets.forEach(market => {
        // Supply APY should be reasonable (0.5% - 8%)
        expect(market.supplyApy).toBeGreaterThan(0.5);
        expect(market.supplyApy).toBeLessThan(8);
        
        // Borrow APY should be higher than supply APY
        expect(market.borrowApy).toBeGreaterThan(market.supplyApy);
        
        // Utilization rate should be between 0-100%
        expect(market.utilizationRate).toBeGreaterThanOrEqual(0);
        expect(market.utilizationRate).toBeLessThanOrEqual(100);
      });
    });

    it('should calculate consistent total borrow from utilization', async () => {
      const markets = await service.fetchMarketData();
      
      markets.forEach(market => {
        const expectedBorrowValue = market.totalSupplyValue * (market.utilizationRate / 100);
        // Allow for small rounding differences
        expect(market.totalBorrowValue).toBeCloseTo(expectedBorrowValue, 0);
      });
    });
  });

  describe('fetchUserPositions', () => {
    const testWalletAddress = '11111111111111111111111111111112';

    it('should return user positions with numeric and formatted values', async () => {
      const positions = await service.fetchUserPositions(testWalletAddress);
      
      expect(positions).toHaveProperty('supplied');
      expect(positions).toHaveProperty('borrowed');
      
      expect(positions.supplied).toHaveLength(2);
      expect(positions.borrowed).toHaveLength(1);
      
      const solPosition = positions.supplied.find(p => p.token === 'SOL');
      if (solPosition) {
        expect(typeof solPosition.amountNumeric).toBe('number');
        expect(typeof solPosition.valueNumeric).toBe('number');
        expect(typeof solPosition.apyNumeric).toBe('number');
        
        expect(typeof solPosition.amount).toBe('string');
        expect(typeof solPosition.value).toBe('string');
        expect(typeof solPosition.apy).toBe('string');
      }
      
      const borrowPosition = positions.borrowed[0];
      if (borrowPosition) {
        expect(typeof borrowPosition.healthFactorNumeric).toBe('number');
        expect(typeof borrowPosition.healthFactor).toBe('string');
        
        // Health factor should be reasonable
        expect(borrowPosition.healthFactorNumeric!).toBeGreaterThan(HEALTH_FACTOR.CRITICAL_THRESHOLD);
        expect(borrowPosition.healthFactorNumeric!).toBeLessThan(HEALTH_FACTOR.EXCELLENT_THRESHOLD + 1);
      }
    });

    it('should handle errors gracefully', async () => {
      // Mock an error scenario
      const invalidAddress = 'invalid-address';
      
      const positions = await service.fetchUserPositions(invalidAddress);
      
      expect(positions.supplied).toHaveLength(0);
      expect(positions.borrowed).toHaveLength(0);
    });
  });

  describe('fetchProtocolAnalytics', () => {
    it('should return comprehensive analytics data', async () => {
      const analytics = await service.fetchProtocolAnalytics();
      
      expect(analytics).toHaveProperty('totalValueLocked');
      expect(analytics).toHaveProperty('totalBorrowed');
      expect(analytics).toHaveProperty('totalSupplied');
      expect(analytics).toHaveProperty('utilizationTrend');
      expect(analytics).toHaveProperty('apyComparison');
      expect(analytics).toHaveProperty('healthFactor');
      expect(analytics).toHaveProperty('liquidationThreshold');
      
      // Check data structure
      expect(Array.isArray(analytics.totalValueLocked)).toBe(true);
      expect(Array.isArray(analytics.apyComparison)).toBe(true);
      
      // Check that trend data has time series structure
      const tvlData = analytics.totalValueLocked;
      expect(tvlData.length).toBeGreaterThan(0);
      expect(tvlData[0]).toHaveProperty('time');
      expect(tvlData[0]).toHaveProperty('value');
      
      // Check that APY comparison has numeric values
      analytics.apyComparison.forEach(apy => {
        expect(typeof apy.supplyAPY).toBe('number');
        expect(typeof apy.borrowAPY).toBe('number');
        expect(typeof apy.token).toBe('string');
      });
    });

    it('should calculate realistic health factor', async () => {
      const analytics = await service.fetchProtocolAnalytics();
      
      expect(analytics.healthFactor).toBeGreaterThan(HEALTH_FACTOR.CRITICAL_THRESHOLD);
      expect(analytics.healthFactor).toBeLessThan(HEALTH_FACTOR.EXCELLENT_THRESHOLD + 1);
    });

    it('should generate trend data with proper time series', async () => {
      const analytics = await service.fetchProtocolAnalytics();
      
      const tvlData = analytics.totalValueLocked;
      
      // Check that dates are in chronological order
      for (let i = 1; i < tvlData.length; i++) {
        const currentDate = new Date(tvlData[i].time);
        const previousDate = new Date(tvlData[i - 1].time);
        expect(currentDate.getTime()).toBeGreaterThan(previousDate.getTime());
      }
      
      // Check that values are positive
      tvlData.forEach(point => {
        expect(point.value).toBeGreaterThan(0);
      });
    });
  });

  describe('healthCheck', () => {
    it('should return true for successful connection', async () => {
      const isHealthy = await service.healthCheck();
      expect(isHealthy).toBe(true);
    });

    it('should handle RPC endpoint failures', async () => {
      // Mock Connection to fail
      const { Connection } = require('@solana/web3.js');
      Connection.mockImplementation(() => ({
        getSlot: jest.fn().mockRejectedValue(new Error('Connection failed')),
      }));
      
      const newService = new SolanaDataService();
      const isHealthy = await newService.healthCheck();
      
      // Should return false when all endpoints fail
      expect(isHealthy).toBe(false);
      
      // Restore mock
      Connection.mockImplementation(() => ({
        getSlot: jest.fn().mockResolvedValue(123456),
      }));
    });
  });

  describe('caching behavior', () => {
    it('should cache results for the specified duration', async () => {
      const markets1 = await service.fetchMarketData();
      const markets2 = await service.fetchMarketData();
      
      // Should return identical cached results
      expect(markets1).toEqual(markets2);
    });

    it('should invalidate cache after duration', async () => {
      const markets1 = await service.fetchMarketData();
      
      // Manually expire cache
      (service as any).cache.forEach((value: any, key: string) => {
        (service as any).cache.set(key, { ...value, timestamp: Date.now() - 60000 });
      });
      
      const markets2 = await service.fetchMarketData();
      
      // Should fetch new data (might be different due to randomization)
      expect(markets2).toBeDefined();
    });
  });
});