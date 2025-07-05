import { useState, useEffect, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletError, WalletName } from '@solana/wallet-adapter-base';

interface WalletConnectionState {
  isConnecting: boolean;
  isDisconnecting: boolean;
  connectionError: string | null;
  lastConnectedWallet: string | null;
  connectionAttempts: number;
  isReconnecting: boolean;
}

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000;

export const useWalletConnection = () => {
  const { wallet, connected, connecting, disconnecting, connect, disconnect, select } = useWallet();
  const { connection } = useConnection();
  
  const [state, setState] = useState<WalletConnectionState>({
    isConnecting: false,
    isDisconnecting: false,
    connectionError: null,
    lastConnectedWallet: null,
    connectionAttempts: 0,
    isReconnecting: false,
  });

  // Clear error when wallet changes or connection succeeds
  useEffect(() => {
    if (connected) {
      setState(prev => ({
        ...prev,
        connectionError: null,
        connectionAttempts: 0,
        isConnecting: false,
        isReconnecting: false,
        lastConnectedWallet: wallet?.adapter.name || null,
      }));
    }
  }, [connected, wallet]);

  // Handle connection errors
  const handleConnectionError = useCallback((error: Error) => {
    console.error('Wallet connection error:', error);
    
    let errorMessage = 'Failed to connect to wallet';
    
    if (error instanceof WalletError) {
      switch (error.name) {
        case 'WalletNotFoundError':
          errorMessage = 'Wallet not found. Please install the wallet extension.';
          break;
        case 'WalletConnectionError':
          errorMessage = 'Failed to connect to wallet. Please try again.';
          break;
        case 'WalletDisconnectedError':
          errorMessage = 'Wallet was disconnected. Please reconnect.';
          break;
        case 'WalletTimeoutError':
          errorMessage = 'Connection timed out. Please try again.';
          break;
        case 'WalletNotReadyError':
          errorMessage = 'Wallet is not ready. Please refresh and try again.';
          break;
        default:
          errorMessage = error.message || 'Unknown wallet error occurred';
      }
    }

    setState(prev => ({
      ...prev,
      connectionError: errorMessage,
      isConnecting: false,
      isReconnecting: false,
    }));
  }, []);

  // Enhanced connect function with retry logic
  const connectWithRetry = useCallback(async (walletName?: WalletName) => {
    if (state.isConnecting || connecting) return;

    setState(prev => ({ 
      ...prev, 
      isConnecting: true, 
      connectionError: null,
      connectionAttempts: prev.connectionAttempts + 1,
    }));

    try {
      if (walletName && wallet?.adapter.name !== walletName) {
        // Find and select the requested wallet
        select(walletName);
        // Wait a bit for wallet selection to take effect
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      await connect();
    } catch (error) {
      const currentAttempts = state.connectionAttempts + 1;
      
      if (currentAttempts < MAX_RETRY_ATTEMPTS) {
        // Retry connection after delay
        setTimeout(() => {
          setState(prev => ({ ...prev, isReconnecting: true }));
          connectWithRetry(walletName);
        }, RETRY_DELAY_MS);
      } else {
        handleConnectionError(error as Error);
      }
    }
  }, [connect, select, wallet, state.isConnecting, state.connectionAttempts, connecting, handleConnectionError]);

  // Enhanced disconnect function
  const disconnectWallet = useCallback(async () => {
    if (state.isDisconnecting || disconnecting) return;

    setState(prev => ({ 
      ...prev, 
      isDisconnecting: true, 
      connectionError: null 
    }));

    try {
      await disconnect();
      setState(prev => ({
        ...prev,
        isDisconnecting: false,
        lastConnectedWallet: null,
        connectionAttempts: 0,
      }));
    } catch (error) {
      console.error('Wallet disconnect error:', error);
      setState(prev => ({ 
        ...prev, 
        isDisconnecting: false,
        connectionError: 'Failed to disconnect wallet'
      }));
    }
  }, [disconnect, state.isDisconnecting, disconnecting]);

  // Auto-reconnect to last connected wallet on page reload
  useEffect(() => {
    const lastWallet = localStorage.getItem('lastConnectedWallet');
    if (lastWallet && !connected && !connecting && !state.isConnecting) {
      setState(prev => ({ ...prev, isReconnecting: true }));
      connectWithRetry(lastWallet as WalletName);
    }
  }, [connected, connecting, state.isConnecting, connectWithRetry]);

  // Store last connected wallet in localStorage
  useEffect(() => {
    if (connected && wallet?.adapter.name) {
      localStorage.setItem('lastConnectedWallet', wallet.adapter.name);
    } else if (!connected) {
      localStorage.removeItem('lastConnectedWallet');
    }
  }, [connected, wallet]);

  // Clear error after a timeout
  useEffect(() => {
    if (state.connectionError) {
      const timer = setTimeout(() => {
        setState(prev => ({ ...prev, connectionError: null }));
      }, 10000); // Clear error after 10 seconds

      return () => clearTimeout(timer);
    }
  }, [state.connectionError]);

  // Check connection health
  const checkConnection = useCallback(async () => {
    if (!connected || !connection) return false;
    
    try {
      // Simple connection health check
      await connection.getLatestBlockhash();
      return true;
    } catch (error) {
      console.error('Connection health check failed:', error);
      return false;
    }
  }, [connected, connection]);

  return {
    // Wallet state
    wallet,
    connected,
    connecting: connecting || state.isConnecting,
    disconnecting: disconnecting || state.isDisconnecting,
    
    // Enhanced state
    connectionError: state.connectionError,
    isReconnecting: state.isReconnecting,
    connectionAttempts: state.connectionAttempts,
    lastConnectedWallet: state.lastConnectedWallet,
    
    // Actions
    connect: connectWithRetry,
    disconnect: disconnectWallet,
    select,
    
    // Utilities
    checkConnection,
    clearError: () => setState(prev => ({ ...prev, connectionError: null })),
    
    // Connection state helpers
    canRetry: state.connectionAttempts < MAX_RETRY_ATTEMPTS,
    shouldShowRetry: state.connectionError && state.connectionAttempts < MAX_RETRY_ATTEMPTS,
  };
};