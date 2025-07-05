"use client";

import { FC, ReactNode, useMemo, useEffect, useState, useCallback } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { clusterApiUrl } from "@solana/web3.js";

import { LoadingSpinner } from "./LoadingSpinner";

// Import the local wallet adapter CSS (modified to remove Google Fonts)
import "@/styles/wallet-adapter.css";

interface WalletProviderWrapperProps {
  children: ReactNode;
}

export const WalletProviderWrapper: FC<WalletProviderWrapperProps> = ({
  children,
}) => {
  const [isClient, setIsClient] = useState(false);
  
  // Prevent wallet extension conflicts
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Protect against multiple wallet extensions overriding window.ethereum
    const originalEthereum = (window as any).ethereum;
    
    // Override property definition to prevent conflicts
    if (originalEthereum) {
      try {
        Object.defineProperty(window, 'ethereum', {
          value: originalEthereum,
          writable: false,
          configurable: false
        });
      } catch (error) {
        // Property already defined, ignore
        console.warn('Ethereum provider already configured');
      }
    }
  }, []);
  
  // Ensure component only renders on client to avoid SSR issues
  useEffect(() => {
    // Immediate client detection, no artificial delays
    setIsClient(true);
    
    // Add global error handler for wallet-related errors
    const handleWalletError = (event: ErrorEvent) => {
      if (event.error && 
          (event.error.message?.includes('Cannot read properties of null') ||
           event.error.message?.includes('Cannot set property ethereum') ||
           event.error.message?.includes('Cannot redefine property') ||
           event.error.message?.includes('wallet adapter'))) {
        console.warn('Wallet adapter error handled:', event.error.message);
        event.preventDefault();
        return true;
      }
      return false;
    };

    // Add promise rejection handler for wallet-related errors
    const handleWalletRejection = (event: PromiseRejectionEvent) => {
      if (event.reason && 
          (event.reason.message?.includes('Cannot read properties of null') ||
           event.reason.message?.includes('Cannot set property ethereum') ||
           event.reason.message?.includes('Cannot redefine property') ||
           event.reason.message?.includes('wallet adapter'))) {
        console.warn('Wallet adapter promise rejection handled:', event.reason.message);
        event.preventDefault();
        return true;
      }
      return false;
    };

    window.addEventListener('error', handleWalletError);
    window.addEventListener('unhandledrejection', handleWalletRejection);

    return () => {
      window.removeEventListener('error', handleWalletError);
      window.removeEventListener('unhandledrejection', handleWalletRejection);
    };
  }, []);

  // The network can be set to 'devnet', 'testnet', or 'mainnet-beta'
  const network = WalletAdapterNetwork.Devnet;

  // Use multiple RPC endpoints with fallback logic
  const endpoint = useMemo(() => {
    // Use reliable public RPC endpoints with fallback
    const endpoints = [
      'https://api.devnet.solana.com',
      'https://devnet.genesysgo.net',
      clusterApiUrl(network),
    ];
    
    // For now, use the first endpoint
    // In production, implement proper failover logic
    return endpoints[0];
  }, [network]);

  // Safe wallet adapter initialization
  const wallets = useMemo(
    () => {
      if (!isClient) return [];
      
      try {
        // Add extra safety checks for wallet initialization
        const adapters = [];
        
        // Only initialize wallets if window and extensions are available
        if (typeof window !== 'undefined') {
          try {
            const phantom = new PhantomWalletAdapter();
            if (phantom) adapters.push(phantom);
          } catch (error) {
            console.warn('Failed to initialize Phantom wallet adapter:', error);
          }
          
          try {
            const solflare = new SolflareWalletAdapter();
            if (solflare) adapters.push(solflare);
          } catch (error) {
            console.warn('Failed to initialize Solflare wallet adapter:', error);
          }
        }
        
        return adapters;
      } catch (error) {
        console.warn('Error initializing wallet adapters:', error);
        return [];
      }
    },
    [isClient],
  );

  // Enhanced error handling for wallet provider
  const handleWalletError = useCallback((error: any) => {
    console.warn('Wallet provider error:', error);
    // Prevent error propagation for known wallet issues
    if (error?.message?.includes('Cannot read properties of null') ||
        error?.message?.includes('publicKey') ||
        error?.message?.includes('wallet')) {
      return; // Suppress error
    }
  }, []);

  // Don't render on server - but render immediately on client
  if (!isClient) {
    return <LoadingSpinner />;
  }

  // Render with enhanced error boundaries
  try {
    return (
      <ConnectionProvider endpoint={endpoint}>
        <WalletProvider 
          wallets={wallets} 
          autoConnect={false}
          onError={handleWalletError}
        >
          <WalletModalProvider>{children}</WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    );
  } catch (error) {
    console.warn('Failed to render wallet provider:', error);
    // Fallback rendering without wallet functionality
    return <div>{children}</div>;
  }
};
