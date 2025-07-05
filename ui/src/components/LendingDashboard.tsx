"use client";

import { FC, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { TokenIcon } from "./TokenIcon";
import { MarketActionModal } from "./MarketActionModal";
import { StatsCard } from "./StatsCard";
import { AnalyticsDashboard } from "./AnalyticsDashboard";
import { useBorrowLending } from "@/hooks/useBorrowLending";

export const LendingDashboard: FC = () => {
  const { connected } = useWallet();
  const { markets, suppliedPositions, isLoading, error } = useBorrowLending();
  const [selectedMarket, setSelectedMarket] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"markets" | "positions" | "analytics">("markets");

  const handleSupply = (market: any) => {
    setSelectedMarket(market);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
      <h1 className="text-3xl font-bold text-white mb-6">Lending</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatsCard
          title="Total Supply"
          value="$78,901,234"
          change="+2.8%"
          isPositive={true}
        />
        <StatsCard
          title="Your Supply"
          value={connected ? "$1,550.00" : "$0.00"}
          change={connected ? "+3.5%" : "0%"}
          isPositive={true}
        />
        <StatsCard
          title="Supply APY (avg)"
          value="2.65%"
          change="+0.2%"
          isPositive={true}
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
            Supply Markets
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
                Your Positions
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
          <h2 className="section-title">Supply Markets</h2>
          <div className="table-container overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left">
                  <th className="table-header font-medium">Asset</th>
                  <th className="table-header font-medium">Total Supply</th>
                  <th className="table-header font-medium">Supply APY</th>
                  <th className="table-header font-medium">Can Be Collateral</th>
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
                    <td className="table-cell">{market.totalSupply}</td>
                    <td className="table-cell text-success">
                      {market.supplyApyFormatted}
                    </td>
                    <td className="table-cell">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success/20 text-success">
                        Yes
                      </span>
                    </td>
                    <td className="table-cell">
                      <button
                        onClick={() => handleSupply(market)}
                        className="btn-primary text-sm py-1 px-3"
                        disabled={!connected}
                      >
                        Supply
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
          <h2 className="section-title">Your Supplies</h2>
          {suppliedPositions.length > 0 ? (
            <div className="table-container overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left">
                    <th className="table-header font-medium">Asset</th>
                    <th className="table-header font-medium">Amount</th>
                    <th className="table-header font-medium">Value</th>
                    <th className="table-header font-medium">APY</th>
                    <th className="table-header font-medium">Collateral</th>
                    <th className="table-header font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliedPositions.map((position) => (
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
                      <td className="table-cell text-success">{position.apy}</td>
                      <td className="table-cell">
                        {position.collateral ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success/20 text-success">
                            Yes
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-border text-text-secondary">
                            No
                          </span>
                        )}
                      </td>
                      <td className="table-cell">
                        <div className="flex space-x-2">
                          <button className="btn-primary text-sm py-1 px-3">
                            Withdraw
                          </button>
                          {position.collateral && (
                            <button className="btn-secondary text-sm py-1 px-3">
                              Disable as Collateral
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <h3 className="text-xl font-semibold mb-4">No Supplies Yet</h3>
              <p className="text-text-secondary mb-6">
                Start lending to earn interest on your assets
              </p>
              <button
                onClick={() => setActiveTab("markets")}
                className="btn-primary"
              >
                Explore Markets
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === "analytics" && connected && (
        <AnalyticsDashboard userType="lender" />
      )}

      {!connected && (
        <div className="card text-center py-12">
          <h2 className="text-2xl font-bold mb-4">Connect Your Wallet</h2>
          <p className="text-text-secondary mb-6">
            Connect your wallet to view your supplies and start lending
          </p>
          <button className="btn-connect py-2 px-6 rounded font-medium">
            Connect Wallet
          </button>
        </div>
      )}

      {isModalOpen && selectedMarket && (
        <MarketActionModal
          market={selectedMarket}
          actionType="supply"
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
};
