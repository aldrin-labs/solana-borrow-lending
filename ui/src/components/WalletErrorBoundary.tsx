"use client";

import React from 'react';
import { WalletError, WalletErrorType, AppError } from '../utils/platformUtils';

interface WalletErrorBoundaryState {
  hasError: boolean;
  error?: WalletError;
}

interface WalletErrorBoundaryProps {
  children: React.ReactNode;
  onRetry?: () => void;
}

export class WalletErrorBoundary extends React.Component<WalletErrorBoundaryProps, WalletErrorBoundaryState> {
  constructor(props: WalletErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): WalletErrorBoundaryState {
    // Only catch wallet-related errors
    if (error instanceof WalletError) {
      return { hasError: true, error };
    }
    
    // Check for common wallet error patterns
    if (error.message?.includes('wallet') ||
        error.message?.includes('Cannot read properties of null') ||
        error.stack?.includes('wallet-adapter') ||
        error.message?.includes('phantom') ||
        error.message?.includes('solflare') ||
        error.message?.includes('metamask')) {
      const walletError = WalletError.fromError(error);
      return { hasError: true, error: walletError };
    }
    
    // If not wallet-related, don't catch it - let it bubble up
    throw error;
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.warn('WalletErrorBoundary caught a wallet error:', error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
    this.props.onRetry?.();
  };

  private getWalletErrorMessage(error: WalletError): { title: string; description: string; canRetry: boolean; action: string } {
    switch (error.type) {
      case WalletErrorType.USER_REJECTED:
        return {
          title: 'User Rejected',
          description: 'You rejected the wallet request. Please try again if you want to proceed.',
          canRetry: false,
          action: 'Try Again',
        };
      case WalletErrorType.CONNECTION_FAILED:
        return {
          title: 'Connection Failed',
          description: 'Failed to connect to your wallet. Please make sure your wallet is installed and unlocked.',
          canRetry: true,
          action: 'Retry Connection',
        };
      case WalletErrorType.INSUFFICIENT_FUNDS:
        return {
          title: 'Insufficient Funds',
          description: 'You don\'t have enough funds for this transaction. Please add more funds to your wallet.',
          canRetry: false,
          action: 'Add Funds',
        };
      case WalletErrorType.NETWORK_ERROR:
        return {
          title: 'Network Error',
          description: 'Network request failed. Please check your connection and try again.',
          canRetry: true,
          action: 'Retry',
        };
      case WalletErrorType.SIGN_TRANSACTION_FAILED:
        return {
          title: 'Transaction Signing Failed',
          description: 'Failed to sign the transaction. Please try again.',
          canRetry: true,
          action: 'Try Again',
        };
      case WalletErrorType.SEND_TRANSACTION_FAILED:
        return {
          title: 'Transaction Failed',
          description: 'Failed to send the transaction. Please try again.',
          canRetry: true,
          action: 'Retry Transaction',
        };
      default:
        return {
          title: 'Wallet Error',
          description: 'An unexpected wallet error occurred. Please try again.',
          canRetry: true,
          action: 'Try Again',
        };
    }
  }

  render() {
    if (this.state.hasError && this.state.error) {
      const { title, description, canRetry, action } = this.getWalletErrorMessage(this.state.error);

      return (
        <div className="flex items-center justify-center p-4">
          <div 
            className="p-6 rounded-lg border max-w-md w-full"
            style={{
              backgroundColor: 'var(--theme-surface)',
              borderColor: 'var(--theme-border)',
            }}
          >
            <div className="flex items-center mb-4">
              <svg 
                className="w-6 h-6 mr-3" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
                style={{ color: 'var(--theme-warning)' }}
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                />
              </svg>
              <h3 className="text-lg font-semibold" style={{ color: 'var(--theme-warning)' }}>
                {title}
              </h3>
            </div>
            
            <p className="text-sm mb-4" style={{ color: 'var(--theme-textSecondary)' }}>
              {description}
            </p>
            
            {this.state.error.message && this.state.error.message !== title && (
              <p className="text-xs mb-4 p-2 rounded bg-opacity-10 bg-gray-500 font-mono" 
                 style={{ color: 'var(--theme-textSecondary)' }}>
                {this.state.error.message}
              </p>
            )}
            
            {canRetry && (
              <button
                onClick={this.handleRetry}
                className="px-4 py-2 rounded-md text-sm font-medium transition-all duration-200"
                style={{
                  backgroundColor: 'var(--theme-primary)',
                  color: 'var(--theme-onPrimary)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(49, 130, 206, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {action}
              </button>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}