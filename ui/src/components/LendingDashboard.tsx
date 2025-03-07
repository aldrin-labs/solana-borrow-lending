'use client';

import { FC, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { TokenIcon } from './TokenIcon';
import { MarketActionModal } from './MarketActionModal';
import { StatsCard } from './StatsCard';
import { useBorrowLending } from '@/hooks/useBorrowLending';

export const LendingDashboard: FC = () => {
  const { connected } = useWallet();
  const { markets, suppliedPositions, isLoading, error } = useBorrowLending();
  const [selectedMarket, setSelectedMarket] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleSupply = (market: any) => {
    setSelectedMarket(market);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-8">
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

      <div className="card">
        <h2 className="text-xl font-bold mb-6">Supply Markets</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-text-secondary">
                <th className="pb-4 font-medium">Asset</th>
                <th className="pb-4 font-medium">Total Supply</th>
                <th className="pb-4 font-medium">Supply APY</th>
                <th className="pb-4 font-medium">Can Be Collateral</th>
                <th className="pb-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {markets.map((market) => (
                <tr key={market.id} className="border-t border-gray-700">
                  <td className="py-4">
                    <div className="flex items-center space-x-3">
                      <TokenIcon token={market.token} />
                      <span className="font-medium">{market.token}</span>
                    </div>
                  </td>
                  <td className="py-4">{market.totalSupply}</td>
                  <td className="py-4 text-green-500">{market.supplyApy}</td>
                  <td className="py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-900 text-green-300">
                      Yes
                    </span>
                  </td>
                  <td className="py-4">
                    <button
                      onClick={() => handleSupply(market)}
                      className="btn-primary text-sm py-1"
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

      {connected && suppliedPositions.length > 0 && (
        <div className="card">
          <h2 className="text-xl font-bold mb-6">Your Supplies</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-text-secondary">
                  <th className="pb-4 font-medium">Asset</th>
                  <th className="pb-4 font-medium">Amount</th>
                  <th className="pb-4 font-medium">Value</th>
                  <th className="pb-4 font-medium">APY</th>
                  <th className="pb-4 font-medium">Collateral</th>
                  <th className="pb-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {suppliedPositions.map((position) => (
                  <tr key={position.id} className="border-t border-gray-700">
                    <td className="py-4">
                      <div className="flex items-center space-x-3">
                        <TokenIcon token={position.token} />
                        <span className="font-medium">{position.token}</span>
                      </div>
                    </td>
                    <td className="py-4">{position.amount}</td>
                    <td className="py-4">{position.value}</td>
                    <td className="py-4 text-green-500">{position.apy}</td>
                    <td className="py-4">
                      {position.collateral ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-900 text-green-300">
                          Yes
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-700 text-gray-300">
                          No
                        </span>
                      )}
                    </td>
                    <td className="py-4">
                      <div className="flex space-x-2">
                        <button className="btn-primary text-sm py-1">Withdraw</button>
                        {position.collateral && (
                          <button className="btn-secondary text-sm py-1">
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
        </div>
      )}

      {!connected && (
        <div className="card text-center py-12">
          <h2 className="text-2xl font-bold mb-4">Connect Your Wallet</h2>
          <p className="text-text-secondary mb-6">
            Connect your wallet to view your supplies and start lending
          </p>
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