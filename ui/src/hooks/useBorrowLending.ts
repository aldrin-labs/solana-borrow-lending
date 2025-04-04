import { FC, useState, useEffect } from "react";
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

export const useBorrowLending = () => {
  const { connected } = useWallet();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markets, setMarkets] = useState<any[]>([]);
  const [suppliedPositions, setSuppliedPositions] = useState<any[]>([]);
  const [borrowedPositions, setBorrowedPositions] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);

        // Simulate API call delay
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Set mock data
        setMarkets(mockMarkets);

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
  };
};
