"use client";

import React from 'react';

interface WalletErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface WalletErrorBoundaryProps {
  children: React.ReactNode;
}

export class WalletErrorBoundary extends React.Component<WalletErrorBoundaryProps, WalletErrorBoundaryState> {
  constructor(props: WalletErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): WalletErrorBoundaryState {
    // Check if this is a wallet-related error
    if (error.message?.includes('wallet') ||
        error.message?.includes('Cannot read properties of null') ||
        error.stack?.includes('wallet-adapter')) {
      return { hasError: true, error };
    }
    
    // If not wallet-related, don't catch it
    throw error;
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.warn('WalletErrorBoundary caught a wallet error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center p-4">
          <div 
            className="p-4 rounded-lg border"
            style={{
              backgroundColor: 'var(--theme-surface)',
              borderColor: 'var(--theme-border)',
            }}
          >
            <p className="text-sm" style={{ color: 'var(--theme-textSecondary)' }}>
              Wallet connection unavailable
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: undefined })}
              className="mt-2 px-3 py-1 rounded text-xs"
              style={{
                backgroundColor: 'var(--theme-primary)',
                color: 'var(--theme-onPrimary)',
              }}
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}