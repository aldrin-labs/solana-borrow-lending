import { FC, useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Card } from "./Card";
import { Button } from "./Button";
import { TokenIcon } from "./TokenIcon";
import { solanaDataService, UserPosition } from "@/services/solanaDataService";
import { LoadingSpinner } from "./LoadingSpinner";

interface UserPositionsProps {
  positionType?: "supply" | "borrow";
}

export const UserPositions: FC<UserPositionsProps> = ({
  positionType = "supply",
}) => {
  const { connected, publicKey } = useWallet();
  const [positions, setPositions] = useState<UserPosition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPositions = async () => {
      if (!connected || !publicKey) {
        setPositions([]);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        const userPositions = await solanaDataService.fetchUserPositions(publicKey.toString());
        setPositions(positionType === "supply" ? userPositions.supplied : userPositions.borrowed);
      } catch (err) {
        console.error('Error fetching user positions:', err);
        setError('Failed to load positions');
        setPositions([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPositions();
    
    // Update positions every 30 seconds
    const interval = setInterval(fetchPositions, 30000);
    
    return () => clearInterval(interval);
  }, [connected, publicKey, positionType]);

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
          <h2 className="typography-h2 mb-3">
            Connect Your Wallet
          </h2>
          <p className="typography-body mb-8">
            Connect your wallet to view your{" "}
            {positionType === "supply" ? "supply positions" : "borrowed positions"}
          </p>
          <Button variant="connect">Connect Wallet</Button>
        </div>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="text-center py-16">
        <LoadingSpinner />
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="text-center py-16">
        <p className="typography-body" style={{ color: 'var(--theme-error)' }}>
          {error}
        </p>
        <button 
          onClick={() => window.location.reload()}
          className="btn-primary mt-4"
        >
          Retry
        </button>
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
          <h2 className="typography-h2 mb-3">
            No {positionType === "supply" ? "Supplies" : "Borrows"} Found
          </h2>
          <p className="typography-body mb-8">
            You don&apos;t have any{" "}
            {positionType === "supply" ? "supply positions" : "borrowed positions"} yet
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
      {/* Positions Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="typography-h3 mb-1">
            Your {positionType === "supply" ? "Supply" : "Borrow"} Positions
          </h2>
          <p className="typography-body-sm">
            {positions.length} active position{positions.length !== 1 ? 's' : ''} • Real-time data
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="typography-body-sm">Live</span>
          </div>
        </div>
      </div>

      {positionType === "supply" ? (
        <div className="table-container">
          <table className="w-full">
            <thead>
              <tr className="text-left">
                <th className="table-header py-3 px-4">Asset</th>
                <th className="table-header py-3 px-4">Amount</th>
                <th className="table-header py-3 px-4">USD Value</th>
                <th className="table-header py-3 px-4">Supply APY</th>
                <th className="table-header py-3 px-4">Collateral</th>
                <th className="table-header py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((position, index) => (
                <tr key={position.id} className="table-row animate-slide-up" style={{ animationDelay: `${index * 50}ms` }}>
                  <td className="table-cell py-3 px-4">
                    <div className="flex items-center gap-3">
                      <TokenIcon token={position.token} size={32} />
                      <div>
                        <div className="typography-body font-medium">{position.token}</div>
                        <div className="typography-caption">
                          {position.token === 'SOL' ? 'Solana' : 
                           position.token === 'USDC' ? 'USD Coin' : 
                           position.token}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="table-cell py-3 px-4">
                    <div className="typography-number font-medium">{position.amount}</div>
                  </td>
                  <td className="table-cell py-3 px-4">
                    <div className="typography-number font-medium">{position.value}</div>
                  </td>
                  <td className="table-cell py-3 px-4">
                    <div className="status-positive inline-flex items-center gap-1">
                      <span className="typography-number-sm font-medium">{position.apy}</span>
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </td>
                  <td className="table-cell py-3 px-4">
                    {position.collateral ? (
                      <div className="status-positive inline-flex items-center gap-1">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        <span className="typography-body-sm">Enabled</span>
                      </div>
                    ) : (
                      <div className="status-neutral inline-flex items-center gap-1">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                        <span className="typography-body-sm">Disabled</span>
                      </div>
                    )}
                  </td>
                  <td className="table-cell py-3 px-4">
                    <div className="flex gap-2">
                      <Button variant="primary" size="sm" className="hover-lift">
                        Withdraw
                      </Button>
                      <Button variant="secondary" size="sm" className="hover-lift">
                        {position.collateral ? 'Disable' : 'Enable'}
                      </Button>
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
                <th className="table-header py-3 px-4">Asset</th>
                <th className="table-header py-3 px-4">Amount</th>
                <th className="table-header py-3 px-4">USD Value</th>
                <th className="table-header py-3 px-4">Borrow APY</th>
                <th className="table-header py-3 px-4">Health Factor</th>
                <th className="table-header py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((position, index) => {
                const healthFactor = parseFloat(position.healthFactor || '0');
                return (
                  <tr key={position.id} className="table-row animate-slide-up" style={{ animationDelay: `${index * 50}ms` }}>
                    <td className="table-cell py-3 px-4">
                      <div className="flex items-center gap-3">
                        <TokenIcon token={position.token} size={32} />
                        <div>
                          <div className="typography-body font-medium">{position.token}</div>
                          <div className="typography-caption">
                            {position.token === 'SOL' ? 'Solana' : 
                             position.token === 'USDC' ? 'USD Coin' : 
                             position.token}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="table-cell py-3 px-4">
                      <div className="typography-number font-medium">{position.amount}</div>
                    </td>
                    <td className="table-cell py-3 px-4">
                      <div className="typography-number font-medium">{position.value}</div>
                    </td>
                    <td className="table-cell py-3 px-4">
                      <div className="inline-flex items-center gap-1" style={{ color: 'var(--theme-error)' }}>
                        <span className="typography-number-sm font-medium">{position.apy}</span>
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </td>
                    <td className="table-cell py-3 px-4">
                      <div className="flex items-center gap-3">
                        <span className={`typography-number-sm font-semibold ${
                          healthFactor > 1.5 ? 'status-positive' : 
                          healthFactor > 1.2 ? 'text-warning' : 'status-negative'
                        }`}>
                          {healthFactor.toFixed(2)}
                        </span>
                        <div className="w-20 bg-surface rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              healthFactor > 1.5 ? 'bg-success' : 
                              healthFactor > 1.2 ? 'bg-warning' : 'bg-error'
                            }`}
                            style={{
                              width: `${Math.min(healthFactor / 2, 1) * 100}%`,
                            }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td className="table-cell py-3 px-4">
                      <div className="flex gap-2">
                        <Button variant="primary" size="sm" className="hover-lift">
                          Repay
                        </Button>
                        <Button variant="secondary" size="sm" className="hover-lift">
                          Borrow More
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Position Summary */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-surface rounded-lg p-4 border border-border">
          <div className="typography-caption mb-1">
            TOTAL {positionType === "supply" ? "SUPPLIED" : "BORROWED"}
          </div>
          <div className="typography-number-lg font-semibold">
            ${positions.reduce((total, pos) => total + (pos.valueNumeric || 0), 0).toLocaleString()}
          </div>
        </div>
        <div className="bg-surface rounded-lg p-4 border border-border">
          <div className="typography-caption mb-1">
            AVG {positionType === "supply" ? "SUPPLY" : "BORROW"} APY
          </div>
          <div className="typography-number-lg font-semibold">
            {positions.length > 0 ? 
              (positions.reduce((acc, pos) => acc + parseFloat(pos.apy), 0) / positions.length).toFixed(1) + '%' : 
              '0%'
            }
          </div>
        </div>
      </div>
    </div>
  );
};