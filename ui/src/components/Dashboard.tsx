'use client';

import { FC, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { MarketOverview } from './MarketOverview';
import { UserPositions } from './UserPositions';
import { StatsCard } from './StatsCard';

export const Dashboard: FC = () => {
  const { connected } = useWallet();
  const [activeTab, setActiveTab] = useState<'overview' | 'positions'>('overview');

  return (
    <div className="space-y-8">
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
        <div className="card">
          <div className="border-b border-gray-700 mb-6">
            <div className="flex space-x-6">
              <button
                className={`py-3 px-1 font-medium ${
                  activeTab === 'overview'
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
                onClick={() => setActiveTab('overview')}
              >
                Market Overview
              </button>
              <button
                className={`py-3 px-1 font-medium ${
                  activeTab === 'positions'
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
                onClick={() => setActiveTab('positions')}
              >
                Your Positions
              </button>
            </div>
          </div>

          {activeTab === 'overview' ? <MarketOverview /> : <UserPositions />}
        </div>
      ) : (
        <div className="card text-center py-12">
          <h2 className="text-2xl font-bold mb-4">Connect Your Wallet</h2>
          <p className="text-text-secondary mb-6">
            Connect your wallet to view your positions and interact with the protocol
          </p>
        </div>
      )}
    </div>
  );
};