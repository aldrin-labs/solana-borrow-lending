import { FC, useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
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
  const { connected } = useWallet();
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
      <Card className="text-center py-16 animate-scale-in">
        <div className="max-w-md mx-auto">
          <div 
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ background: 'var(--theme-gradient-primary)' }}
          >
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold text-text-primary mb-3">
            Connect Your Wallet
          </h2>
          <p className="text-text-secondary mb-8">
            Connect your wallet to view your{" "}
            {positionType === "supply" ? "supplies" : "borrows"}
          </p>
          <Button variant="connect">Connect Wallet</Button>
        </div>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="text-center py-16">
        <div className="flex justify-center items-center space-x-3">
          <div 
            className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
            style={{ 
              borderColor: 'var(--theme-primary)',
              borderTopColor: 'transparent'
            }}
          ></div>
          <span style={{ color: 'var(--theme-textSecondary)' }}>
            Loading positions...
          </span>
        </div>
      </Card>
    );
  }

  if (positions.length === 0) {
    return (
      <Card className="text-center py-16 animate-scale-in">
        <div className="max-w-md mx-auto">
          <div 
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ backgroundColor: 'var(--theme-surface)' }}
          >
            <svg 
              className="w-8 h-8" 
              style={{ color: 'var(--theme-textMuted)' }}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 
            className="text-2xl font-semibold mb-3"
            style={{ color: 'var(--theme-textPrimary)' }}
          >
            No {positionType === "supply" ? "Supplies" : "Borrows"} Found
          </h2>
          <p 
            className="mb-8"
            style={{ color: 'var(--theme-textSecondary)' }}
          >
            You don&apos;t have any{" "}
            {positionType === "supply" ? "supplies" : "borrows"} yet
          </p>
          <Button variant={positionType === "supply" ? "primary" : "secondary"}>
            {positionType === "supply" ? "Supply Assets" : "Borrow Assets"}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="animate-fade-in">
      {positionType === "supply" ? (
        <div className="table-container">
          <table className="w-full">
            <thead>
              <tr className="text-left">
                <th className="table-header">Asset</th>
                <th className="table-header">Amount</th>
                <th className="table-header">Value</th>
                <th className="table-header">APY</th>
                <th className="table-header">Collateral</th>
                <th className="table-header">Actions</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((position, index) => (
                <tr key={position.id} className="table-row animate-slide-up" style={{ animationDelay: `${index * 100}ms` }}>
                  <td className="table-cell">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center">
                        <span className="text-white font-bold text-sm">
                          {position.token.substring(0, 1)}
                        </span>
                      </div>
                      <span className="font-semibold text-text-primary">
                        {position.token}
                      </span>
                    </div>
                  </td>
                  <td className="table-cell font-medium">{position.amount}</td>
                  <td className="table-cell font-medium">{position.value}</td>
                  <td className="table-cell">
                    <span className="status-positive">{position.apy}</span>
                  </td>
                  <td className="table-cell">
                    {position.collateral ? (
                      <span className="status-positive">
                        Yes
                      </span>
                    ) : (
                      <span className="status-neutral">
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
        <div className="table-container">
          <table className="w-full">
            <thead>
              <tr className="text-left">
                <th className="table-header">Asset</th>
                <th className="table-header">Amount</th>
                <th className="table-header">Value</th>
                <th className="table-header">APY</th>
                <th className="table-header">Health Factor</th>
                <th className="table-header">Actions</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((position, index) => (
                <tr key={position.id} className="table-row animate-slide-up" style={{ animationDelay: `${index * 100}ms` }}>
                  <td className="table-cell">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center">
                        <span className="text-white font-bold text-sm">
                          {position.token.substring(0, 1)}
                        </span>
                      </div>
                      <span className="font-semibold text-text-primary">
                        {position.token}
                      </span>
                    </div>
                  </td>
                  <td className="table-cell font-medium">{position.amount}</td>
                  <td className="table-cell font-medium">{position.value}</td>
                  <td className="table-cell">
                    <span className="text-error font-medium">{position.apy}</span>
                  </td>
                  <td className="table-cell">
                    <div className="flex items-center space-x-3">
                      <span className={`font-semibold ${
                        position.healthFactor > 1.5 ? 'text-success' : 
                        position.healthFactor > 1.2 ? 'text-warning' : 'text-error'
                      }`}>
                        {position.healthFactor}
                      </span>
                      <div className="w-24 bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            position.healthFactor > 1.5 ? 'bg-success' : 
                            position.healthFactor > 1.2 ? 'bg-warning' : 'bg-error'
                          }`}
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