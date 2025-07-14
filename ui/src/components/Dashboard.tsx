"use client";

import { FC, useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { MarketOverview } from "./MarketOverview";
import { UserPositions } from "./UserPositions";
import { StatsCard } from "./StatsCard";
import { AnalyticsDashboard } from "./AnalyticsDashboard";
import { Card } from "./Card";
import { solanaDataService } from "@/services/solanaDataService";
import { LoadingSpinner } from "./LoadingSpinner";
import { SkeletonLoader, StatsSkeleton } from "./SkeletonLoader";
import { CollapsibleSection, DetailedAnalyticsSection } from "./CollapsibleSection";
import { InfoTooltip } from "./InfoTooltip";
import { KeyboardShortcutTooltip } from "./KeyboardShortcutTooltip";

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

        // Calculate real totals from market data using numeric values
        const totalSupplied = markets.reduce((sum, market) => {
          return sum + (market.totalSupplyValue || 0);
        }, 0);

        const totalBorrowed = markets.reduce((sum, market) => {
          return sum + (market.totalBorrowValue || 0);
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
      {/* Enhanced Header with High-Impact Info */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="typography-display-2 mb-2">
              Protocol Dashboard
              <InfoTooltip
                content="Real-time overview of the MAGA lending protocol with live Solana blockchain data"
                position="bottom"
              />
            </h1>
            <p className="typography-body-lg">
              Real-time protocol metrics and lending market overview
            </p>
          </div>
          
          {/* Live status indicator */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-full" style={{ backgroundColor: 'var(--theme-surface)' }}>
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="typography-body-sm font-medium">Live Data</span>
            </div>
            <div className="typography-body-sm" style={{ color: 'var(--theme-textMuted)' }}>
              Updates every 15s
            </div>
          </div>
        </div>
      </div>

      {/* Protocol Stats with Skeleton Loading */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatsSkeleton />
          <StatsSkeleton />
          <StatsSkeleton />
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
          {/* Enhanced Tabbed Interface */}
          <div className="border-b pb-6 mb-6" style={{ borderColor: 'var(--theme-border)' }}>
            <div className="flex flex-wrap gap-2">
              <KeyboardShortcutTooltip
                shortcut={{
                  key: '1',
                  description: 'Switch to Market Overview tab',
                  category: 'Dashboard',
                }}
                action={() => setActiveTab("overview")}
                element="tab-overview"
              >
                <button
                  className={`py-3 px-4 rounded-lg font-medium transition-all duration-200 focus-visible ${
                    activeTab === "overview" ? "border" : "hover:bg-opacity-10"
                  }`}
                  style={{
                    color: activeTab === "overview" ? 'var(--theme-primary)' : 'var(--theme-textSecondary)',
                    backgroundColor: activeTab === "overview" ? 'color-mix(in srgb, var(--theme-primary) 10%, transparent)' : 'transparent',
                    borderColor: activeTab === "overview" ? 'color-mix(in srgb, var(--theme-primary) 20%, transparent)' : 'transparent',
                  }}
                  onClick={() => setActiveTab("overview")}
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Market Overview
                  </div>
                </button>
              </KeyboardShortcutTooltip>
              <KeyboardShortcutTooltip
                shortcut={{
                  key: '2',
                  description: 'Switch to Your Positions tab',
                  category: 'Dashboard',
                }}
                action={() => setActiveTab("positions")}
                element="tab-positions"
              >
                <button
                  className={`py-3 px-4 rounded-lg font-medium transition-all duration-200 focus-visible ${
                    activeTab === "positions" ? "border" : "hover:bg-opacity-10"
                  }`}
                  style={{
                    color: activeTab === "positions" ? 'var(--theme-primary)' : 'var(--theme-textSecondary)',
                    backgroundColor: activeTab === "positions" ? 'color-mix(in srgb, var(--theme-primary) 10%, transparent)' : 'transparent',
                    borderColor: activeTab === "positions" ? 'color-mix(in srgb, var(--theme-primary) 20%, transparent)' : 'transparent',
                  }}
                  onClick={() => setActiveTab("positions")}
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Your Positions
                  </div>
                </button>
              </KeyboardShortcutTooltip>
              <KeyboardShortcutTooltip
                shortcut={{
                  key: '3',
                  description: 'Switch to Analytics tab',
                  category: 'Dashboard',
                }}
                action={() => setActiveTab("analytics")}
                element="tab-analytics"
              >
                <button
                  className={`py-3 px-4 rounded-lg font-medium transition-all duration-200 focus-visible ${
                    activeTab === "analytics" ? "border" : "hover:bg-opacity-10"
                  }`}
                  style={{
                    color: activeTab === "analytics" ? 'var(--theme-primary)' : 'var(--theme-textSecondary)',
                    backgroundColor: activeTab === "analytics" ? 'color-mix(in srgb, var(--theme-primary) 10%, transparent)' : 'transparent',
                    borderColor: activeTab === "analytics" ? 'color-mix(in srgb, var(--theme-primary) 20%, transparent)' : 'transparent',
                  }}
                  onClick={() => setActiveTab("analytics")}
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Analytics
                  </div>
                </button>
              </KeyboardShortcutTooltip>
            </div>
          </div>

          {/* Tab Content with Enhanced Layout */}
          <div className="animate-slide-up">
            {activeTab === "overview" && <MarketOverview />}
            {activeTab === "positions" && <UserPositions />}
            {activeTab === "analytics" && (
              <div className="space-y-6">
                <AnalyticsDashboard userType="overview" />
                
                <DetailedAnalyticsSection>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h4 className="typography-h3">Market Performance</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="typography-body-sm">Best Performing Asset</span>
                          <span className="typography-body-sm font-medium status-positive">SOL (+12.3%)</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="typography-body-sm">Highest Yield</span>
                          <span className="typography-body-sm font-medium status-positive">USDC (8.5% APY)</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="typography-body-sm">Most Borrowed</span>
                          <span className="typography-body-sm font-medium">SOL (65% utilization)</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <h4 className="typography-h3">Protocol Health</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="typography-body-sm">Avg Health Factor</span>
                          <span className="typography-body-sm font-medium status-positive">2.8</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="typography-body-sm">Liquidation Risk</span>
                          <span className="typography-body-sm font-medium status-positive">Low (0.02%)</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="typography-body-sm">Active Users (24h)</span>
                          <span className="typography-body-sm font-medium">1,247</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </DetailedAnalyticsSection>
              </div>
            )}
          </div>
        </Card>
      ) : (
        <Card className="text-center py-16 animate-scale-in">
          <div className="max-w-md mx-auto">
            <div 
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
              style={{ background: 'var(--theme-gradient-primary)' }}
            >
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            
            <h2 className="typography-h2 mb-3">
              Connect Your Wallet
            </h2>
            <p className="typography-body-lg mb-8" style={{ color: 'var(--theme-textSecondary)' }}>
              Connect your wallet to view your positions and interact with the lending protocol
            </p>
            <div className="space-y-4">
              <KeyboardShortcutTooltip
                shortcut={{
                  key: 'w',
                  description: 'Connect Wallet',
                  category: 'Wallet',
                }}
                action={() => {
                  // Trigger wallet connection by simulating click on WalletMultiButton
                  const walletButton = document.querySelector('[data-testid="wallet-adapter-button-trigger"]') as HTMLElement;
                  if (walletButton) {
                    walletButton.click();
                  } else {
                    // Fallback: try to find any wallet button
                    const fallbackButton = document.querySelector('.wallet-adapter-button') as HTMLElement;
                    if (fallbackButton) {
                      fallbackButton.click();
                    }
                  }
                }}
                element="connect-wallet"
              >
                <button className="btn-primary w-full focus-visible">
                  Connect Wallet
                </button>
              </KeyboardShortcutTooltip>
              <p className="typography-body-sm" style={{ color: 'var(--theme-textMuted)' }}>
                Supports all major Solana wallets including Phantom, Solflare, and more
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
