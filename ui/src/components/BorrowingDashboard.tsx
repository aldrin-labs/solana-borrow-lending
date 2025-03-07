'use client';

import { FC, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { TokenIcon } from './TokenIcon';
import { MarketActionModal } from './MarketActionModal';
import { StatsCard } from './StatsCard';
import { useBorrowLending } from '@/hooks/useBorrowLending';

export const BorrowingDashboard: FC = () => {
  const { connected } = useWallet();
  const { markets, borrowedPositions, isLoading, error } = useBorrowLending();
  const [selectedMarket, setSelectedMarket] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleBorrow = (market: any) => {
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

      <div className="card">
        <h2 className="text-xl font-bold mb-6">Borrow Markets</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-text-secondary">
                <th className="pb-4 font-medium">Asset</th>
                <th className="pb-4 font-medium">Total Borrowed</th>
                <th className="pb-4 font-medium">Available</th>
                <th className="pb-4 font-medium">Borrow APY</th>
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
                  <td className="py-4">{market.totalBorrow}</td>
                  <td className="py-4">
                    {(parseFloat(market.totalSupply.replace(/[$,]/g, '')) - 
                      parseFloat(market.totalBorrow.replace(/[$,]/g, ''))).toLocaleString('en-US', {
                        style: 'currency',
                        currency: 'USD'
                      })}
                  </td>
                  <td className="py-4 text-red-500">{market.borrowApy}</td>
                  <td className="py-4">
                    <button
                      onClick={() => handleBorrow(market)}
                      className="btn-secondary text-sm py-1"
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

      {connected && borrowedPositions.length > 0 && (
        <div className="card">
          <h2 className="text-xl font-bold mb-6">Your Borrows</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-text-secondary">
                  <th className="pb-4 font-medium">Asset</th>
                  <th className="pb-4 font-medium">Amount</th>
                  <th className="pb-4 font-medium">Value</th>
                  <th className="pb-4 font-medium">APY</th>
                  <th className="pb-4 font-medium">Health Factor</th>
                  <th className="pb-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {borrowedPositions.map((position) => (
                  <tr key={position.id} className="border-t border-gray-700">
                    <td className="py-4">
                      <div className="flex items-center space-x-3">
                        <TokenIcon token={position.token} />
                        <span className="font-medium">{position.token}</span>
                      </div>
                    </td>
                    <td className="py-4">{position.amount}</td>
                    <td className="py-4">{position.value}</td>
                    <td className="py-4 text-red-500">{position.apy}</td>
                    <td className="py-4">
                      <div className="flex items-center">
                        <span className="text-green-500 font-medium mr-2">1.8</span>
                        <div className="w-24 bg-gray-700 rounded-full h-2.5">
                          <div
                            className="bg-green-500 h-2.5 rounded-full"
                            style={{ width: '80%' }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4">
                      <button className="btn-primary text-sm py-1">Repay</button>
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
            Connect your wallet to view your borrows and start borrowing
          </p>
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