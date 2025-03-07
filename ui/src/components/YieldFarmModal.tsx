'use client';

import { FC, useState } from 'react';
import { TokenIcon } from './TokenIcon';

interface YieldFarmModalProps {
  pool: {
    name: string;
    tokens: string[];
    apr: string;
    leverage: string;
  };
  onClose: () => void;
}

export const YieldFarmModal: FC<YieldFarmModalProps> = ({ pool, onClose }) => {
  const [amount, setAmount] = useState<string>('');
  const [leverage, setLeverage] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Extract max leverage from the pool.leverage string (e.g., "Up to 3x" -> 3)
  const maxLeverage = parseInt(pool.leverage.match(/\d+/)?.[0] || '1');
  
  const leverageOptions = Array.from({ length: maxLeverage }, (_, i) => i + 1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!amount || parseFloat(amount) <= 0) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Here you would integrate with the Solana program
      console.log(`Farming ${amount} ${pool.name} with ${leverage}x leverage`);
      
      // Simulate a transaction delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      onClose();
    } catch (error) {
      console.error('Transaction failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const estimatedApr = () => {
    // Simple calculation for demonstration
    const baseApr = parseFloat(pool.apr.replace('%', ''));
    return (baseApr * leverage).toFixed(1) + '%';
  };

  const estimatedPosition = () => {
    if (!amount || parseFloat(amount) <= 0) {
      return '$0.00';
    }
    return `$${(parseFloat(amount) * leverage).toFixed(2)}`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-surface rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Farm {pool.name}</h2>
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
          <div className="flex -space-x-2">
            {pool.tokens.map((token, index) => (
              <div key={index} className="relative z-10" style={{ zIndex: 10 - index }}>
                <TokenIcon token={token} size="lg" />
              </div>
            ))}
          </div>
          <div>
            <p className="font-medium">{pool.name}</p>
            <p className="text-text-secondary text-sm">
              Base APR: {pool.apr}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label
              htmlFor="amount"
              className="block text-text-secondary text-sm font-medium mb-2"
            >
              Amount to Deposit
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
                <span className="text-text-secondary">USD</span>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <label
              htmlFor="leverage"
              className="block text-text-secondary text-sm font-medium mb-2"
            >
              Leverage
            </label>
            <div className="flex space-x-2">
              {leverageOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`flex-1 py-2 px-4 rounded font-medium transition-colors ${
                    leverage === option
                      ? 'bg-primary text-white'
                      : 'bg-gray-800 text-text-secondary hover:bg-gray-700'
                  }`}
                  onClick={() => setLeverage(option)}
                >
                  {option}x
                </button>
              ))}
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-4 mb-6">
            <div className="flex justify-between mb-2">
              <span className="text-text-secondary">Estimated APR:</span>
              <span className="text-green-500 font-medium">{estimatedApr()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Position Size:</span>
              <span className="font-medium">{estimatedPosition()}</span>
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
              className="flex-1 btn-primary"
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
                'Farm'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};