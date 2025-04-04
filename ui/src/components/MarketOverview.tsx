"use client";

import { FC, useState } from "react";
import { TokenIcon } from "./TokenIcon";
import { MarketActionModal } from "./MarketActionModal";

// Mock data for markets
const markets = [
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

export const MarketOverview: FC = () => {
  const [selectedMarket, setSelectedMarket] = useState<any>(null);
  const [actionType, setActionType] = useState<"supply" | "borrow" | null>(
    null,
  );

  const handleAction = (market: any, action: "supply" | "borrow") => {
    setSelectedMarket(market);
    setActionType(action);
  };

  const closeModal = () => {
    setSelectedMarket(null);
    setActionType(null);
  };

  return (
    <div>
      <div className="table-container overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left">
              <th className="table-header font-medium">Asset</th>
              <th className="table-header font-medium">Total Supply</th>
              <th className="table-header font-medium">Supply APY</th>
              <th className="table-header font-medium">Total Borrow</th>
              <th className="table-header font-medium">Borrow APY</th>
              <th className="table-header font-medium">Utilization</th>
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
                <td className="table-cell text-success">{market.supplyApy}</td>
                <td className="table-cell">{market.totalBorrow}</td>
                <td className="table-cell text-error">{market.borrowApy}</td>
                <td className="table-cell">
                  <div className="w-full bg-border rounded-full h-2.5">
                    <div
                      className="bg-secondary h-2.5 rounded-full"
                      style={{ width: market.utilizationRate }}
                    ></div>
                  </div>
                  <span className="text-xs text-text-secondary mt-1 block">
                    {market.utilizationRate}
                  </span>
                </td>
                <td className="table-cell">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleAction(market, "supply")}
                      className="btn-primary text-sm py-1 px-3"
                    >
                      Supply
                    </button>
                    <button
                      onClick={() => handleAction(market, "borrow")}
                      className="btn-secondary text-sm py-1 px-3"
                    >
                      Borrow
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedMarket && actionType && (
        <MarketActionModal
          market={selectedMarket}
          actionType={actionType}
          onClose={closeModal}
        />
      )}
    </div>
  );
};
