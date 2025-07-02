"use client";

import { FC, ReactNode, useMemo, useCallback } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletAdapterNetwork, WalletError } from "@solana/wallet-adapter-base";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  TorusWalletAdapter,
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
  // The network can be set to 'devnet', 'testnet', or 'mainnet-beta'
  const network = WalletAdapterNetwork.Devnet;

  // You can also provide a custom RPC endpoint
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);

  // Enhanced wallet adapters with available providers
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new TorusWalletAdapter(),
      // Note: BackpackWalletAdapter and SolletWalletAdapter are not available in current version
      // They will be added when available in future updates
    ],
    [],
  );

  // Enhanced error handling
  const onError = useCallback((error: WalletError) => {
    console.error('Wallet Provider Error:', error);
    
    // Create user-friendly error messages
    let userMessage = 'Wallet error occurred';
    
    switch (error.name) {
      case 'WalletNotFoundError':
        userMessage = 'Wallet not found. Please install the wallet extension.';
        break;
      case 'WalletConnectionError':
        userMessage = 'Failed to connect to wallet. Please try again.';
        break;
      case 'WalletDisconnectedError':
        userMessage = 'Wallet was disconnected.';
        break;
      case 'WalletTimeoutError':
        userMessage = 'Connection timed out. Please try again.';
        break;
      case 'WalletNotReadyError':
        userMessage = 'Wallet is not ready. Please refresh the page.';
        break;
      default:
        userMessage = error.message || 'Unknown wallet error occurred';
    }

    // Show error notification (you can replace this with your preferred notification system)
    if (typeof window !== 'undefined' && window.console) {
      console.warn('Wallet Error:', userMessage);
    }
  }, []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider 
        wallets={wallets} 
        autoConnect={true}
        onError={onError}
      >
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
