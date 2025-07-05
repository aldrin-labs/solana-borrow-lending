"use client";

import { FC, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { MarketOverview } from "./MarketOverview";
import { UserPositions } from "./UserPositions";
import { StatsCard } from "./StatsCard";
import { AnalyticsDashboard } from "./AnalyticsDashboard";
import { Card } from "./Card";

export const Dashboard: FC = () => {
  const { connected } = useWallet();
  const [activeTab, setActiveTab] = useState<"overview" | "positions" | "analytics">(
    "overview",
  );

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 animate-fade-in">
      <div className="mb-8">
        <h1 className="text-4xl font-semibold text-text-primary mb-2">
          Dashboard
        </h1>
        <p className="text-text-secondary">
          Monitor your lending and borrowing activities
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatsCard
          title="Total Value Locked"
          value="$123,456,789"
          change="+5.2%"
          isPositive={true}
          tooltip="Total assets deposited across all markets"
        />
        <StatsCard
          title="Total Borrowed"
          value="$45,678,901"
          change="+2.8%"
          isPositive={true}
          tooltip="Total amount borrowed by all users"
        />
        <StatsCard
          title="Total Supplied"
          value="$78,901,234"
          change="-1.3%"
          isPositive={false}
          tooltip="Total assets supplied by all users"
        />
      </div>

      {connected ? (
        <Card className="animate-slide-up">
          <div className="border-b border-border pb-6 mb-6">
            <div className="flex space-x-1">
              <button
                className={`py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
                  activeTab === "overview"
                    ? "text-primary bg-primary/10 border border-primary/20"
                    : "text-text-secondary hover:text-primary hover:bg-gray-50"
                }`}
                onClick={() => setActiveTab("overview")}
              >
                Market Overview
              </button>
              <button
                className={`py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
                  activeTab === "positions"
                    ? "text-primary bg-primary/10 border border-primary/20"
                    : "text-text-secondary hover:text-primary hover:bg-gray-50"
                }`}
                onClick={() => setActiveTab("positions")}
              >
                Your Positions
              </button>
              <button
                className={`py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
                  activeTab === "analytics"
                    ? "text-primary bg-primary/10 border border-primary/20"
                    : "text-text-secondary hover:text-primary hover:bg-gray-50"
                }`}
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
