import { useState, useEffect, useCallback, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { 
  solanaDataService, 
  MarketData, 
  ProtocolAnalytics, 
  UserPosition 
} from "@/services/solanaDataService";
import { debugLog } from "@/utils/debug";
import { INTERVALS } from "@/utils/constants";

// Custom hook for throttled and debounced intervals
const useThrottledInterval = (callback: () => void, delay: number, deps: any[] = []) => {
  const savedCallback = useRef<() => void>();
  const throttleTimerRef = useRef<NodeJS.Timer | null>(null);
  const lastExecutionRef = useRef<number>(0);

  // Remember the latest callback
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval with throttling
  useEffect(() => {
    const executeCallback = () => {
      const now = Date.now();
      const timeSinceLastExecution = now - lastExecutionRef.current;
      
      if (timeSinceLastExecution >= delay) {
        if (savedCallback.current) {
          savedCallback.current();
          lastExecutionRef.current = now;
        }
      }
    };

    if (delay > 0) {
      throttleTimerRef.current = setInterval(executeCallback, Math.min(delay, 1000));
    }

    return () => {
      if (throttleTimerRef.current) {
        clearInterval(throttleTimerRef.current);
        throttleTimerRef.current = null;
      }
    };
  }, [delay, ...deps]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (throttleTimerRef.current) {
        clearInterval(throttleTimerRef.current);
      }
    };
  }, []);
};

// Custom hook for debounced updates
const useDebouncedCallback = <T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T => {
  const timeoutRef = useRef<NodeJS.Timer | null>(null);
  const callbackRef = useRef<T>(callback);

  // Update callback ref when callback changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const debouncedCallback = useCallback((...args: any[]) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      callbackRef.current(...args);
    }, delay);
  }, [delay]) as T;

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedCallback;
};

// Enhanced data fetching hook with smart caching and error recovery
const useDataFetching = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const lastFetchRef = useRef<number>(0);
  const errorCountRef = useRef<number>(0);
  const mountedRef = useRef(true);

  // Intelligent fetch function with caching and retry logic
  const fetchWithRetry = useCallback(async <T>(
    fetchFunction: () => Promise<T>,
    cacheKey: string,
    maxAge: number = 30000 // 30 seconds default cache
  ): Promise<T | null> => {
    const now = Date.now();
    
    // Check if we should skip fetch due to recent fetch
    if (now - lastFetchRef.current < 1000) { // Minimum 1 second between fetches
      return null;
    }

    try {
      setIsLoading(true);
      const result = await fetchFunction();
      
      if (mountedRef.current) {
        lastFetchRef.current = now;
        errorCountRef.current = 0; // Reset error count on success
        setError(null);
        setRetryCount(0);
      }
      
      return result;
    } catch (err) {
      if (!mountedRef.current) return null;

      errorCountRef.current += 1;
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
      
      debugLog.error(`Fetch error (attempt ${errorCountRef.current}):`, err);
      
      // Implement exponential backoff for retries
      if (errorCountRef.current <= 3) {
        const backoffDelay = Math.min(1000 * Math.pow(2, errorCountRef.current - 1), 8000);
        
        setTimeout(() => {
          if (mountedRef.current) {
            setRetryCount(prev => prev + 1);
          }
        }, backoffDelay);
      } else {
        setError(errorMessage);
      }
      
      return null;
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return { 
    fetchWithRetry, 
    isLoading, 
    error, 
    retryCount,
    clearError: useCallback(() => setError(null), [])
  };
};

// Main hook with enhanced performance and error handling
export const useBorrowLending = () => {
  const { connected, publicKey } = useWallet();
  const [markets, setMarkets] = useState<MarketData[]>([]);
  const [suppliedPositions, setSuppliedPositions] = useState<UserPosition[]>([]);
  const [borrowedPositions, setBorrowedPositions] = useState<UserPosition[]>([]);
  const [analytics, setAnalytics] = useState<ProtocolAnalytics | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [connectionHealth, setConnectionHealth] = useState<boolean>(true);
  const [dataFreshness, setDataFreshness] = useState<{[key: string]: number}>({});
  
  const { fetchWithRetry, isLoading, error, retryCount, clearError } = useDataFetching();
  const updateCountRef = useRef<number>(0);

  // Debounced user position refresh to prevent excessive API calls
  const debouncedUserPositionRefresh = useDebouncedCallback(async () => {
    if (!connected || !publicKey) return;

    const positions = await fetchWithRetry(
      () => solanaDataService.fetchUserPositions(publicKey.toString()),
      `user-positions-${publicKey.toString()}`,
      INTERVALS.USER_POSITION_CACHE
    );

    if (positions) {
      setSuppliedPositions(positions.supplied || []);
      setBorrowedPositions(positions.borrowed || []);
      setDataFreshness(prev => ({ ...prev, userPositions: Date.now() }));
    }
  }, 2000); // 2 second debounce

  // Throttled analytics refresh for real-time updates
  const throttledAnalyticsRefresh = useCallback(async () => {
    updateCountRef.current += 1;
    
    // Skip some updates if we're updating too frequently
    if (updateCountRef.current % 2 === 0 && connectionHealth) {
      const analyticsData = await fetchWithRetry(
        () => solanaDataService.fetchProtocolAnalytics(),
        'protocol-analytics',
        INTERVALS.ANALYTICS_CACHE
      );

      if (analyticsData) {
        setAnalytics(analyticsData);
        setDataFreshness(prev => ({ ...prev, analytics: Date.now() }));
        setLastUpdated(new Date());
      }
    }
  }, [connectionHealth, fetchWithRetry]);

  // Health check with exponential backoff
  const healthCheckWithBackoff = useCallback(async () => {
    try {
      const isHealthy = await solanaDataService.healthCheck();
      setConnectionHealth(isHealthy);
      
      if (!isHealthy && error?.includes("connection")) {
        setError("Solana network connection issues detected");
      } else if (isHealthy && error?.includes("connection")) {
        clearError();
      }
    } catch (err) {
      debugLog.error("Health check failed:", err);
      setConnectionHealth(false);
    }
  }, [error, clearError]);

  // Use throttled intervals instead of raw setInterval
  useThrottledInterval(
    throttledAnalyticsRefresh,
    connectionHealth ? INTERVALS.REAL_TIME_UPDATE : INTERVALS.SLOW_UPDATE,
    [connected, connectionHealth]
  );

  useThrottledInterval(
    healthCheckWithBackoff,
    INTERVALS.HEALTH_CHECK,
    [error]
  );

  // Smart user position updates - only when wallet changes or data is stale
  useEffect(() => {
    if (connected && publicKey) {
      const userDataAge = Date.now() - (dataFreshness.userPositions || 0);
      
      // Refresh if data is older than cache threshold
      if (userDataAge > INTERVALS.USER_POSITION_CACHE) {
        debouncedUserPositionRefresh();
      }
    } else {
      // Clear user positions when wallet is disconnected
      setSuppliedPositions([]);
      setBorrowedPositions([]);
    }
  }, [connected, publicKey, debouncedUserPositionRefresh, dataFreshness.userPositions]);

  // Initial data fetch with smart caching
  useEffect(() => {
    const initializeData = async () => {
      try {
        // Fetch market data (always available)
        const marketData = await fetchWithRetry(
          () => solanaDataService.fetchMarketData(),
          'market-data',
          INTERVALS.MARKET_DATA_CACHE
        );

        if (marketData) {
          setMarkets(marketData);
          setDataFreshness(prev => ({ ...prev, markets: Date.now() }));
        }

        // Fetch protocol analytics
        const analyticsData = await fetchWithRetry(
          () => solanaDataService.fetchProtocolAnalytics(),
          'protocol-analytics',
          INTERVALS.ANALYTICS_CACHE
        );

        if (analyticsData) {
          setAnalytics(analyticsData);
          setDataFreshness(prev => ({ ...prev, analytics: Date.now() }));
        }

        setLastUpdated(new Date());
        debugLog.info("Successfully loaded data from Solana network");
      } catch (err) {
        debugLog.error("Error during initial data fetch:", err);
      }
    };

    initializeData();
  }, []); // Only run once on mount

  // Manual refresh function with rate limiting
  const refreshData = useCallback(async () => {
    const now = Date.now();
    const lastRefresh = Math.max(
      dataFreshness.markets || 0,
      dataFreshness.analytics || 0,
      dataFreshness.userPositions || 0
    );

    // Rate limit manual refreshes to once every 5 seconds
    if (now - lastRefresh < 5000) {
      debugLog.warn("Refresh rate limited - please wait");
      return;
    }

    try {
      clearError();

      const [marketData, analyticsData] = await Promise.all([
        fetchWithRetry(
          () => solanaDataService.fetchMarketData(),
          'market-data-refresh',
          0 // Force fresh fetch
        ),
        fetchWithRetry(
          () => solanaDataService.fetchProtocolAnalytics(),
          'analytics-refresh',
          0 // Force fresh fetch
        ),
      ]);
      
      if (marketData) {
        setMarkets(marketData);
        setDataFreshness(prev => ({ ...prev, markets: now }));
      }
      
      if (analyticsData) {
        setAnalytics(analyticsData);
        setDataFreshness(prev => ({ ...prev, analytics: now }));
      }
      
      if (connected && publicKey) {
        debouncedUserPositionRefresh();
      }
      
      setLastUpdated(new Date());
    } catch (err) {
      debugLog.error("Error refreshing data:", err);
    }
  }, [connected, publicKey, fetchWithRetry, clearError, debouncedUserPositionRefresh, dataFreshness]);

  // Calculate data freshness indicators
  const dataFreshnessStatus = {
    markets: Date.now() - (dataFreshness.markets || 0),
    analytics: Date.now() - (dataFreshness.analytics || 0),
    userPositions: Date.now() - (dataFreshness.userPositions || 0),
  };

  return {
    isLoading,
    error,
    markets,
    suppliedPositions,
    borrowedPositions,
    analytics,
    lastUpdated,
    connectionHealth,
    retryCount,
    dataFreshness: dataFreshnessStatus,
    refreshData,
    clearError,
  };
};
