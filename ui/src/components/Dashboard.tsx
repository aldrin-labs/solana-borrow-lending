"use client";

import { FC, useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { MarketOverview } from "./MarketOverview";
import { UserPositions } from "./UserPositions";
import { StatsCard } from "./StatsCard";
import { AnalyticsDashboard } from "./AnalyticsDashboard";
import { Card } from "./Card";
import { solanaDataService } from "@/services/solanaDataService";
import { LoadingSpinner } from "./LoadingSpinner";

export const Dashboard: FC = () => {
  const { connected } = useWallet();
  const [activeTab, setActiveTab] = useState<"overview" | "positions" | "analytics">(
    "overview",
  );
  const [protocolStats, setProtocolStats] = useState({
    totalValueLocked: "$0",
    totalBorrowed: "$0", 
    totalSupplied: "$0",
    tvlChange: "0%",
    borrowedChange: "0%",
    suppliedChange: "0%",
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProtocolStats = async () => {
      try {
        const [markets, analytics] = await Promise.all([
          solanaDataService.fetchMarketData(),
          solanaDataService.fetchProtocolAnalytics(),
        ]);

        // Calculate real totals from market data
        const totalSupplied = markets.reduce((sum, market) => {
          const value = parseInt(market.totalSupply.replace(/[$,]/g, ''));
          return sum + value;
        }, 0);

        const totalBorrowed = markets.reduce((sum, market) => {
          const value = parseInt(market.totalBorrow.replace(/[$,]/g, ''));
          return sum + value;
        }, 0);

        const totalValueLocked = totalSupplied;

        // Calculate changes from analytics data
        const tvlData = analytics.totalValueLocked;
        const borrowedData = analytics.totalBorrowed;
        const suppliedData = analytics.totalSupplied;

        const calculateChange = (data: Array<{ time: string; value: number }>) => {
          if (data.length < 2) return "0%";
          const current = data[data.length - 1].value;
          const previous = data[data.length - 2].value;
          const change = ((current - previous) / previous) * 100;
          return `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
        };

        setProtocolStats({
          totalValueLocked: `$${totalValueLocked.toLocaleString()}`,
          totalBorrowed: `$${totalBorrowed.toLocaleString()}`,
          totalSupplied: `$${totalSupplied.toLocaleString()}`,
          tvlChange: calculateChange(tvlData),
          borrowedChange: calculateChange(borrowedData),
          suppliedChange: calculateChange(suppliedData),
        });
      } catch (error) {
        console.error('Error fetching protocol stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProtocolStats();
    
    // Update every 30 seconds
    const interval = setInterval(fetchProtocolStats, 30000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 animate-fade-in">
      <div className="mb-8">
        <h1 className="typography-display-2 mb-2">
          Protocol Dashboard
        </h1>
        <p className="typography-body-lg">
          Real-time protocol metrics and lending market overview
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatsCard
            title="Total Value Locked"
            value={protocolStats.totalValueLocked}
            change={protocolStats.tvlChange}
            isPositive={!protocolStats.tvlChange.startsWith('-')}
            tooltip="Total assets deposited across all markets"
          />
          <StatsCard
            title="Total Borrowed"
            value={protocolStats.totalBorrowed}
            change={protocolStats.borrowedChange}
            isPositive={!protocolStats.borrowedChange.startsWith('-')}
            tooltip="Total amount borrowed by all users"
          />
          <StatsCard
            title="Total Supplied"
            value={protocolStats.totalSupplied}
            change={protocolStats.suppliedChange}
            isPositive={!protocolStats.suppliedChange.startsWith('-')}
            tooltip="Total assets supplied by all users"
          />
        </div>
      )}

      {connected ? (
        <Card className="animate-slide-up">
          <div className="border-b border-border pb-6 mb-6">
            <div className="flex space-x-1">
              <button
                className={`py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
                  activeTab === "overview"
                    ? "border"
                    : "hover:bg-opacity-10"
                }`}
                style={{
                  color: activeTab === "overview" ? 'var(--theme-primary)' : 'var(--theme-textSecondary)',
                  backgroundColor: activeTab === "overview" ? 'color-mix(in srgb, var(--theme-primary) 10%, transparent)' : 'transparent',
                  borderColor: activeTab === "overview" ? 'color-mix(in srgb, var(--theme-primary) 20%, transparent)' : 'transparent',
                }}
                onClick={() => setActiveTab("overview")}
              >
                Market Overview
              </button>
              <button
                className={`py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
                  activeTab === "positions"
                    ? "border"
                    : "hover:bg-opacity-10"
                }`}
                style={{
                  color: activeTab === "positions" ? 'var(--theme-primary)' : 'var(--theme-textSecondary)',
                  backgroundColor: activeTab === "positions" ? 'color-mix(in srgb, var(--theme-primary) 10%, transparent)' : 'transparent',
                  borderColor: activeTab === "positions" ? 'color-mix(in srgb, var(--theme-primary) 20%, transparent)' : 'transparent',
                }}
                onClick={() => setActiveTab("positions")}
              >
                Your Positions
              </button>
              <button
                className={`py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
                  activeTab === "analytics"
                    ? "border"
                    : "hover:bg-opacity-10"
                }`}
                style={{
                  color: activeTab === "analytics" ? 'var(--theme-primary)' : 'var(--theme-textSecondary)',
                  backgroundColor: activeTab === "analytics" ? 'color-mix(in srgb, var(--theme-primary) 10%, transparent)' : 'transparent',
                  borderColor: activeTab === "analytics" ? 'color-mix(in srgb, var(--theme-primary) 20%, transparent)' : 'transparent',
                }}
                onClick={() => setActiveTab("analytics")}
              >
                Analytics
              </button>
            </div>
          </div>

          <div className="animate-slide-up">
            {activeTab === "overview" && <MarketOverview />}
            {activeTab === "positions" && <UserPositions />}
            {activeTab === "analytics" && <AnalyticsDashboard userType="overview" />}
          </div>
        </Card>
      ) : (
        <Card className="text-center py-16 animate-scale-in">
          <div className="max-w-md mx-auto">
            <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary-dark rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            
            <h2 className="text-2xl font-semibold text-text-primary mb-3">
              Connect Your Wallet
            </h2>
            <p className="text-text-secondary mb-8">
              Connect your wallet to view your positions and interact with the lending protocol
            </p>
            <button className="btn-connect">
              Connect Wallet
            </button>
          </div>
        </Card>
      )}
    </div>
  );
};
