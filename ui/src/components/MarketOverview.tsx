"use client";

import { FC, useState, useEffect } from "react";
import { TokenIcon } from "./TokenIcon";
import { MarketActionModal } from "./MarketActionModal";
import { solanaDataService, MarketData } from "@/services/solanaDataService";
import { LoadingSpinner } from "./LoadingSpinner";
import { TableSkeleton } from "./SkeletonLoader";
import { InfoTooltip, APYTooltip, UtilizationTooltip } from "./InfoTooltip";
import { CollapsibleSection } from "./CollapsibleSection";

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
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="skeleton skeleton-title" style={{ width: '200px' }} />
            <div className="skeleton skeleton-text" style={{ width: '300px' }} />
          </div>
          <div className="skeleton skeleton-text" style={{ width: '100px' }} />
        </div>
        <TableSkeleton rows={6} />
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
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="typography-h2">Market Overview</h2>
            <InfoTooltip
              content="Real-time lending and borrowing rates for all supported assets on Solana"
              position="bottom"
            />
          </div>
          <p className="typography-body-sm">
            Real-time lending and borrowing rates • Updates every 15s
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="typography-body-sm font-medium">Live</span>
          </div>
          <button
            onClick={fetchMarkets}
            className="btn-secondary text-sm py-2 px-4 focus-visible"
            disabled={loading}
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                Updating...
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Enhanced Responsive Market Table */}
      <div className="table-responsive">
        <div className="table-container">
          <table className="w-full table-enhanced">
            <thead>
              <tr className="text-left">
                <th className="table-header">
                  <div className="flex items-center gap-2">
                    Asset
                    <InfoTooltip content="Supported tokens for lending and borrowing" position="top" />
                  </div>
                </th>
                <th className="table-header mobile-hide">
                  <div className="flex items-center gap-2">
                    Market Size
                    <InfoTooltip content="Total value of tokens available in this market" position="top" />
                  </div>
                </th>
                <th className="table-header">
                  <div className="flex items-center gap-2">
                    Supply APY
                    <APYTooltip />
                  </div>
                </th>
                <th className="table-header mobile-hide">
                  <div className="flex items-center gap-2">
                    Total Borrowed
                    <InfoTooltip content="Total amount currently borrowed from this market" position="top" />
                  </div>
                </th>
                <th className="table-header">
                  <div className="flex items-center gap-2">
                    Borrow APY
                    <InfoTooltip content="Annual interest rate for borrowing this asset" position="top" />
                  </div>
                </th>
                <th className="table-header mobile-hide">
                  <div className="flex items-center gap-2">
                    Utilization
                    <UtilizationTooltip />
                  </div>
                </th>
                <th className="table-header">Actions</th>
              </tr>
            </thead>
            <tbody>
              {markets.map((market, index) => (
                <tr key={market.id} className="table-row animate-slide-up" style={{ animationDelay: `${index * 50}ms` }}>
                  <td className="table-cell">
                    <div className="flex items-center gap-3">
                      <TokenIcon token={market.token} size={32} />
                      <div>
                        <div className="typography-body font-semibold">{market.token}</div>
                        <div className="typography-caption">
                          {market.token === 'SOL' ? 'Solana' : 
                           market.token === 'USDC' ? 'USD Coin' : 
                           market.token === 'ETH' ? 'Ethereum' : 
                           market.token === 'BTC' ? 'Bitcoin' : market.token}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="table-cell mobile-hide">
                    <div>
                      <div className="typography-number font-semibold">{market.totalSupply}</div>
                      <div className="typography-body-sm opacity-75">Total Supply</div>
                    </div>
                  </td>
                  <td className="table-cell">
                    <div className="status-positive inline-flex items-center gap-1.5">
                      <span className="typography-number-sm font-semibold">{market.supplyApy}</span>
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </td>
                  <td className="table-cell mobile-hide">
                    <div>
                      <div className="typography-number font-semibold">{market.totalBorrow}</div>
                      <div className="typography-body-sm opacity-75">Total Borrowed</div>
                    </div>
                  </td>
                  <td className="table-cell">
                    <div className="inline-flex items-center gap-1.5" style={{ color: 'var(--theme-error)' }}>
                      <span className="typography-number-sm font-semibold">{market.borrowApy}</span>
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l4.293-4.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </td>
                  <td className="table-cell mobile-hide">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-20 rounded-full h-2 overflow-hidden"
                          style={{ backgroundColor: 'var(--theme-surface)' }}
                        >
                          <div
                            className="h-full rounded-full transition-all duration-500 ease-out"
                            style={{ 
                              background: (market.utilizationRate || 0) > 80 ? 'var(--theme-gradient-error)' : 
                                         (market.utilizationRate || 0) > 60 ? 'var(--theme-warning)' : 
                                         'var(--theme-gradient-success)',
                              width: `${market.utilizationRate || 0}%` 
                            }}
                          ></div>
                        </div>
                        <span className="typography-number-sm font-semibold">{market.utilizationRateFormatted}</span>
                      </div>
                      <div className="typography-caption">
                        {(market.utilizationRate || 0) > 80 ? 'Very High' :
                         (market.utilizationRate || 0) > 60 ? 'High' : 
                         (market.utilizationRate || 0) > 40 ? 'Medium' : 'Low'} Risk
                      </div>
                    </div>
                  </td>
                  <td className="table-cell">
                    <div className="flex gap-2 mobile-stack">
                      <button
                        onClick={() => handleAction(market, "supply")}
                        className="btn-primary text-sm py-2 px-4 hover-lift focus-visible mobile-full-width"
                      >
                        Supply
                      </button>
                      <button
                        onClick={() => handleAction(market, "borrow")}
                        className="btn-secondary text-sm py-2 px-4 hover-lift focus-visible mobile-full-width"
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
      </div>

      {/* Enhanced Market Summary */}
      <div className="mt-8 space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="stats-card hover-lift">
            <div className="flex items-center justify-between mb-2">
              <div className="typography-caption">TOTAL MARKETS</div>
              <InfoTooltip content="Number of active lending markets" position="top" />
            </div>
            <div className="typography-number-lg font-bold">{markets.length}</div>
            <div className="typography-body-sm mt-1" style={{ color: 'var(--theme-success)' }}>
              +{markets.filter(m => (m.utilizationRate || 0) > 0).length} active
            </div>
          </div>
          
          <div className="stats-card hover-lift">
            <div className="flex items-center justify-between mb-2">
              <div className="typography-caption">AVG SUPPLY APY</div>
              <InfoTooltip content="Average annual percentage yield across all markets" position="top" />
            </div>
            <div className="typography-number-lg font-bold status-positive">
              {markets.length > 0 ? 
                (markets.reduce((acc, market) => acc + (market.supplyApy || 0), 0) / markets.length).toFixed(1) + '%' : 
                '0%'
              }
            </div>
            <div className="typography-body-sm mt-1" style={{ color: 'var(--theme-textMuted)' }}>
              Weighted average
            </div>
          </div>
          
          <div className="stats-card hover-lift">
            <div className="flex items-center justify-between mb-2">
              <div className="typography-caption">AVG UTILIZATION</div>
              <InfoTooltip content="Average utilization rate across all markets" position="top" />
            </div>
            <div className="typography-number-lg font-bold">
              {markets.length > 0 ? 
                (markets.reduce((acc, market) => acc + (market.utilizationRate || 0), 0) / markets.length).toFixed(0) + '%' : 
                '0%'
              }
            </div>
            <div className="typography-body-sm mt-1" style={{ color: 'var(--theme-textMuted)' }}>
              Protocol health
            </div>
          </div>
          
          <div className="stats-card hover-lift">
            <div className="flex items-center justify-between mb-2">
              <div className="typography-caption">TOP PERFORMER</div>
              <InfoTooltip content="Asset with highest supply APY" position="top" />
            </div>
            <div className="typography-number-lg font-bold">
              {markets.length > 0 ? 
                markets.reduce((prev, current) => 
                  (prev.supplyApy || 0) > (current.supplyApy || 0) ? prev : current
                ).token : 
                'N/A'
              }
            </div>
            <div className="typography-body-sm mt-1 status-positive">
              {markets.length > 0 ? 
                Math.max(...markets.map(m => m.supplyApy || 0)).toFixed(1) + '% APY' : 
                '0% APY'
              }
            </div>
          </div>
        </div>

        {/* Market Trends Collapsible Section */}
        <CollapsibleSection
          title="Market Trends & Insights"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          }
          defaultOpen={false}
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="typography-h3">High Yield Opportunities</h4>
              <div className="space-y-3">
                {markets
                  .sort((a, b) => (b.supplyApy || 0) - (a.supplyApy || 0))
                  .slice(0, 3)
                  .map((market, index) => (
                    <div key={market.id} className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: 'var(--theme-surface)' }}>
                      <div className="flex items-center gap-3">
                        <TokenIcon token={market.token} size={24} />
                        <div>
                          <div className="typography-body font-medium">{market.token}</div>
                          <div className="typography-body-sm">Supply opportunity</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="typography-number-sm font-semibold status-positive">{market.supplyApy}</div>
                        <div className="typography-caption">#{index + 1} yield</div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
            
            <div className="space-y-4">
              <h4 className="typography-h3">Market Utilization</h4>
              <div className="space-y-3">
                {markets
                  .sort((a, b) => (b.utilizationRate || 0) - (a.utilizationRate || 0))
                  .slice(0, 3)
                  .map((market, index) => (
                    <div key={market.id} className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: 'var(--theme-surface)' }}>
                      <div className="flex items-center gap-3">
                        <TokenIcon token={market.token} size={24} />
                        <div>
                          <div className="typography-body font-medium">{market.token}</div>
                          <div className="typography-body-sm">
                            {(market.utilizationRate || 0) > 80 ? 'High demand' : 
                             (market.utilizationRate || 0) > 60 ? 'Moderate demand' : 'Low demand'}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="typography-number-sm font-semibold">{market.utilizationRate}</div>
                        <div className="typography-caption">utilization</div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </CollapsibleSection>
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
