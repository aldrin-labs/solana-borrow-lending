"use client";

import { FC, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { TokenIcon } from "./TokenIcon";
import { MarketActionModal } from "./MarketActionModal";
import { StatsCard } from "./StatsCard";
import { AnalyticsDashboard } from "./AnalyticsDashboard";
import { useBorrowLending } from "@/hooks/useBorrowLending";

export const BorrowingDashboard: FC = () => {
  const { connected } = useWallet();
  const { markets, borrowedPositions, isLoading, error } = useBorrowLending();
  const [selectedMarket, setSelectedMarket] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"markets" | "positions" | "analytics">("markets");

  const handleBorrow = (market: any) => {
    setSelectedMarket(market);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
      <h1 className="text-3xl font-bold text-white mb-6">Borrowing</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatsCard
          title="Total Borrowed"
          value="$45,678,901"
          change="+1.5%"
          isPositive={true}
        />
        <StatsCard
          title="Your Borrowed"
          value={connected ? "$450.00" : "$0.00"}
          change={connected ? "+2.1%" : "0%"}
          isPositive={false}
        />
        <StatsCard
          title="Borrow APY (avg)"
          value="4.35%"
          change="+0.3%"
          isPositive={false}
        />
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-border">
        <div className="flex space-x-6">
          <button
            className={`py-3 px-4 font-medium transition-colors ${
              activeTab === "markets"
                ? "text-white border-b-2 border-secondary"
                : "text-text-secondary hover:text-white"
            }`}
            onClick={() => setActiveTab("markets")}
          >
            Borrow Markets
          </button>
          {connected && (
            <>
              <button
                className={`py-3 px-4 font-medium transition-colors ${
                  activeTab === "positions"
                    ? "text-white border-b-2 border-secondary"
                    : "text-text-secondary hover:text-white"
                }`}
                onClick={() => setActiveTab("positions")}
              >
                Your Borrows
              </button>
              <button
                className={`py-3 px-4 font-medium transition-colors ${
                  activeTab === "analytics"
                    ? "text-white border-b-2 border-secondary"
                    : "text-text-secondary hover:text-white"
                }`}
                onClick={() => setActiveTab("analytics")}
              >
                Analytics
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "markets" && (
        <div className="card">
          <h2 className="section-title">Borrow Markets</h2>
          <div className="table-container overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left">
                  <th className="table-header font-medium">Asset</th>
                  <th className="table-header font-medium">Total Borrowed</th>
                  <th className="table-header font-medium">Available</th>
                  <th className="table-header font-medium">Borrow APY</th>
                  <th className="table-header font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {markets.map((market) => (
                  <tr key={market.id} className="table-row">
                    <td className="table-cell">
                      <div className="flex items-center space-x-3">
                        <TokenIcon token={market.token} />
                        <span className="font-medium text-white">
                          {market.token}
                        </span>
                      </div>
                    </td>
                    <td className="table-cell">{market.totalBorrow}</td>
                    <td className="table-cell">
                      {(
                        parseFloat(market.totalSupply.replace(/[$,]/g, "")) -
                        parseFloat(market.totalBorrow.replace(/[$,]/g, ""))
                      ).toLocaleString("en-US", {
                        style: "currency",
                        currency: "USD",
                      })}
                    </td>
                    <td className="table-cell text-error">{market.borrowApy}</td>
                    <td className="table-cell">
                      <button
                        onClick={() => handleBorrow(market)}
                        className="btn-secondary text-sm py-1 px-3"
                        disabled={!connected}
                      >
                        Borrow
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "positions" && connected && (
        <div className="card">
          <h2 className="section-title">Your Borrows</h2>
          {borrowedPositions.length > 0 ? (
            <div className="table-container overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left">
                    <th className="table-header font-medium">Asset</th>
                    <th className="table-header font-medium">Amount</th>
                    <th className="table-header font-medium">Value</th>
                    <th className="table-header font-medium">APY</th>
                    <th className="table-header font-medium">Health Factor</th>
                    <th className="table-header font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {borrowedPositions.map((position) => (
                    <tr key={position.id} className="table-row">
                      <td className="table-cell">
                        <div className="flex items-center space-x-3">
                          <TokenIcon token={position.token} />
                          <span className="font-medium text-white">
                            {position.token}
                          </span>
                        </div>
                      </td>
                      <td className="table-cell">{position.amount}</td>
                      <td className="table-cell">{position.value}</td>
                      <td className="table-cell text-error">{position.apy}</td>
                      <td className="table-cell">
                        <div className="flex items-center">
                          <span className="text-success font-medium mr-2">
                            1.8
                          </span>
                          <div className="w-24 bg-border rounded-full h-2.5">
                            <div
                              className="bg-success h-2.5 rounded-full"
                              style={{ width: "80%" }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td className="table-cell">
                        <button className="btn-primary text-sm py-1 px-3">
                          Repay
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <h3 className="text-xl font-semibold mb-4">No Borrows Yet</h3>
              <p className="text-text-secondary mb-6">
                Borrow assets against your collateral to unlock liquidity
              </p>
              <button
                onClick={() => setActiveTab("markets")}
                className="btn-secondary"
              >
                Explore Markets
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === "analytics" && connected && (
        <AnalyticsDashboard userType="borrower" />
      )}

      {!connected && (
        <div className="card text-center py-12">
          <h2 className="text-2xl font-bold mb-4">Connect Your Wallet</h2>
          <p className="text-text-secondary mb-6">
            Connect your wallet to view your borrows and start borrowing
          </p>
          <button className="btn-connect py-2 px-6 rounded font-medium">
            Connect Wallet
          </button>
        </div>
      )}

      {isModalOpen && selectedMarket && (
        <MarketActionModal
          market={selectedMarket}
          actionType="borrow"
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
};
