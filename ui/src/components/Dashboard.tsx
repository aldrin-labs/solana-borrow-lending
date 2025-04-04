"use client";

import { FC, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { MarketOverview } from "./MarketOverview";
import { UserPositions } from "./UserPositions";
import { StatsCard } from "./StatsCard";

export const Dashboard: FC = () => {
  const { connected } = useWallet();
  const [activeTab, setActiveTab] = useState<"overview" | "positions">(
    "overview",
  );

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
      <h1 className="text-3xl font-bold text-white mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatsCard
          title="Total Value Locked"
          value="$123,456,789"
          change="+5.2%"
          isPositive={true}
        />
        <StatsCard
          title="Total Borrowed"
          value="$45,678,901"
          change="+2.8%"
          isPositive={true}
        />
        <StatsCard
          title="Total Supplied"
          value="$78,901,234"
          change="-1.3%"
          isPositive={false}
        />
      </div>

      {connected ? (
        <div className="card bg-surface rounded-lg shadow-card border border-border">
          <div className="border-b border-border mb-6">
            <div className="flex space-x-6">
              <button
                className={`py-3 px-4 font-medium transition-colors ${
                  activeTab === "overview"
                    ? "text-white border-b-2 border-secondary"
                    : "text-text-secondary hover:text-white"
                }`}
                onClick={() => setActiveTab("overview")}
              >
                Market Overview
              </button>
              <button
                className={`py-3 px-4 font-medium transition-colors ${
                  activeTab === "positions"
                    ? "text-white border-b-2 border-secondary"
                    : "text-text-secondary hover:text-white"
                }`}
                onClick={() => setActiveTab("positions")}
              >
                Your Positions
              </button>
            </div>
          </div>

          {activeTab === "overview" ? <MarketOverview /> : <UserPositions />}
        </div>
      ) : (
        <div className="card text-center py-12 bg-surface rounded-lg shadow-card border border-border">
          <h2 className="text-2xl font-bold mb-4">Connect Your Wallet</h2>
          <p className="text-text-secondary mb-6">
            Connect your wallet to view your positions and interact with the
            protocol
          </p>
          <button className="btn-connect py-2 px-6 rounded font-medium">
            Connect Wallet
          </button>
        </div>
      )}
    </div>
  );
};
