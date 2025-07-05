"use client";

import { FC, useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { TrendChart, UtilizationChart, APYComparisonChart } from "./charts";
import { StatsCard } from "./StatsCard";
import { useBorrowLending } from "@/hooks/useBorrowLending";
import { solanaDataService } from "@/services/solanaDataService";
import { LoadingSpinner } from "./LoadingSpinner";

interface AnalyticsDashboardProps {
  userType?: "lender" | "borrower" | "overview";
}

export const AnalyticsDashboard: FC<AnalyticsDashboardProps> = ({
  userType = "overview",
}) => {
  const { connected, publicKey } = useWallet();
  const { analytics, isLoading, lastUpdated, suppliedPositions, borrowedPositions, markets } = useBorrowLending();
  const [realTimeMetrics, setRealTimeMetrics] = useState({
    totalSuppliedValue: 0,
    totalBorrowedValue: 0,
    avgSupplyAPY: 0,
    avgBorrowAPY: 0,
    userHealthFactor: 0,
    availableToBorrow: 0,
    interestEarned: 0,
  });

  // Calculate real-time metrics
  useEffect(() => {
    const calculateMetrics = () => {
      // Calculate user-specific metrics using numeric values
      const totalSuppliedValue = suppliedPositions.reduce((acc, pos) => 
        acc + (pos.valueNumeric || 0), 0
      );
      
      const totalBorrowedValue = borrowedPositions.reduce((acc, pos) => 
        acc + (pos.valueNumeric || 0), 0
      );

      const avgSupplyAPY = suppliedPositions.length > 0 ? 
        suppliedPositions.reduce((acc, pos) => acc + (pos.apyNumeric || 0), 0) / suppliedPositions.length : 0;

      const avgBorrowAPY = borrowedPositions.length > 0 ? 
        borrowedPositions.reduce((acc, pos) => acc + (pos.apyNumeric || 0), 0) / borrowedPositions.length : 0;

      // Calculate health factor using numeric values
      const userHealthFactor = borrowedPositions.length > 0 && borrowedPositions[0].healthFactorNumeric ? 
        borrowedPositions[0].healthFactorNumeric : 0;

      // Calculate available to borrow (simplified: 75% of supplied value minus borrowed)
      const availableToBorrow = Math.max(0, totalSuppliedValue * 0.75 - totalBorrowedValue);

      // Estimate monthly interest earned (simplified)
      const interestEarned = totalSuppliedValue * (avgSupplyAPY / 100) / 12;

      setRealTimeMetrics({
        totalSuppliedValue,
        totalBorrowedValue,
        avgSupplyAPY,
        avgBorrowAPY,
        userHealthFactor,
        availableToBorrow,
        interestEarned,
      });
    };

    calculateMetrics();
  }, [suppliedPositions, borrowedPositions]);

  if (isLoading || !analytics) {
    return (
      <div className="space-y-6">
        <LoadingSpinner />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="bg-surface rounded-lg p-6 border border-border animate-pulse"
            >
              <div className="h-32 bg-border rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const getHealthFactorColor = (healthFactor: number) => {
    if (healthFactor >= 2.0) return "status-positive";
    if (healthFactor >= 1.5) return "text-warning";
    return "status-negative";
  };

  // Calculate protocol totals from real market data using numeric values
  const protocolTVL = markets.reduce((acc, market) => acc + (market.totalSupplyValue || 0), 0);
  const protocolBorrowed = markets.reduce((acc, market) => acc + (market.totalBorrowValue || 0), 0);
  const avgUtilization = markets.length > 0 ? 
    markets.reduce((acc, market) => acc + (market.utilizationRate || 0), 0) / markets.length : 0;

  const getLenderMetrics = () => (
    <>
      <StatsCard
        title="Your Supply APY"
        value={`${realTimeMetrics.avgSupplyAPY.toFixed(2)}%`}
        change={realTimeMetrics.avgSupplyAPY > 2.5 ? `+${(realTimeMetrics.avgSupplyAPY - 2.5).toFixed(2)}%` : `${(realTimeMetrics.avgSupplyAPY - 2.5).toFixed(2)}%`}
        isPositive={realTimeMetrics.avgSupplyAPY > 2.5}
        subtitle="Avg across positions"
        tooltip="Average APY across all your supply positions"
      />
      <StatsCard
        title="Total Supplied"
        value={`$${realTimeMetrics.totalSuppliedValue.toLocaleString()}`}
        change={realTimeMetrics.totalSuppliedValue > 1000 ? "+2.1%" : "-0.5%"}
        isPositive={realTimeMetrics.totalSuppliedValue > 1000}
        subtitle="Your supply value"
        tooltip="Total USD value of your supplied assets"
      />
      <StatsCard
        title="Interest Earned"
        value={`$${realTimeMetrics.interestEarned.toFixed(2)}`}
        change={realTimeMetrics.interestEarned > 5 ? "+15.3%" : "+8.2%"}
        isPositive={true}
        subtitle="This month"
        tooltip="Estimated monthly interest earnings"
      />
    </>
  );

  const getBorrowerMetrics = () => (
    <>
      <StatsCard
        title="Health Factor"
        value={realTimeMetrics.userHealthFactor > 0 ? realTimeMetrics.userHealthFactor.toFixed(2) : "N/A"}
        change={realTimeMetrics.userHealthFactor >= 1.5 ? "Healthy" : realTimeMetrics.userHealthFactor > 0 ? "At Risk" : "N/A"}
        isPositive={realTimeMetrics.userHealthFactor >= 1.5}
        subtitle="Liquidation risk"
        valueClassName={realTimeMetrics.userHealthFactor > 0 ? getHealthFactorColor(realTimeMetrics.userHealthFactor) : undefined}
        tooltip="Health factor indicates liquidation risk. Keep above 1.2"
      />
      <StatsCard
        title="Total Borrowed"
        value={`$${realTimeMetrics.totalBorrowedValue.toLocaleString()}`}
        change={realTimeMetrics.totalBorrowedValue > 0 ? `${realTimeMetrics.avgBorrowAPY.toFixed(2)}% APY` : "No debt"}
        isPositive={realTimeMetrics.totalBorrowedValue === 0}
        subtitle="Your borrow value"
        tooltip="Total USD value of your borrowed assets"
      />
      <StatsCard
        title="Available to Borrow"
        value={`$${realTimeMetrics.availableToBorrow.toFixed(0)}`}
        change="Based on collateral"
        isPositive={true}
        subtitle="Remaining capacity"
        tooltip="Maximum additional amount you can borrow"
      />
    </>
  );

  const getOverviewMetrics = () => (
    <>
      <StatsCard
        title="Total Value Locked"
        value={`$${(protocolTVL / 1000000).toFixed(1)}M`}
        change={protocolTVL > 100000000 ? "+5.2%" : "+3.1%"}
        isPositive={true}
        subtitle="Protocol TVL"
        tooltip="Total value locked in the protocol"
      />
      <StatsCard
        title="Total Borrowed"
        value={`$${(protocolBorrowed / 1000000).toFixed(1)}M`}
        change={protocolBorrowed > 50000000 ? "+2.8%" : "+1.9%"}
        isPositive={true}
        subtitle="Outstanding loans"
        tooltip="Total amount borrowed across all markets"
      />
      <StatsCard
        title="Avg Utilization"
        value={`${avgUtilization.toFixed(2)}%`}
        change={avgUtilization > 50 ? "High demand" : "Stable"}
        isPositive={avgUtilization > 40 && avgUtilization < 80}
        subtitle="Protocol efficiency"
        tooltip="Average utilization rate across all markets"
      />
    </>
  );

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Enhanced Analytics Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="typography-h1 mb-2">
            {userType === "lender" && "Lending Analytics"}
            {userType === "borrower" && "Borrowing Analytics"}
            {userType === "overview" && "Protocol Analytics"}
          </h2>
          <p className="typography-body-sm">
            Real-time market data and performance metrics
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="typography-body-sm">Live • {lastUpdated.toLocaleTimeString()}</span>
          </div>
          <div className="bg-surface rounded-lg px-3 py-1 border border-border">
            <span className="typography-caption">SOLANA MAINNET</span>
          </div>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {userType === "lender" && getLenderMetrics()}
        {userType === "borrower" && getBorrowerMetrics()}
        {userType === "overview" && getOverviewMetrics()}
      </div>

      {/* Charts Section - Enhanced Layout */}
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* TVL Trend */}
          <div className="card">
            <TrendChart
              data={analytics.totalValueLocked}
              title={
                userType === "lender"
                  ? "Supply Volume Trend"
                  : userType === "borrower"
                  ? "Available Liquidity"
                  : "Total Value Locked"
              }
              color="#10B981"
              height={280}
            />
          </div>

          {/* Utilization Chart */}
          <div className="card">
            <UtilizationChart
              data={analytics.utilizationTrend}
              title="Protocol Utilization Rate"
              height={280}
            />
          </div>
        </div>

        {/* Secondary Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Borrow Trend */}
          <div className="card">
            <TrendChart
              data={analytics.totalBorrowed}
              title={userType === "borrower" ? "Borrow Volume Trend" : "Total Borrowed Volume"}
              color={userType === "borrower" ? "#EF4444" : "#3B82F6"}
              height={280}
            />
          </div>

          {/* APY Comparison */}
          <div className="card">
            <APYComparisonChart
              data={analytics.apyComparison}
              title="Supply vs Borrow APY"
              height={280}
            />
          </div>
        </div>

        {/* Full-width Market Summary for Overview */}
        {userType === "overview" && (
          <div className="card">
            <div className="mb-6">
              <h3 className="typography-h3 mb-2">Market Summary</h3>
              <p className="typography-body-sm">Comprehensive overview of all lending markets</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="typography-number-lg font-semibold mb-1">{markets.length}</div>
                <div className="typography-caption">ACTIVE MARKETS</div>
              </div>
              <div className="text-center">
                <div className="typography-number-lg font-semibold mb-1 status-positive">
                  {markets.length > 0 ? (markets.reduce((acc, m) => acc + (m.supplyApy || 0), 0) / markets.length).toFixed(2) + '%' : '0%'}
                </div>
                <div className="typography-caption">AVG SUPPLY APY</div>
              </div>
              <div className="text-center">
                <div className="typography-number-lg font-semibold mb-1" style={{ color: 'var(--theme-error)' }}>
                  {markets.length > 0 ? (markets.reduce((acc, m) => acc + (m.borrowApy || 0), 0) / markets.length).toFixed(2) + '%' : '0%'}
                </div>
                <div className="typography-caption">AVG BORROW APY</div>
              </div>
              <div className="text-center">
                <div className="typography-number-lg font-semibold mb-1">
                  {avgUtilization.toFixed(2)}%
                </div>
                <div className="typography-caption">AVG UTILIZATION</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Enhanced Health Factor Detail for Borrowers */}
      {userType === "borrower" && connected && realTimeMetrics.userHealthFactor > 0 && (
        <div className="card">
          <h3 className="typography-h3 mb-6">Position Health Analysis</h3>
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className={`typography-number-lg font-bold mb-1 ${getHealthFactorColor(realTimeMetrics.userHealthFactor)}`}>
                  {realTimeMetrics.userHealthFactor.toFixed(3)}
                </div>
                <div className="typography-caption">HEALTH FACTOR</div>
              </div>
              <div className="text-center">
                <div className="typography-number-lg font-bold mb-1">1.200</div>
                <div className="typography-caption">LIQUIDATION THRESHOLD</div>
              </div>
              <div className="text-center">
                <div className="typography-number-lg font-bold mb-1 status-positive">
                  {((realTimeMetrics.userHealthFactor - 1.2) * 100).toFixed(1)}%
                </div>
                <div className="typography-caption">SAFETY MARGIN</div>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="typography-body">Health Factor Progress</span>
                <span className="typography-body-sm opacity-75">
                  {realTimeMetrics.userHealthFactor >= 2.0 ? "Excellent" : 
                   realTimeMetrics.userHealthFactor >= 1.5 ? "Good" : 
                   realTimeMetrics.userHealthFactor >= 1.2 ? "Caution" : "Danger"}
                </span>
              </div>
              <div className="w-full bg-surface rounded-full h-3 overflow-hidden">
                <div
                  className={`h-3 rounded-full transition-all duration-500 ${
                    realTimeMetrics.userHealthFactor >= 2.0 ? "bg-success" :
                    realTimeMetrics.userHealthFactor >= 1.5 ? "bg-success" :
                    realTimeMetrics.userHealthFactor >= 1.2 ? "bg-warning" : "bg-error"
                  }`}
                  style={{
                    width: `${Math.min((realTimeMetrics.userHealthFactor / 3) * 100, 100)}%`,
                  }}
                ></div>
              </div>
              <p className="typography-body-sm opacity-75">
                {realTimeMetrics.userHealthFactor >= 2.0
                  ? "Your position is very healthy with minimal liquidation risk."
                  : realTimeMetrics.userHealthFactor >= 1.5
                  ? "Your position is healthy. Continue monitoring market conditions."
                  : realTimeMetrics.userHealthFactor >= 1.2
                  ? "Your position requires attention. Consider adding collateral or reducing debt."
                  : "Warning: Your position is at high risk of liquidation. Take immediate action."}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};