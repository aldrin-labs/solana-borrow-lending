/**
 * Advanced wallet adapter context with defensive patterns and error recovery
 * Provides safe wrappers for Solana wallet operations with comprehensive error handling
 */

import React, { createContext, useContext, useEffect, useCallback, useState, useRef } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { Connection, PublicKey, Transaction, SendOptions } from '@solana/web3.js';
import { WalletError, WalletErrorType } from '@/utils/platformUtils';
import { debugLog } from '@/utils/debug';

// Enhanced wallet state interface
export interface WalletState {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  isDisconnecting: boolean;
  
  // Wallet info
  publicKey: PublicKey | null;
  walletName: string | null;
  
  // Health and status
  isHealthy: boolean;
  lastHealthCheck: Date | null;
  connectionAttempts: number;
  
  // Error state
  lastError: WalletError | null;
  errorCount: number;
  
  // Recovery state
  isRecovering: boolean;
  recoveryAttempts: number;
  canRetry: boolean;
}

// Wallet operations interface
export interface WalletOperations {
  // Connection management
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  reconnect: () => Promise<void>;
  
  // Health monitoring
  checkHealth: () => Promise<boolean>;
  
  // Transaction operations
  signTransaction: (transaction: Transaction) => Promise<Transaction>;
  signAllTransactions: (transactions: Transaction[]) => Promise<Transaction[]>;
  sendTransaction: (transaction: Transaction, options?: SendOptions) => Promise<string>;
  
  // Error handling
  clearError: () => void;
  retryLastOperation: () => Promise<void>;
  
  // Recovery
  attemptRecovery: () => Promise<boolean>;
}

// Context interface
export interface WalletContextValue {
  state: WalletState;
  operations: WalletOperations;
  
  // Convenience computed values
  isReady: boolean;
  canConnect: boolean;
  canDisconnect: boolean;
  shouldShowError: boolean;
  
  // Configuration
  config: WalletConfig;
}

// Configuration interface
export interface WalletConfig {
  // Connection settings
  autoConnect: boolean;
  reconnectOnError: boolean;
  
  // Health monitoring
  healthCheckInterval: number;
  healthCheckTimeout: number;
  
  // Error handling
  maxRetries: number;
  retryDelay: number;
  errorDisplayDuration: number;
  
  // Recovery settings
  maxRecoveryAttempts: number;
  recoveryDelay: number;
  
  // Debug settings
  debug: boolean;
}

// Default configuration
const defaultConfig: WalletConfig = {
  autoConnect: false,
  reconnectOnError: true,
  healthCheckInterval: 60000, // 1 minute
  healthCheckTimeout: 5000,   // 5 seconds
  maxRetries: 3,
  retryDelay: 1000,
  errorDisplayDuration: 5000,
  maxRecoveryAttempts: 2,
  recoveryDelay: 2000,
  debug: false,
};

// Create context
const WalletContext = createContext<WalletContextValue | null>(null);

// Hook to use wallet context
export const useWalletContext = (): WalletContextValue => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWalletContext must be used within a WalletContextProvider');
  }
  return context;
};

// Enhanced wallet provider component
export const WalletContextProvider: React.FC<{
  children: React.ReactNode;
  config?: Partial<WalletConfig>;
}> = ({ children, config: userConfig = {} }) => {
  const config = { ...defaultConfig, ...userConfig };
  
  // Base wallet adapter hooks
  const { 
    wallet, 
    publicKey, 
    connected, 
    connecting, 
    disconnecting,
    connect: walletConnect,
    disconnect: walletDisconnect,
    sendTransaction: walletSendTransaction,
    signTransaction: walletSignTransaction,
    signAllTransactions: walletSignAllTransactions,
  } = useWallet();
  
  const { connection } = useConnection();
  
  // Internal state
  const [state, setState] = useState<WalletState>({
    isConnected: false,
    isConnecting: false,
    isDisconnecting: false,
    publicKey: null,
    walletName: null,
    isHealthy: true,
    lastHealthCheck: null,
    connectionAttempts: 0,
    lastError: null,
    errorCount: 0,
    isRecovering: false,
    recoveryAttempts: 0,
    canRetry: true,
  });
  
  // Refs for managing timers and operations
  const healthCheckTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastOperationRef = useRef<(() => Promise<any>) | null>(null);
  const mountedRef = useRef(true);
  
  // Update state when base wallet changes
  useEffect(() => {
    if (!mountedRef.current) return;
    
    setState(prev => ({
      ...prev,
      isConnected: connected,
      isConnecting: connecting,
      isDisconnecting: disconnecting,
      publicKey,
      walletName: wallet?.adapter.name || null,
    }));
  }, [connected, connecting, disconnecting, publicKey, wallet]);
  
  // Error handling utility
  const handleError = useCallback((error: any, operation: string) => {
    const walletError = WalletError.fromError(error);
    
    if (!mountedRef.current) return walletError;
    
    if (config.debug) {
      debugLog.error(`Wallet ${operation} error:`, walletError);
    }
    
    setState(prev => ({
      ...prev,
      lastError: walletError,
      errorCount: prev.errorCount + 1,
      isHealthy: false,
    }));
    
    // Auto-clear error after configured duration
    if (errorTimer.current) {
      clearTimeout(errorTimer.current);
    }
    
    errorTimer.current = setTimeout(() => {
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          lastError: null,
        }));
      }
    }, config.errorDisplayDuration);
    
    return walletError;
  }, [config.debug, config.errorDisplayDuration]);
  
  // Connection with retry logic
  const connect = useCallback(async () => {
    if (!mountedRef.current) return;
    
    setState(prev => ({
      ...prev,
      connectionAttempts: prev.connectionAttempts + 1,
      canRetry: true,
    }));
    
    lastOperationRef.current = connect;
    
    try {
      await walletConnect();
      
      setState(prev => ({
        ...prev,
        isHealthy: true,
        lastError: null,
      }));
    } catch (error) {
      const walletError = handleError(error, 'connect');
      
      if (walletError.isRecoverable() && state.connectionAttempts < config.maxRetries) {
        debugLog.info(`Retrying connection in ${config.retryDelay}ms...`);
        
        setTimeout(() => {
          if (mountedRef.current) {
            connect();
          }
        }, config.retryDelay);
      } else {
        setState(prev => ({
          ...prev,
          canRetry: false,
        }));
      }
    }
  }, [walletConnect, handleError, state.connectionAttempts, config.maxRetries, config.retryDelay]);
  
  // Disconnect with cleanup
  const disconnect = useCallback(async () => {
    if (!mountedRef.current) return;
    
    lastOperationRef.current = disconnect;
    
    try {
      await walletDisconnect();
      
      setState(prev => ({
        ...prev,
        lastError: null,
        connectionAttempts: 0,
        errorCount: 0,
        canRetry: true,
      }));
    } catch (error) {
      handleError(error, 'disconnect');
    }
  }, [walletDisconnect, handleError]);
  
  // Reconnect utility
  const reconnect = useCallback(async () => {
    if (!mountedRef.current) return;
    
    setState(prev => ({
      ...prev,
      isRecovering: true,
    }));
    
    try {
      await disconnect();
      await new Promise(resolve => setTimeout(resolve, 1000));
      await connect();
    } finally {
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          isRecovering: false,
        }));
      }
    }
  }, [connect, disconnect]);
  
  // Health check implementation
  const checkHealth = useCallback(async (): Promise<boolean> => {
    if (!connection || !publicKey) return false;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.healthCheckTimeout);
      
      await connection.getBalance(publicKey, {
        signal: controller.signal,
      } as any);
      
      clearTimeout(timeoutId);
      
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          isHealthy: true,
          lastHealthCheck: new Date(),
        }));
      }
      
      return true;
    } catch (error) {
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          isHealthy: false,
          lastHealthCheck: new Date(),
        }));
      }
      
      return false;
    }
  }, [connection, publicKey, config.healthCheckTimeout]);
  
  // Enhanced transaction signing
  const signTransaction = useCallback(async (transaction: Transaction): Promise<Transaction> => {
    if (!walletSignTransaction) {
      throw new WalletError(WalletErrorType.SIGN_TRANSACTION_FAILED, 'Wallet does not support transaction signing');
    }
    
    lastOperationRef.current = () => signTransaction(transaction);
    
    try {
      return await walletSignTransaction(transaction);
    } catch (error) {
      throw handleError(error, 'signTransaction');
    }
  }, [walletSignTransaction, handleError]);
  
  // Enhanced multiple transaction signing
  const signAllTransactions = useCallback(async (transactions: Transaction[]): Promise<Transaction[]> => {
    if (!walletSignAllTransactions) {
      throw new WalletError(WalletErrorType.SIGN_TRANSACTION_FAILED, 'Wallet does not support multiple transaction signing');
    }
    
    lastOperationRef.current = () => signAllTransactions(transactions);
    
    try {
      return await walletSignAllTransactions(transactions);
    } catch (error) {
      throw handleError(error, 'signAllTransactions');
    }
  }, [walletSignAllTransactions, handleError]);
  
  // Enhanced transaction sending
  const sendTransaction = useCallback(async (transaction: Transaction, options?: SendOptions): Promise<string> => {
    if (!walletSendTransaction) {
      throw new WalletError(WalletErrorType.SEND_TRANSACTION_FAILED, 'Wallet does not support transaction sending');
    }
    
    lastOperationRef.current = () => sendTransaction(transaction, options);
    
    try {
      return await walletSendTransaction(transaction, connection, options);
    } catch (error) {
      throw handleError(error, 'sendTransaction');
    }
  }, [walletSendTransaction, connection, handleError]);
  
  // Clear error state
  const clearError = useCallback(() => {
    if (errorTimer.current) {
      clearTimeout(errorTimer.current);
    }
    
    setState(prev => ({
      ...prev,
      lastError: null,
    }));
  }, []);
  
  // Retry last operation
  const retryLastOperation = useCallback(async () => {
    if (!lastOperationRef.current) return;
    
    try {
      await lastOperationRef.current();
    } catch (error) {
      // Error is already handled by the individual operation
      debugLog.warn('Retry operation failed:', error);
    }
  }, []);
  
  // Recovery mechanism
  const attemptRecovery = useCallback(async (): Promise<boolean> => {
    if (!mountedRef.current) return false;
    
    setState(prev => ({
      ...prev,
      isRecovering: true,
      recoveryAttempts: prev.recoveryAttempts + 1,
    }));
    
    try {
      // Step 1: Check if we can reconnect
      if (config.reconnectOnError && state.canRetry) {
        await reconnect();
        return true;
      }
      
      // Step 2: Clear error state and retry last operation
      clearError();
      if (lastOperationRef.current) {
        await lastOperationRef.current();
        return true;
      }
      
      return false;
    } catch (error) {
      debugLog.error('Recovery failed:', error);
      return false;
    } finally {
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          isRecovering: false,
        }));
      }
    }
  }, [config.reconnectOnError, state.canRetry, reconnect, clearError]);
  
  // Periodic health checks
  useEffect(() => {
    if (!connected || !config.healthCheckInterval) return;
    
    const startHealthChecks = () => {
      if (healthCheckTimer.current) {
        clearInterval(healthCheckTimer.current);
      }
      
      healthCheckTimer.current = setInterval(() => {
        if (mountedRef.current) {
          checkHealth().catch(error => {
            debugLog.warn('Health check failed:', error);
          });
        }
      }, config.healthCheckInterval);
    };
    
    startHealthChecks();
    
    return () => {
      if (healthCheckTimer.current) {
        clearInterval(healthCheckTimer.current);
      }
    };
  }, [connected, config.healthCheckInterval, checkHealth]);
  
  // Auto-connect on mount
  useEffect(() => {
    if (config.autoConnect && !connected && !connecting && wallet) {
      connect().catch(error => {
        debugLog.warn('Auto-connect failed:', error);
      });
    }
  }, [config.autoConnect, connected, connecting, wallet, connect]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      
      if (healthCheckTimer.current) {
        clearInterval(healthCheckTimer.current);
      }
      
      if (errorTimer.current) {
        clearTimeout(errorTimer.current);
      }
    };
  }, []);
  
  // Computed values
  const isReady = connected && state.isHealthy && !state.isRecovering;
  const canConnect = !connected && !connecting && !state.isRecovering;
  const canDisconnect = connected && !disconnecting && !state.isRecovering;
  const shouldShowError = !!state.lastError && !state.isRecovering;
  
  // Context value
  const contextValue: WalletContextValue = {
    state,
    operations: {
      connect,
      disconnect,
      reconnect,
      checkHealth,
      signTransaction,
      signAllTransactions,
      sendTransaction,
      clearError,
      retryLastOperation,
      attemptRecovery,
    },
    isReady,
    canConnect,
    canDisconnect,
    shouldShowError,
    config,
  };
  
  return (
    <WalletContext.Provider value={contextValue}>
      {children}
    </WalletContext.Provider>
  );
};

// Convenience hooks for specific wallet operations
export const useWalletConnection = () => {
  const { state, operations, canConnect, canDisconnect } = useWalletContext();
  
  return {
    isConnected: state.isConnected,
    isConnecting: state.isConnecting,
    isDisconnecting: state.isDisconnecting,
    canConnect,
    canDisconnect,
    connect: operations.connect,
    disconnect: operations.disconnect,
    reconnect: operations.reconnect,
  };
};

export const useWalletTransactions = () => {
  const { operations, isReady } = useWalletContext();
  
  return {
    isReady,
    signTransaction: operations.signTransaction,
    signAllTransactions: operations.signAllTransactions,
    sendTransaction: operations.sendTransaction,
  };
};

export const useWalletHealth = () => {
  const { state, operations } = useWalletContext();
  
  return {
    isHealthy: state.isHealthy,
    lastHealthCheck: state.lastHealthCheck,
    checkHealth: operations.checkHealth,
  };
};

export const useWalletError = () => {
  const { state, operations, shouldShowError } = useWalletContext();
  
  return {
    error: state.lastError,
    errorCount: state.errorCount,
    shouldShowError,
    canRetry: state.canRetry,
    isRecovering: state.isRecovering,
    clearError: operations.clearError,
    retryLastOperation: operations.retryLastOperation,
    attemptRecovery: operations.attemptRecovery,
  };
};