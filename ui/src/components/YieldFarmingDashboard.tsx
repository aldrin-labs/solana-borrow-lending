"use client";

import { FC, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { TokenIcon } from "./TokenIcon";
import { YieldFarmModal } from "./YieldFarmModal";
import { StatsCard } from "./StatsCard";

// Mock data for farming pools
const farmingPools = [
  {
    id: "1",
    name: "SOL-USDC",
    tvl: "$12,345,678",
    apr: "18.5%",
    leverage: "Up to 3x",
    tokens: ["SOL", "USDC"],
  },
  {
    id: "2",
    name: "ETH-USDC",
    tvl: "$8,765,432",
    apr: "15.2%",
    leverage: "Up to 3x",
    tokens: ["ETH", "USDC"],
  },
  {
    id: "3",
    name: "BTC-USDC",
    tvl: "$23,456,789",
    apr: "12.8%",
    leverage: "Up to 2x",
    tokens: ["BTC", "USDC"],
  },
  {
    id: "4",
    name: "SOL-ETH",
    tvl: "$5,678,901",
    apr: "20.5%",
    leverage: "Up to 4x",
    tokens: ["SOL", "ETH"],
  },
];

// Mock data for user's farming positions
const userFarmingPositions = [
  {
    id: "1",
    name: "SOL-USDC",
    deposited: "$1,000",
    leverage: "2x",
    value: "$2,000",
    rewards: "$45.20",
    apr: "18.5%",
    tokens: ["SOL", "USDC"],
  },
];

export const YieldFarmingDashboard: FC = () => {
  const { connected } = useWallet();
  const [selectedPool, setSelectedPool] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpenModal = (pool: any) => {
    setSelectedPool(pool);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
      <h1 className="text-3xl font-bold text-white mb-6">Yield Farming</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatsCard
          title="Total Value Locked in Farms"
          value="$50,246,800"
          change="+8.3%"
          isPositive={true}
        />
        <StatsCard
          title="Your Farming Positions"
          value="$2,000"
          change="+4.5%"
          isPositive={true}
        />
        <StatsCard
          title="Unclaimed Rewards"
          value="$45.20"
          change="+2.1%"
          isPositive={true}
        />
      </div>

      <div className="card">
        <h2 className="section-title">Available Farming Pools</h2>
        <div className="table-container overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left">
                <th className="table-header font-medium">Pool</th>
                <th className="table-header font-medium">TVL</th>
                <th className="table-header font-medium">APR</th>
                <th className="table-header font-medium">Leverage</th>
                <th className="table-header font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {farmingPools.map((pool) => (
                <tr key={pool.id} className="table-row">
                  <td className="table-cell">
                    <div className="flex items-center">
                      <div className="flex -space-x-2 mr-3">
                        {pool.tokens.map((token, index) => (
                          <div
                            key={index}
                            className="relative z-10"
                            style={{ zIndex: 10 - index }}
                          >
                            <TokenIcon token={token} />
                          </div>
                        ))}
                      </div>
                      <span className="font-medium text-white">
                        {pool.name}
                      </span>
                    </div>
                  </td>
                  <td className="table-cell">{pool.tvl}</td>
                  <td className="table-cell text-success">{pool.apr}</td>
                  <td className="table-cell">{pool.leverage}</td>
                  <td className="table-cell">
                    <button
                      onClick={() => handleOpenModal(pool)}
                      className="btn-primary text-sm py-1 px-3"
                      disabled={!connected}
                    >
                      Farm
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {connected && userFarmingPositions.length > 0 && (
        <div className="card">
          <h2 className="section-title">Your Farming Positions</h2>
          <div className="table-container overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left">
                  <th className="table-header font-medium">Pool</th>
                  <th className="table-header font-medium">Deposited</th>
                  <th className="table-header font-medium">Leverage</th>
                  <th className="table-header font-medium">Position Value</th>
                  <th className="table-header font-medium">Rewards</th>
                  <th className="table-header font-medium">APR</th>
                  <th className="table-header font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {userFarmingPositions.map((position) => (
                  <tr key={position.id} className="table-row">
                    <td className="table-cell">
                      <div className="flex items-center">
                        <div className="flex -space-x-2 mr-3">
                          {position.tokens.map((token, index) => (
                            <div
                              key={index}
                              className="relative z-10"
                              style={{ zIndex: 10 - index }}
                            >
                              <TokenIcon token={token} />
                            </div>
                          ))}
                        </div>
                        <span className="font-medium text-white">
                          {position.name}
                        </span>
                      </div>
                    </td>
                    <td className="table-cell">{position.deposited}</td>
                    <td className="table-cell">{position.leverage}</td>
                    <td className="table-cell">{position.value}</td>
                    <td className="table-cell text-success">
                      {position.rewards}
                    </td>
                    <td className="table-cell text-success">{position.apr}</td>
                    <td className="table-cell">
                      <div className="flex space-x-2">
                        <button className="btn-primary text-sm py-1 px-3">
                          Claim
                        </button>
                        <button className="btn-secondary text-sm py-1 px-3">
                          Close
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!connected && (
        <div className="card text-center py-12">
          <h2 className="text-2xl font-bold mb-4">Connect Your Wallet</h2>
          <p className="text-text-secondary mb-6">
            Connect your wallet to view your farming positions and start farming
          </p>
          <button className="btn-connect py-2 px-6 rounded font-medium">
            Connect Wallet
          </button>
        </div>
      )}

      {isModalOpen && selectedPool && (
        <YieldFarmModal pool={selectedPool} onClose={handleCloseModal} />
      )}
    </div>
  );
};
