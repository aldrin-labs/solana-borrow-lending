import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

// Mock data for demonstration purposes
const mockMarkets = [
  {
    id: "1",
    token: "SOL",
    totalSupply: "$45,678,901",
    supplyApy: "3.2%",
    totalBorrow: "$23,456,789",
    borrowApy: "5.8%",
    utilizationRate: "51%",
  },
  {
    id: "2",
    token: "USDC",
    totalSupply: "$78,901,234",
    supplyApy: "2.5%",
    totalBorrow: "$34,567,890",
    borrowApy: "4.2%",
    utilizationRate: "44%",
  },
  {
    id: "3",
    token: "ETH",
    totalSupply: "$12,345,678",
    supplyApy: "2.8%",
    totalBorrow: "$5,678,901",
    borrowApy: "4.5%",
    utilizationRate: "46%",
  },
  {
    id: "4",
    token: "BTC",
    totalSupply: "$23,456,789",
    supplyApy: "2.1%",
    totalBorrow: "$10,123,456",
    borrowApy: "3.9%",
    utilizationRate: "43%",
  },
];

const mockSuppliedPositions = [
  {
    id: "1",
    token: "SOL",
    amount: "5.0 SOL",
    value: "$500.00",
    apy: "3.2%",
    collateral: true,
  },
  {
    id: "2",
    token: "USDC",
    amount: "1,000 USDC",
    value: "$1,000.00",
    apy: "2.5%",
    collateral: true,
  },
];

const mockBorrowedPositions = [
  {
    id: "1",
    token: "USDC",
    amount: "450 USDC",
    value: "$450.00",
    apy: "4.2%",
    healthFactor: 1.8,
  },
];

// Generate mock trend data for analytics
const generateTrendData = (baseValue: number, days: number = 7) => {
  const data = [];
  const now = new Date();
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const variance = (Math.random() - 0.5) * 0.1; // ±5% variance
    const value = baseValue * (1 + variance);
    
    data.push({
      time: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: Math.round(value),
    });
  }
  
  return data;
};

// Generate utilization trend data
const generateUtilizationData = (baseRate: number, days: number = 7) => {
  const data = [];
  const now = new Date();
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const variance = (Math.random() - 0.5) * 10; // ±5% variance
    const utilization = Math.max(0, Math.min(100, baseRate + variance));
    
    data.push({
      time: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      utilization: Math.round(utilization * 10) / 10,
    });
  }
  
  return data;
};

// Generate APY comparison data
const generateAPYComparisonData = () => {
  return mockMarkets.map(market => ({
    token: market.token,
    supplyAPY: parseFloat(market.supplyApy.replace('%', '')),
    borrowAPY: parseFloat(market.borrowApy.replace('%', '')),
  }));
};

// Protocol analytics data
const getProtocolAnalytics = () => {
  return {
    totalValueLocked: generateTrendData(123456789),
    totalBorrowed: generateTrendData(45678901),
    totalSupplied: generateTrendData(78901234),
    utilizationTrend: generateUtilizationData(48),
    apyComparison: generateAPYComparisonData(),
    healthFactor: 1.85,
    liquidationThreshold: 80,
  };
};

export const useBorrowLending = () => {
  const { connected } = useWallet();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markets, setMarkets] = useState<any[]>([]);
  const [suppliedPositions, setSuppliedPositions] = useState<any[]>([]);
  const [borrowedPositions, setBorrowedPositions] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Simulated real-time updates
  useEffect(() => {
    if (!connected) return;

    const interval = setInterval(() => {
      // Simulate small data fluctuations for real-time effect
      setAnalytics((prev: any) => {
        if (!prev) return prev;
        
        return {
          ...prev,
          healthFactor: Math.max(1.0, prev.healthFactor + (Math.random() - 0.5) * 0.1),
          totalValueLocked: prev.totalValueLocked.map((item: any, index: number) => 
            index === prev.totalValueLocked.length - 1 
              ? { ...item, value: Math.round(item.value * (1 + (Math.random() - 0.5) * 0.02)) }
              : item
          ),
        };
      });
      setLastUpdated(new Date());
    }, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, [connected]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);

        // Simulate API call delay
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Set mock data
        setMarkets(mockMarkets);
        setAnalytics(getProtocolAnalytics());

        if (connected) {
          setSuppliedPositions(mockSuppliedPositions);
          setBorrowedPositions(mockBorrowedPositions);
        } else {
          setSuppliedPositions([]);
          setBorrowedPositions([]);
        }

        setError(null);
      } catch (err) {
        setError("Failed to fetch data. Please try again later.");
        console.error("Error fetching data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [connected]);

  return {
    isLoading,
    error,
    markets,
    suppliedPositions,
    borrowedPositions,
    analytics,
    lastUpdated,
  };
};
