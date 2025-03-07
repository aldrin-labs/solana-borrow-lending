'use client';

import { FC, useState } from 'react';
import { TokenIcon } from './TokenIcon';

interface MarketActionModalProps {
  market: {
    token: string;
    supplyApy?: string;
    borrowApy?: string;
  };
  actionType: 'supply' | 'borrow';
  onClose: () => void;
}

export const MarketActionModal: FC<MarketActionModalProps> = ({
  market,
  actionType,
  onClose,
}) => {
  const [amount, setAmount] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!amount || parseFloat(amount) <= 0) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Here you would integrate with the Solana program
      console.log(`${actionType === 'supply' ? 'Supplying' : 'Borrowing'} ${amount} ${market.token}`);
      
      // Simulate a transaction delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      onClose();
    } catch (error) {
      console.error('Transaction failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-surface rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">
            {actionType === 'supply' ? 'Supply' : 'Borrow'} {market.token}
          </h2>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="flex items-center space-x-3 mb-6">
          <TokenIcon token={market.token} size="lg" />
          <div>
            <p className="font-medium">{market.token}</p>
            <p className="text-text-secondary text-sm">
              {actionType === 'supply'
                ? `Supply APY: ${market.supplyApy}`
                : `Borrow APY: ${market.borrowApy}`}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label
              htmlFor="amount"
              className="block text-text-secondary text-sm font-medium mb-2"
            >
              Amount
            </label>
            <div className="relative">
              <input
                type="number"
                id="amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="input w-full pr-16"
                step="any"
                min="0"
                required
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                <span className="text-text-secondary">{market.token}</span>
              </div>
            </div>
          </div>

          <div className="flex space-x-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 px-4 border border-gray-700 rounded font-medium text-text-primary hover:bg-gray-800 transition-colors"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`flex-1 ${
                actionType === 'supply' ? 'btn-primary' : 'btn-secondary'
              }`}
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Processing...
                </span>
              ) : (
                `${actionType === 'supply' ? 'Supply' : 'Borrow'} ${market.token}`
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};