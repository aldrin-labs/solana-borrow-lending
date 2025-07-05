"use client";

import { FC } from "react";
import { useWalletConnection } from "@/hooks/useWalletConnection";
import { TrendChart, UtilizationChart, APYComparisonChart } from "./charts";
import { StatsCard } from "./StatsCard";
import { useBorrowLending } from "@/hooks/useBorrowLending";

interface AnalyticsDashboardProps {
  userType?: "lender" | "borrower" | "overview";
}

export const AnalyticsDashboard: FC<AnalyticsDashboardProps> = ({
  userType = "overview",
}) => {
  const { connected } = useWalletConnection();
  const { analytics, isLoading, lastUpdated } = useBorrowLending();

  if (isLoading || !analytics) {
    return (
      <div className="space-y-6">
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
    if (healthFactor >= 2.0) return "text-success";
    if (healthFactor >= 1.5) return "text-warning";
    return "text-error";
  };

  const getLenderMetrics = () => (
    <>
      <StatsCard
        title="Your Lending APY"
        value="2.75%"
        change="+0.15%"
        isPositive={true}
        subtitle="Avg across positions"
      />
      <StatsCard
        title="Total Supplied"
        value="$1,550.00"
        change="+$45.20"
        isPositive={true}
        subtitle="Your supply value"
      />
      <StatsCard
        title="Interest Earned"
        value="$12.45"
        change="+$1.25"
        isPositive={true}
        subtitle="This month"
      />
    </>
  );

  const getBorrowerMetrics = () => (
    <>
      <StatsCard
        title="Health Factor"
        value={analytics.healthFactor.toFixed(2)}
        change={connected ? "Healthy" : "N/A"}
        isPositive={analytics.healthFactor >= 1.5}
        subtitle="Liquidation risk"
        valueClassName={getHealthFactorColor(analytics.healthFactor)}
      />
      <StatsCard
        title="Total Borrowed"
        value="$450.00"
        change="+2.1%"
        isPositive={false}
        subtitle="Your borrow value"
      />
      <StatsCard
        title="Available to Borrow"
        value="$825.00"
        change="Based on collateral"
        isPositive={true}
        subtitle="Remaining capacity"
      />
    </>
  );

  const getOverviewMetrics = () => (
    <>
      <StatsCard
        title="Total Value Locked"
        value="$123.5M"
        change="+5.2%"
        isPositive={true}
        subtitle="Protocol TVL"
      />
      <StatsCard
        title="Total Borrowed"
        value="$45.7M"
        change="+2.8%"
        isPositive={true}
        subtitle="Outstanding loans"
      />
      <StatsCard
        title="Protocol Health"
        value={`${analytics.liquidationThreshold}%`}
        change="Stable"
        isPositive={true}
        subtitle="Avg utilization"
      />
    </>
  );

  return (
    <div className="space-y-8">
      {/* Real-time Update Indicator */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">
          {userType === "lender" && "Lender Analytics"}
          {userType === "borrower" && "Borrower Analytics"}
          {userType === "overview" && "Protocol Analytics"}
        </h2>
        <div className="flex items-center text-sm text-text-secondary">
          <div className="w-2 h-2 bg-success rounded-full mr-2 animate-pulse"></div>
          Last updated: {lastUpdated.toLocaleTimeString()}
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {userType === "lender" && getLenderMetrics()}
        {userType === "borrower" && getBorrowerMetrics()}
        {userType === "overview" && getOverviewMetrics()}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* TVL Trend - Show for all user types */}
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
          height={250}
        />

        {/* Utilization Chart */}
        <UtilizationChart
          data={analytics.utilizationTrend}
          title="Protocol Utilization Rate"
          height={250}
        />

        {/* Borrow Trend - Show different data based on user type */}
        {userType === "borrower" && (
          <TrendChart
            data={analytics.totalBorrowed}
            title="Your Borrow History"
            color="#EF4444"
            height={250}
          />
        )}

        {(userType === "overview" || userType === "lender") && (
          <TrendChart
            data={analytics.totalBorrowed}
            title="Total Borrowed Volume"
            color="#3B82F6"
            height={250}
          />
        )}

        {/* APY Comparison - Full width for overview, half for user-specific */}
        <div className={userType === "overview" ? "lg:col-span-2" : ""}>
          <APYComparisonChart
            data={analytics.apyComparison}
            title="Supply vs Borrow APY Comparison"
            height={userType === "overview" ? 300 : 250}
          />
        </div>
      </div>

      {/* Health Factor Detail for Borrowers */}
      {userType === "borrower" && connected && (
        <div className="bg-surface rounded-lg p-6 border border-border">
          <h3 className="text-lg font-semibold text-white mb-4">
            Position Health Details
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-text-secondary">Current Health Factor</span>
              <span className={`font-semibold ${getHealthFactorColor(analytics.healthFactor)}`}>
                {analytics.healthFactor.toFixed(3)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-text-secondary">Liquidation Threshold</span>
              <span className="text-white">1.000</span>
            </div>
            <div className="w-full bg-border rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all duration-300 ${
                  analytics.healthFactor >= 2.0
                    ? "bg-success"
                    : analytics.healthFactor >= 1.5
                    ? "bg-warning"
                    : "bg-error"
                }`}
                style={{
                  width: `${Math.min((analytics.healthFactor / 3) * 100, 100)}%`,
                }}
              ></div>
            </div>
            <p className="text-sm text-text-secondary">
              {analytics.healthFactor >= 2.0
                ? "Your position is healthy with low liquidation risk."
                : analytics.healthFactor >= 1.5
                ? "Your position is moderately healthy. Monitor closely."
                : "Warning: Your position is at risk of liquidation."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};