"use client";

import { FC, ReactNode, useMemo, useEffect, useState } from "react";
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

// Import the local wallet adapter CSS (modified to remove Google Fonts)
import "@/styles/wallet-adapter.css";

interface WalletProviderWrapperProps {
  children: ReactNode;
}

export const WalletProviderWrapper: FC<WalletProviderWrapperProps> = ({
  children,
}) => {
  const [isClient, setIsClient] = useState(false);
  
  // Ensure component only renders on client to avoid SSR issues
  useEffect(() => {
    setIsClient(true);
    
    // Add global error handler for wallet-related errors
    const handleWalletError = (event: ErrorEvent) => {
      if (event.error && 
          (event.error.message?.includes('Cannot read properties of null') ||
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

  // @solana/wallet-adapter-wallets includes all the adapters but supports tree shaking
  const wallets = useMemo(
    () => {
      if (!isClient) return [];
      
      try {
        // Add extra safety checks for wallet initialization
        const adapters = [];
        
        try {
          adapters.push(new PhantomWalletAdapter());
        } catch (error) {
          console.warn('Failed to initialize Phantom wallet adapter:', error);
        }
        
        try {
          adapters.push(new SolflareWalletAdapter());
        } catch (error) {
          console.warn('Failed to initialize Solflare wallet adapter:', error);
        }
        
        return adapters;
      } catch (error) {
        console.warn('Error initializing wallet adapters:', error);
        return [];
      }
    },
    [isClient],
  );

  // Don't render on server or before client hydration
  if (!isClient) {
    return <div>{children}</div>;
  }

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider 
        wallets={wallets} 
        autoConnect={false}
        onError={(error) => {
          console.warn('Wallet provider error:', error);
        }}
      >
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
