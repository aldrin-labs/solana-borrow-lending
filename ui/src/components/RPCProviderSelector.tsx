"use client";

import { FC, useState, useRef, useEffect } from "react";
import { ChevronDownIcon, GlobeAltIcon, PlusIcon } from "@heroicons/react/24/outline";
import { useRPCProvider } from "@/contexts/RPCProviderContext";

interface RPCEndpoint {
  name: string;
  url: string;
  isCustom?: boolean;
}

const DEFAULT_ENDPOINTS: RPCEndpoint[] = [
  { name: "Mainnet (Official)", url: "https://api.mainnet-beta.solana.com" },
  { name: "QuickNode", url: "https://solana-mainnet.quicknode.pro" },
  { name: "Genesys Go", url: "https://ssc-dao.genesysgo.net" },
  { name: "Helius", url: "https://rpc.helius.xyz" },
  { name: "Alchemy", url: "https://solana-mainnet.g.alchemy.com/v2" },
];

export const RPCProviderSelector: FC = () => {
  const { currentEndpoint, setEndpoint, customEndpoints, addCustomEndpoint } = useRPCProvider();
  const [isOpen, setIsOpen] = useState(false);
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customUrl, setCustomUrl] = useState("");
  const [customName, setCustomName] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const allEndpoints = [...DEFAULT_ENDPOINTS, ...customEndpoints];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowAddCustom(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleEndpointSelect = (endpoint: RPCEndpoint) => {
    setEndpoint(endpoint);
    setIsOpen(false);
  };

  const handleAddCustomEndpoint = () => {
    if (customUrl.trim() && customName.trim()) {
      addCustomEndpoint({
        name: customName.trim(),
        url: customUrl.trim(),
        isCustom: true
      });
      setCustomUrl("");
      setCustomName("");
      setShowAddCustom(false);
    }
  };

  const isValidUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 rounded-lg font-medium transition-all duration-200 hover:bg-opacity-10 focus-visible"
        style={{
          color: 'var(--theme-textSecondary)',
          backgroundColor: 'var(--theme-surface)',
          border: '1px solid var(--theme-border)',
        }}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <GlobeAltIcon className="w-4 h-4" />
        <span className="hidden sm:inline text-sm">{currentEndpoint.name}</span>
        <ChevronDownIcon 
          className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {isOpen && (
        <div 
          className="absolute right-0 mt-2 w-80 rounded-lg shadow-lg z-50 animate-scale-in"
          style={{
            backgroundColor: 'var(--theme-card)',
            border: '1px solid var(--theme-border)',
            boxShadow: 'var(--theme-shadow-lg)',
          }}
        >
          <div className="p-3 border-b" style={{ borderColor: 'var(--theme-border)' }}>
            <h3 className="typography-body-sm font-semibold" style={{ color: 'var(--theme-textPrimary)' }}>
              RPC Provider
            </h3>
            <p className="typography-caption" style={{ color: 'var(--theme-textMuted)' }}>
              Select or add a custom RPC endpoint
            </p>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {allEndpoints.map((endpoint, index) => (
              <button
                key={`${endpoint.url}-${index}`}
                onClick={() => handleEndpointSelect(endpoint)}
                className="w-full text-left px-4 py-3 hover:bg-opacity-10 transition-all duration-200 flex items-center justify-between group"
                style={{
                  backgroundColor: currentEndpoint.url === endpoint.url ? 'color-mix(in srgb, var(--theme-primary) 10%, transparent)' : 'transparent',
                }}
              >
                <div className="flex-1 min-w-0">
                  <div 
                    className="typography-body-sm font-medium truncate"
                    style={{ 
                      color: currentEndpoint.url === endpoint.url ? 'var(--theme-primary)' : 'var(--theme-textPrimary)' 
                    }}
                  >
                    {endpoint.name}
                    {endpoint.isCustom && (
                      <span className="ml-2 text-xs px-2 py-0.5 rounded-full" style={{ 
                        backgroundColor: 'var(--theme-warning)', 
                        color: 'white' 
                      }}>
                        Custom
                      </span>
                    )}
                  </div>
                  <div 
                    className="typography-caption truncate"
                    style={{ color: 'var(--theme-textMuted)' }}
                  >
                    {endpoint.url}
                  </div>
                </div>
                {currentEndpoint.url === endpoint.url && (
                  <div 
                    className="w-2 h-2 rounded-full ml-2"
                    style={{ backgroundColor: 'var(--theme-primary)' }}
                  />
                )}
              </button>
            ))}
          </div>

          <div className="border-t p-3" style={{ borderColor: 'var(--theme-border)' }}>
            {!showAddCustom ? (
              <button
                onClick={() => setShowAddCustom(true)}
                className="w-full flex items-center justify-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 hover:bg-opacity-10"
                style={{
                  color: 'var(--theme-primary)',
                  backgroundColor: 'color-mix(in srgb, var(--theme-primary) 5%, transparent)',
                  border: '1px solid var(--theme-primary)',
                }}
              >
                <PlusIcon className="w-4 h-4" />
                <span className="typography-body-sm">Add Custom RPC</span>
              </button>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="typography-caption block mb-1" style={{ color: 'var(--theme-textSecondary)' }}>
                    Name
                  </label>
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="Custom RPC Name"
                    className="input w-full"
                    style={{
                      backgroundColor: 'var(--theme-surface)',
                      border: '1px solid var(--theme-border)',
                      color: 'var(--theme-textPrimary)',
                    }}
                  />
                </div>
                <div>
                  <label className="typography-caption block mb-1" style={{ color: 'var(--theme-textSecondary)' }}>
                    URL
                  </label>
                  <input
                    type="url"
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    placeholder="https://your-rpc-endpoint.com"
                    className="input w-full"
                    style={{
                      backgroundColor: 'var(--theme-surface)',
                      border: '1px solid var(--theme-border)',
                      color: 'var(--theme-textPrimary)',
                    }}
                  />
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={handleAddCustomEndpoint}
                    disabled={!customName.trim() || !customUrl.trim() || !isValidUrl(customUrl)}
                    className="btn-primary flex-1 text-sm py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => {
                      setShowAddCustom(false);
                      setCustomUrl("");
                      setCustomName("");
                    }}
                    className="btn-secondary flex-1 text-sm py-2"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};