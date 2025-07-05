/**
 * Tests for Error Boundary components
 * Ensures wallet and general errors are handled separately
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { WalletErrorBoundary } from '../components/WalletErrorBoundary';
import { WalletError, WalletErrorType, AppError, AppErrorType } from '../utils/platformUtils';

// Test component that throws errors
const ErrorThrowingComponent: React.FC<{ error?: Error }> = ({ error }) => {
  if (error) {
    throw error;
  }
  return <div>Normal content</div>;
};

describe('Error Boundaries', () => {
  // Suppress console.error during tests
  const originalError = console.error;
  beforeAll(() => {
    console.error = jest.fn();
  });
  
  afterAll(() => {
    console.error = originalError;
  });

  describe('ErrorBoundary', () => {
    it('should render children when no error occurs', () => {
      render(
        <ErrorBoundary>
          <ErrorThrowingComponent />
        </ErrorBoundary>
      );
      
      expect(screen.getByText('Normal content')).toBeInTheDocument();
    });

    it('should catch and display general errors', () => {
      const generalError = new Error('General application error');
      
      render(
        <ErrorBoundary>
          <ErrorThrowingComponent error={generalError} />
        </ErrorBoundary>
      );
      
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
      expect(screen.getByText(/general application error/i)).toBeInTheDocument();
    });

    it('should handle AppError instances', () => {
      const appError = new AppError(
        AppErrorType.NETWORK_ERROR,
        'Failed to fetch data from server'
      );
      
      render(
        <ErrorBoundary>
          <ErrorThrowingComponent error={appError} />
        </ErrorBoundary>
      );
      
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
      expect(screen.getByText(/failed to fetch data/i)).toBeInTheDocument();
    });

    it('should not catch WalletError instances', () => {
      const walletError = new WalletError(
        WalletErrorType.CONNECTION_FAILED,
        'Wallet connection failed'
      );
      
      // WalletError should bubble up and not be caught by ErrorBoundary
      expect(() => {
        render(
          <ErrorBoundary>
            <ErrorThrowingComponent error={walletError} />
          </ErrorBoundary>
        );
      }).toThrow('Wallet connection failed');
    });

    it('should provide retry functionality', () => {
      const retryCallback = jest.fn();
      const generalError = new Error('Retryable error');
      
      render(
        <ErrorBoundary onRetry={retryCallback}>
          <ErrorThrowingComponent error={generalError} />
        </ErrorBoundary>
      );
      
      const retryButton = screen.getByText(/try again/i);
      expect(retryButton).toBeInTheDocument();
      
      retryButton.click();
      expect(retryCallback).toHaveBeenCalledTimes(1);
    });

    it('should handle different error types with appropriate messages', () => {
      const networkError = new AppError(
        AppErrorType.NETWORK_ERROR,
        'Network connection failed'
      );
      
      const { rerender } = render(
        <ErrorBoundary>
          <ErrorThrowingComponent error={networkError} />
        </ErrorBoundary>
      );
      
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
      expect(screen.getByText(/check your internet connection/i)).toBeInTheDocument();
      
      const validationError = new AppError(
        AppErrorType.VALIDATION_ERROR,
        'Invalid form data'
      );
      
      rerender(
        <ErrorBoundary>
          <ErrorThrowingComponent error={validationError} />
        </ErrorBoundary>
      );
      
      expect(screen.getByText(/validation error/i)).toBeInTheDocument();
    });
  });

  describe('WalletErrorBoundary', () => {
    it('should render children when no error occurs', () => {
      render(
        <WalletErrorBoundary>
          <ErrorThrowingComponent />
        </WalletErrorBoundary>
      );
      
      expect(screen.getByText('Normal content')).toBeInTheDocument();
    });

    it('should catch and display wallet errors', () => {
      const walletError = new WalletError(
        WalletErrorType.CONNECTION_FAILED,
        'Failed to connect to wallet'
      );
      
      render(
        <WalletErrorBoundary>
          <ErrorThrowingComponent error={walletError} />
        </WalletErrorBoundary>
      );
      
      expect(screen.getByText(/wallet error/i)).toBeInTheDocument();
      expect(screen.getByText(/failed to connect to wallet/i)).toBeInTheDocument();
    });

    it('should handle user rejection gracefully', () => {
      const userRejectionError = new WalletError(
        WalletErrorType.USER_REJECTED,
        'User rejected the request'
      );
      
      render(
        <WalletErrorBoundary>
          <ErrorThrowingComponent error={userRejectionError} />
        </WalletErrorBoundary>
      );
      
      expect(screen.getByText(/user rejected/i)).toBeInTheDocument();
      expect(screen.queryByText(/try again/i)).not.toBeInTheDocument(); // No retry for user rejection
    });

    it('should handle insufficient funds errors', () => {
      const insufficientFundsError = new WalletError(
        WalletErrorType.INSUFFICIENT_FUNDS,
        'Insufficient funds for transaction'
      );
      
      render(
        <WalletErrorBoundary>
          <ErrorThrowingComponent error={insufficientFundsError} />
        </WalletErrorBoundary>
      );
      
      expect(screen.getByText(/insufficient funds/i)).toBeInTheDocument();
      expect(screen.getByText(/please add more funds/i)).toBeInTheDocument();
    });

    it('should provide retry for recoverable errors', () => {
      const retryCallback = jest.fn();
      const networkError = new WalletError(
        WalletErrorType.NETWORK_ERROR,
        'Network request failed'
      );
      
      render(
        <WalletErrorBoundary onRetry={retryCallback}>
          <ErrorThrowingComponent error={networkError} />
        </WalletErrorBoundary>
      );
      
      const retryButton = screen.getByText(/try again/i);
      expect(retryButton).toBeInTheDocument();
      
      retryButton.click();
      expect(retryCallback).toHaveBeenCalledTimes(1);
    });

    it('should not provide retry for non-recoverable errors', () => {
      const userRejectionError = new WalletError(
        WalletErrorType.USER_REJECTED,
        'User rejected the request'
      );
      
      render(
        <WalletErrorBoundary>
          <ErrorThrowingComponent error={userRejectionError} />
        </WalletErrorBoundary>
      );
      
      expect(screen.queryByText(/try again/i)).not.toBeInTheDocument();
    });

    it('should not catch non-wallet errors', () => {
      const generalError = new Error('General application error');
      
      // General errors should bubble up and not be caught by WalletErrorBoundary
      expect(() => {
        render(
          <WalletErrorBoundary>
            <ErrorThrowingComponent error={generalError} />
          </WalletErrorBoundary>
        );
      }).toThrow('General application error');
    });

    it('should handle different wallet error types appropriately', () => {
      const connectionError = new WalletError(
        WalletErrorType.CONNECTION_FAILED,
        'Connection failed'
      );
      
      const { rerender } = render(
        <WalletErrorBoundary>
          <ErrorThrowingComponent error={connectionError} />
        </WalletErrorBoundary>
      );
      
      expect(screen.getByText(/connection failed/i)).toBeInTheDocument();
      expect(screen.getByText(/try again/i)).toBeInTheDocument();
      
      const signatureError = new WalletError(
        WalletErrorType.SIGN_TRANSACTION_FAILED,
        'Failed to sign transaction'
      );
      
      rerender(
        <WalletErrorBoundary>
          <ErrorThrowingComponent error={signatureError} />
        </WalletErrorBoundary>
      );
      
      expect(screen.getByText(/failed to sign transaction/i)).toBeInTheDocument();
    });
  });

  describe('Error boundary integration', () => {
    it('should work together to handle different error types', () => {
      // WalletErrorBoundary inside ErrorBoundary
      const walletError = new WalletError(
        WalletErrorType.CONNECTION_FAILED,
        'Wallet connection failed'
      );
      
      render(
        <ErrorBoundary>
          <WalletErrorBoundary>
            <ErrorThrowingComponent error={walletError} />
          </WalletErrorBoundary>
        </ErrorBoundary>
      );
      
      // Should be caught by WalletErrorBoundary
      expect(screen.getByText(/wallet error/i)).toBeInTheDocument();
      expect(screen.getByText(/wallet connection failed/i)).toBeInTheDocument();
    });

    it('should escalate uncaught errors to parent boundary', () => {
      const generalError = new Error('General error');
      
      render(
        <ErrorBoundary>
          <WalletErrorBoundary>
            <ErrorThrowingComponent error={generalError} />
          </WalletErrorBoundary>
        </ErrorBoundary>
      );
      
      // Should be caught by ErrorBoundary since WalletErrorBoundary doesn't handle it
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
      expect(screen.getByText(/general error/i)).toBeInTheDocument();
    });
  });
});