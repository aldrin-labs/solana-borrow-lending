import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { 
  solanaDataService, 
  MarketData, 
  ProtocolAnalytics, 
  UserPosition 
} from "@/services/solanaDataService";
import { debugLog } from "@/utils/debug";

export const useBorrowLending = () => {
  const { connected, publicKey } = useWallet();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markets, setMarkets] = useState<MarketData[]>([]);
  const [suppliedPositions, setSuppliedPositions] = useState<UserPosition[]>([]);
  const [borrowedPositions, setBorrowedPositions] = useState<UserPosition[]>([]);
  const [analytics, setAnalytics] = useState<ProtocolAnalytics | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [connectionHealth, setConnectionHealth] = useState<boolean>(true);

  // Real-time updates with proper async error handling
  useEffect(() => {
    if (!connected) return;

    const updateData = async () => {
      try {
        // Only update if connection is healthy
        if (!connectionHealth) {
          debugLog.network("Skipping real-time update due to connection issues");
          return;
        }

        // Refresh analytics data for real-time updates
        const freshAnalytics = await solanaDataService.fetchProtocolAnalytics();
        setAnalytics(freshAnalytics);
        
        // Update user positions if wallet is connected
        if (publicKey) {
          const positions = await solanaDataService.fetchUserPositions(publicKey.toString());
          setSuppliedPositions(positions?.supplied || []);
          setBorrowedPositions(positions?.borrowed || []);
        }
        
        setLastUpdated(new Date());
        setError(null);
      } catch (err) {
        debugLog.error("Error updating real-time data:", err);
        // Don't set error for real-time updates, just log it
        // The user can still use cached data
      }
    };

    const interval = setInterval(updateData, 15000); // Update every 15 seconds for real data

    return () => clearInterval(interval);
  }, [connected, publicKey, connectionHealth]);

  // Check Solana connection health with proper error handling
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const isHealthy = await solanaDataService.healthCheck();
        setConnectionHealth(isHealthy);
        if (!isHealthy) {
          setError("Solana network connection issues detected");
        } else {
          // Clear error if connection is restored
          if (error?.includes("connection")) {
            setError(null);
          }
        }
      } catch (err) {
        debugLog.error("Health check failed:", err);
        setConnectionHealth(false);
        setError("Unable to connect to Solana network");
      }
    };

    // Use async wrapper to handle errors properly
    const performHealthCheck = () => {
      checkHealth().catch((err) => {
        debugLog.error("Unhandled health check error:", err);
      });
    };

    performHealthCheck();
    const healthInterval = setInterval(performHealthCheck, 60000); // Check every minute

    return () => clearInterval(healthInterval);
  }, [error]);

  // Fetch initial data from Solana network
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch market data (always available)
        debugLog.network("Fetching market data from Solana...");
        const marketData = await solanaDataService.fetchMarketData();
        setMarkets(marketData || []);

        // Fetch protocol analytics
        debugLog.network("Fetching protocol analytics...");
        const analyticsData = await solanaDataService.fetchProtocolAnalytics();
        setAnalytics(analyticsData);

        // Fetch user positions if wallet is connected
        if (connected && publicKey) {
          debugLog.wallet("Fetching user positions for wallet:", publicKey.toString());
          try {
            const positions = await solanaDataService.fetchUserPositions(publicKey.toString());
            setSuppliedPositions(positions?.supplied || []);
            setBorrowedPositions(positions?.borrowed || []);
          } catch (userErr) {
            debugLog.warn("Failed to fetch user positions:", userErr);
            // Don't fail the entire data fetch if user positions fail
            setSuppliedPositions([]);
            setBorrowedPositions([]);
          }
        } else {
          // Clear user positions when wallet is disconnected
          setSuppliedPositions([]);
          setBorrowedPositions([]);
        }

        setLastUpdated(new Date());
        debugLog.info("Successfully loaded data from Solana network");
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to fetch data from Solana network";
        setError(errorMessage);
        debugLog.error("Error fetching Solana data:", err);
        
        // Set empty data on error to prevent showing stale mock data
        setMarkets([]);
        setAnalytics(null);
        setSuppliedPositions([]);
        setBorrowedPositions([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [connected, publicKey]);

  // Refresh data function for manual refresh
  const refreshData = async () => {
    setIsLoading(true);
    try {
      const [marketData, analyticsData] = await Promise.all([
        solanaDataService.fetchMarketData(),
        solanaDataService.fetchProtocolAnalytics(),
      ]);
      
      setMarkets(marketData || []);
      setAnalytics(analyticsData);
      
      if (connected && publicKey) {
        try {
          const positions = await solanaDataService.fetchUserPositions(publicKey.toString());
          setSuppliedPositions(positions?.supplied || []);
          setBorrowedPositions(positions?.borrowed || []);
        } catch (userErr) {
          debugLog.warn("Failed to refresh user positions:", userErr);
          // Keep existing positions if refresh fails
        }
      }
      
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      debugLog.error("Error refreshing data:", err);
      setError("Failed to refresh data");
    } finally {
      setIsLoading(false);
    }
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
    refreshData,
  };
};
