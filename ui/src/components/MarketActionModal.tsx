import { FC, useState } from "react";
import { Card } from "./Card";
import { Button } from "./Button";
import { Input } from "./Input";
import { TokenSelector } from "./TokenSelector";
import { TokenIcon } from "./TokenIcon";

interface MarketActionModalProps {
  market: any;
  actionType: "supply" | "borrow";
  onClose: () => void;
}

export const MarketActionModal: FC<MarketActionModalProps> = ({
  market,
  actionType,
  onClose,
}) => {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setAmount(value);

    // Basic validation
    if (value && isNaN(Number(value))) {
      setError("Please enter a valid number");
    } else if (Number(value) <= 0) {
      setError("Amount must be greater than 0");
    } else {
      setError("");
    }
  };

  const handleSubmit = async () => {
    if (!amount || error) {

    setIsProcessing(true);

    // Simulate transaction processing
    setTimeout(() => {
      setIsProcessing(false);
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md animate-fadeIn" glassEffect={true}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">
            {actionType === "supply" ? "Supply" : "Borrow"} {market.token}
          </h2>
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
            <TokenIcon token={market.token} size="lg" />
            <div className="ml-3">
              <h3 className="font-bold">{market.token}</h3>
              <p className="text-text-secondary text-sm">
                {actionType === "supply" ? "Supply APY:" : "Borrow APY:"}{" "}
                <span
                  className={
                    actionType === "supply" ? "text-success" : "text-error"
                  }
                >
                  {actionType === "supply"
                    ? market.supplyApy
                    : market.borrowApy}
                </span>
              </p>
            </div>
          </div>

          <Input
            label="Amount"
            type="text"
            value={amount}
            onChange={handleAmountChange}
            placeholder="0.00"
            error={error}
            fullWidth
          />

          <div className="flex justify-between text-sm text-text-secondary mb-2">
            <span>Available: 100.00 {market.token}</span>
            <button
              className="text-primary hover:text-primary-light transition-colors"
              onClick={() => setAmount("100")}
            >
              MAX
            </button>
          </div>
        </div>

        <div className="flex space-x-3">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={actionType === "supply" ? "primary" : "secondary"}
            className="flex-1"
            onClick={handleSubmit}
            disabled={!amount || !!error || isProcessing}
          >
            {isProcessing
              ? "Processing..."
              : actionType === "supply"
                ? "Supply"
                : "Borrow"}
          </Button>
        </div>
      </Card>
    </div>
  );
};
