"use client";

import { FC, ReactNode, useMemo } from "react";
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
      try {
        return [
          new PhantomWalletAdapter(),
          new SolflareWalletAdapter(),
          // BackpackWalletAdapter is not available in the current version of the library
          // Will be added back when the library is updated
        ];
      } catch (error) {
        console.warn('Error initializing wallet adapters:', error);
        return [];
      }
    },
    [],
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={false}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
