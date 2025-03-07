'use client';

import { FC, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { TokenIcon } from './TokenIcon';

// Mock data for user positions
const mockSuppliedPositions = [
  {
    id: '1',
    token: 'SOL',
    amount: '5.5',
    value: '$550.00',
    apy: '3.2%',
    collateral: true,
  },
  {
    id: '2',
    token: 'USDC',
    amount: '1,000',
    value: '$1,000.00',
    apy: '2.5%',
    collateral: true,
  },
];

const mockBorrowedPositions = [
  {
    id: '1',
    token: 'ETH',
    amount: '0.25',
    value: '$450.00',
    apy: '4.5%',
  },
];

export const UserPositions: FC = () => {
  const { publicKey } = useWallet();
  const [activeTab, setActiveTab] = useState<'supplied' | 'borrowed'>('supplied');

  // In a real application, you would fetch the user's positions from the blockchain
  // based on their public key
  const suppliedPositions = publicKey ? mockSuppliedPositions : [];
  const borrowedPositions = publicKey ? mockBorrowedPositions : [];

  return (
    <div>
      <div className="border-b border-gray-700 mb-6">
        <div className="flex space-x-6">
          <button
            className={`py-3 px-1 font-medium ${
              activeTab === 'supplied'
                ? 'text-primary border-b-2 border-primary'
                : 'text-text-secondary hover:text-text-primary'
            }`}
            onClick={() => setActiveTab('supplied')}
          >
            Supplied
          </button>
          <button
            className={`py-3 px-1 font-medium ${
              activeTab === 'borrowed'
                ? 'text-primary border-b-2 border-primary'
                : 'text-text-secondary hover:text-text-primary'
            }`}
            onClick={() => setActiveTab('borrowed')}
          >
            Borrowed
          </button>
        </div>
      </div>

      {activeTab === 'supplied' ? (
        <div>
          {suppliedPositions.length > 0 ? (
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
          ) : (
            <div className="text-center py-8">
              <p className="text-text-secondary">You haven't supplied any assets yet.</p>
            </div>
          )}
        </div>
      ) : (
        <div>
          {borrowedPositions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-text-secondary">
                    <th className="pb-4 font-medium">Asset</th>
                    <th className="pb-4 font-medium">Amount</th>
                    <th className="pb-4 font-medium">Value</th>
                    <th className="pb-4 font-medium">APY</th>
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
                        <button className="btn-primary text-sm py-1">Repay</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-text-secondary">You haven't borrowed any assets yet.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};