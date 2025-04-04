import { FC } from "react";
import { Card } from "./Card";
import { Button } from "./Button";
import { TokenSelector } from "./TokenSelector";
import { TokenIcon } from "./TokenIcon";

interface YieldFarmModalProps {
  pool: any;
  onClose: () => void;
}

export const YieldFarmModal: FC<YieldFarmModalProps> = ({ pool, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md animate-fadeIn" glassEffect={true}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Farm {pool.name}</h2>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-white transition-colors"
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

        <div className="mb-6">
          <div className="flex items-center mb-4">
            <div className="flex -space-x-2 mr-3">
              {pool.tokens.map((token: string, index: number) => (
                <div
                  key={index}
                  className="relative z-10"
                  style={{ zIndex: 10 - index }}
                >
                  <TokenIcon token={token} size="lg" />
                </div>
              ))}
            </div>
            <div className="ml-3">
              <h3 className="font-bold">{pool.name}</h3>
              <p className="text-text-secondary text-sm">
                APR: <span className="text-success">{pool.apr}</span>
              </p>
            </div>
          </div>

          <div className="bg-background p-4 rounded-lg mb-4">
            <div className="flex justify-between mb-2">
              <span className="text-text-secondary">Deposit Amount</span>
              <span className="text-text-secondary">Balance: 100.00</span>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                className="input flex-grow"
                placeholder="0.00"
              />
              <TokenSelector
                tokens={pool.tokens}
                selectedToken={pool.tokens[0]}
                onSelect={() => {}}
              />
            </div>
          </div>

          <div className="bg-background p-4 rounded-lg mb-4">
            <div className="flex justify-between mb-2">
              <span className="text-text-secondary">Leverage</span>
              <span className="text-success">{pool.leverage}</span>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="range"
                min="1"
                max="4"
                step="1"
                defaultValue="1"
                className="w-full"
              />
            </div>
            <div className="flex justify-between mt-2">
              <span>1x</span>
              <span>2x</span>
              <span>3x</span>
              <span>4x</span>
            </div>
          </div>

          <div className="bg-background p-4 rounded-lg">
            <div className="flex justify-between mb-1">
              <span className="text-text-secondary">Position Value</span>
              <span>$0.00</span>
            </div>
            <div className="flex justify-between mb-1">
              <span className="text-text-secondary">Expected APR</span>
              <span className="text-success">{pool.apr}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Liquidation Threshold</span>
              <span className="text-error">75%</span>
            </div>
          </div>
        </div>

        <div className="flex space-x-3">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" className="flex-1">
            Farm
          </Button>
        </div>
      </Card>
    </div>
  );
};
