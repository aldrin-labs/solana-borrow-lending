"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

interface RPCEndpoint {
  name: string;
  url: string;
  isCustom?: boolean;
}

interface RPCProviderContextType {
  currentEndpoint: RPCEndpoint;
  setEndpoint: (endpoint: RPCEndpoint) => void;
  customEndpoints: RPCEndpoint[];
  addCustomEndpoint: (endpoint: RPCEndpoint) => void;
  removeCustomEndpoint: (url: string) => void;
}

const DEFAULT_ENDPOINT: RPCEndpoint = {
  name: "Mainnet (Official)",
  url: "https://api.mainnet-beta.solana.com",
};

const RPCProviderContext = createContext<RPCProviderContextType | undefined>(undefined);

const STORAGE_KEY = 'maga-rpc-settings';

export const RPCProviderProvider = ({ children }: { children: ReactNode }) => {
  const [currentEndpoint, setCurrentEndpoint] = useState<RPCEndpoint>(DEFAULT_ENDPOINT);
  const [customEndpoints, setCustomEndpoints] = useState<RPCEndpoint[]>([]);

  // Load saved settings from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const settings = JSON.parse(saved);
        if (settings.currentEndpoint) {
          setCurrentEndpoint(settings.currentEndpoint);
        }
        if (settings.customEndpoints && Array.isArray(settings.customEndpoints)) {
          setCustomEndpoints(settings.customEndpoints);
        }
      }
    } catch (error) {
      console.warn('Failed to load RPC settings:', error);
    }
  }, []);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    try {
      const settings = {
        currentEndpoint,
        customEndpoints,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.warn('Failed to save RPC settings:', error);
    }
  }, [currentEndpoint, customEndpoints]);

  const setEndpoint = (endpoint: RPCEndpoint) => {
    setCurrentEndpoint(endpoint);
    
    // Emit a custom event to notify other parts of the app
    const event = new CustomEvent('rpc-endpoint-changed', {
      detail: { endpoint }
    });
    window.dispatchEvent(event);
  };

  const addCustomEndpoint = (endpoint: RPCEndpoint) => {
    setCustomEndpoints(prev => {
      // Check if endpoint already exists
      const exists = prev.some(e => e.url === endpoint.url);
      if (exists) {
        return prev;
      }
      
      const newEndpoint = { ...endpoint, isCustom: true };
      const updated = [...prev, newEndpoint];
      
      // Automatically select the new endpoint
      setCurrentEndpoint(newEndpoint);
      
      return updated;
    });
  };

  const removeCustomEndpoint = (url: string) => {
    setCustomEndpoints(prev => prev.filter(e => e.url !== url));
    
    // If the removed endpoint was the current one, switch to default
    if (currentEndpoint.url === url) {
      setCurrentEndpoint(DEFAULT_ENDPOINT);
    }
  };

  const value: RPCProviderContextType = {
    currentEndpoint,
    setEndpoint,
    customEndpoints,
    addCustomEndpoint,
    removeCustomEndpoint,
  };

  return (
    <RPCProviderContext.Provider value={value}>
      {children}
    </RPCProviderContext.Provider>
  );
};

export const useRPCProvider = () => {
  const context = useContext(RPCProviderContext);
  if (context === undefined) {
    throw new Error('useRPCProvider must be used within a RPCProviderProvider');
  }
  return context;
};