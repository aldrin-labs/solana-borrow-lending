import { FC, useState, useEffect } from "react";
import { useWalletConnection } from "@/hooks/useWalletConnection";
import { Card } from "./Card";
import { Button } from "./Button";

interface UserPositionsProps {
  positionType?: "supply" | "borrow";
}

// Mock data for demonstration (moved outside component to avoid dependency warnings)
const mockSupplyPositions = [
  {
    id: "1",
    token: "SOL",
    amount: "5.0 SOL",
    value: "$500.00",
    apy: "3.2%",
    collateral: true,
  },
  {
    id: "2",
    token: "USDC",
    amount: "1,000 USDC",
    value: "$1,000.00",
    apy: "2.5%",
    collateral: true,
  },
];

const mockBorrowPositions = [
  {
    id: "1",
    token: "USDC",
    amount: "450 USDC",
    value: "$450.00",
    apy: "4.2%",
    healthFactor: 1.8,
  },
];

export const UserPositions: FC<UserPositionsProps> = ({
  positionType = "supply",
}) => {
  const { connected } = useWalletConnection();
  const [positions, setPositions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (connected) {
      // Simulate API call
      setTimeout(() => {
        setPositions(
          positionType === "supply" ? mockSupplyPositions : mockBorrowPositions,
        );
        setIsLoading(false);
      }, 500);
    } else {
      setPositions([]);
      setIsLoading(false);
    }
  }, [connected, positionType]);

  if (!connected) {
    return (
      <Card className="text-center py-12">
        <h2 className="text-2xl font-bold mb-4">Connect Your Wallet</h2>
        <p className="text-text-secondary mb-6">
          Connect your wallet to view your{" "}
          {positionType === "supply" ? "supplies" : "borrows"}
        </p>
        <Button variant="connect">Connect Wallet</Button>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="text-center py-12">
        <div className="flex justify-center items-center">
          <svg
            className="animate-spin h-8 w-8 text-primary"
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
        </div>
      </Card>
    );
  }

  if (positions.length === 0) {
    return (
      <Card className="text-center py-12">
        <h2 className="text-2xl font-bold mb-4">
          No {positionType === "supply" ? "Supplies" : "Borrows"} Found
        </h2>
        <p className="text-text-secondary mb-6">
          You don&apos;t have any{" "}
          {positionType === "supply" ? "supplies" : "borrows"} yet
        </p>
        <Button variant={positionType === "supply" ? "primary" : "secondary"}>
          {positionType === "supply" ? "Supply Assets" : "Borrow Assets"}
        </Button>
      </Card>
    );
  }

  return (
    <div>
      {positionType === "supply" ? (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left">
                <th className="table-header font-medium">Asset</th>
                <th className="table-header font-medium">Amount</th>
                <th className="table-header font-medium">Value</th>
                <th className="table-header font-medium">APY</th>
                <th className="table-header font-medium">Collateral</th>
                <th className="table-header font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((position) => (
                <tr key={position.id} className="table-row">
                  <td className="table-cell">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                        <span className="text-white font-bold">
                          {position.token.substring(0, 1)}
                        </span>
                      </div>
                      <span className="font-medium text-white">
                        {position.token}
                      </span>
                    </div>
                  </td>
                  <td className="table-cell">{position.amount}</td>
                  <td className="table-cell">{position.value}</td>
                  <td className="table-cell text-success">{position.apy}</td>
                  <td className="table-cell">
                    {position.collateral ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success/20 text-success">
                        Yes
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-border text-text-secondary">
                        No
                      </span>
                    )}
                  </td>
                  <td className="table-cell">
                    <div className="flex space-x-2">
                      <Button variant="primary" size="sm">
                        Withdraw
                      </Button>
                      {position.collateral && (
                        <Button variant="secondary" size="sm">
                          Disable as Collateral
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left">
                <th className="table-header font-medium">Asset</th>
                <th className="table-header font-medium">Amount</th>
                <th className="table-header font-medium">Value</th>
                <th className="table-header font-medium">APY</th>
                <th className="table-header font-medium">Health Factor</th>
                <th className="table-header font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((position) => (
                <tr key={position.id} className="table-row">
                  <td className="table-cell">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                        <span className="text-white font-bold">
                          {position.token.substring(0, 1)}
                        </span>
                      </div>
                      <span className="font-medium text-white">
                        {position.token}
                      </span>
                    </div>
                  </td>
                  <td className="table-cell">{position.amount}</td>
                  <td className="table-cell">{position.value}</td>
                  <td className="table-cell text-error">{position.apy}</td>
                  <td className="table-cell">
                    <div className="flex items-center">
                      <span className="text-success font-medium mr-2">
                        {position.healthFactor}
                      </span>
                      <div className="w-24 bg-border rounded-full h-2.5">
                        <div
                          className="bg-success h-2.5 rounded-full"
                          style={{
                            width: `${Math.min(position.healthFactor / 2, 1) * 100}%`,
                          }}
                        ></div>
                      </div>
                    </div>
                  </td>
                  <td className="table-cell">
                    <Button variant="primary" size="sm">
                      Repay
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};