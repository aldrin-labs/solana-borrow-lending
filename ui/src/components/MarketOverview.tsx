"use client";

import { FC, useState, useEffect } from "react";
import { TokenIcon } from "./TokenIcon";
import { MarketActionModal } from "./MarketActionModal";
import { solanaDataService, MarketData } from "@/services/solanaDataService";
import { LoadingSpinner } from "./LoadingSpinner";

export const MarketOverview: FC = () => {
  const [markets, setMarkets] = useState<MarketData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMarket, setSelectedMarket] = useState<MarketData | null>(null);
  const [actionType, setActionType] = useState<"supply" | "borrow" | null>(null);

  const fetchMarkets = async () => {
    try {
      setLoading(true);
      setError(null);
      const marketData = await solanaDataService.fetchMarketData();
      setMarkets(marketData);
    } catch (err) {
      console.error('Error fetching markets:', err);
      setError('Failed to load market data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarkets();
    
    // Set up real-time updates every 15 seconds
    const interval = setInterval(fetchMarkets, 15000);
    
    return () => clearInterval(interval);
  }, []);

  const handleAction = (market: MarketData, action: "supply" | "borrow") => {
    setSelectedMarket(market);
    setActionType(action);
  };

  const closeModal = () => {
    setSelectedMarket(null);
    setActionType(null);
  };

  if (loading && markets.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="typography-body" style={{ color: 'var(--theme-error)' }}>
          {error}
        </p>
        <button 
          onClick={fetchMarkets}
          className="btn-primary mt-4"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Market Overview Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="typography-h2 mb-1">Market Overview</h2>
          <p className="typography-body-sm">
            Real-time lending and borrowing rates • Updates every 15s
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="typography-body-sm">Live</span>
          </div>
          <button
            onClick={fetchMarkets}
            className="btn-secondary text-sm py-1.5 px-3"
            disabled={loading}
          >
            {loading ? 'Updating...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Compact Market Table */}
      <div className="table-container">
        <table className="w-full">
          <thead>
            <tr className="text-left">
              <th className="table-header py-3 px-4">Asset</th>
              <th className="table-header py-3 px-4">Market Size</th>
              <th className="table-header py-3 px-4">Supply APY</th>
              <th className="table-header py-3 px-4">Borrow</th>
              <th className="table-header py-3 px-4">Borrow APY</th>
              <th className="table-header py-3 px-4">Utilization</th>
              <th className="table-header py-3 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {markets.map((market, index) => (
              <tr key={market.id} className="table-row" style={{ animationDelay: `${index * 50}ms` }}>
                <td className="table-cell py-3 px-4">
                  <div className="flex items-center gap-3">
                    <TokenIcon token={market.token} size={28} />
                    <div>
                      <div className="typography-body font-medium">{market.token}</div>
                      <div className="typography-caption">{market.token === 'SOL' ? 'Solana' : market.token === 'USDC' ? 'USD Coin' : market.token === 'ETH' ? 'Ethereum' : market.token === 'BTC' ? 'Bitcoin' : market.token}</div>
                    </div>
                  </div>
                </td>
                <td className="table-cell py-3 px-4">
                  <div>
                    <div className="typography-number font-medium">{market.totalSupply}</div>
                    <div className="typography-body-sm opacity-75">Total Supply</div>
                  </div>
                </td>
                <td className="table-cell py-3 px-4">
                  <div className="status-positive inline-flex items-center gap-1">
                    <span className="typography-number-sm font-medium">{market.supplyApy}</span>
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
                </td>
                <td className="table-cell py-3 px-4">
                  <div>
                    <div className="typography-number font-medium">{market.totalBorrow}</div>
                    <div className="typography-body-sm opacity-75">Total Borrow</div>
                  </div>
                </td>
                <td className="table-cell py-3 px-4">
                  <div className="inline-flex items-center gap-1" style={{ color: 'var(--theme-error)' }}>
                    <span className="typography-number-sm font-medium">{market.borrowApy}</span>
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
                </td>
                <td className="table-cell py-3 px-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-16 rounded-full h-1.5 overflow-hidden"
                        style={{ backgroundColor: 'var(--theme-surface)' }}
                      >
                        <div
                          className="h-full rounded-full transition-all duration-500 ease-out"
                          style={{ 
                            background: parseInt(market.utilizationRate) > 70 ? 'var(--theme-gradient-error)' : 
                                       parseInt(market.utilizationRate) > 50 ? 'var(--theme-gradient-primary)' : 
                                       'var(--theme-gradient-success)',
                            width: market.utilizationRate 
                          }}
                        ></div>
                      </div>
                      <span className="typography-number-sm font-medium">{market.utilizationRate}</span>
                    </div>
                    <div className="typography-caption">
                      {parseInt(market.utilizationRate) > 70 ? 'High' : 
                       parseInt(market.utilizationRate) > 50 ? 'Medium' : 'Low'} Utilization
                    </div>
                  </div>
                </td>
                <td className="table-cell py-3 px-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAction(market, "supply")}
                      className="btn-primary text-sm py-1.5 px-3 hover-lift"
                    >
                      Supply
                    </button>
                    <button
                      onClick={() => handleAction(market, "borrow")}
                      className="btn-secondary text-sm py-1.5 px-3 hover-lift"
                    >
                      Borrow
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Market Summary Footer */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface rounded-lg p-4 border border-border">
          <div className="typography-caption mb-1">TOTAL MARKETS</div>
          <div className="typography-number-lg font-semibold">{markets.length}</div>
        </div>
        <div className="bg-surface rounded-lg p-4 border border-border">
          <div className="typography-caption mb-1">AVG SUPPLY APY</div>
          <div className="typography-number-lg font-semibold status-positive">
            {markets.length > 0 ? 
              (markets.reduce((acc, market) => acc + parseFloat(market.supplyApy), 0) / markets.length).toFixed(1) + '%' : 
              '0%'
            }
          </div>
        </div>
        <div className="bg-surface rounded-lg p-4 border border-border">
          <div className="typography-caption mb-1">AVG UTILIZATION</div>
          <div className="typography-number-lg font-semibold">
            {markets.length > 0 ? 
              (markets.reduce((acc, market) => acc + parseInt(market.utilizationRate), 0) / markets.length).toFixed(0) + '%' : 
              '0%'
            }
          </div>
        </div>
      </div>

      {selectedMarket && actionType && (
        <MarketActionModal
          market={selectedMarket}
          actionType={actionType}
          onClose={closeModal}
        />
      )}
    </div>
  );
};
