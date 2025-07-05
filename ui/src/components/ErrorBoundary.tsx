"use client";

import React from 'react';
import { AppError, AppErrorType, WalletError } from '../utils/platformUtils';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; reset: () => void }>;
  onRetry?: () => void;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Don't catch wallet errors - let them bubble to WalletErrorBoundary
    if (error instanceof WalletError) {
      throw error;
    }
    
    return { hasError: true, error: AppError.fromError(error) };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Don't log wallet errors here
    if (error instanceof WalletError) {
      throw error;
    }
    
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
    this.props.onRetry?.();
  };

  private getErrorMessage(error: AppError): { title: string; description: string; canRetry: boolean } {
    switch (error.type) {
      case AppErrorType.NETWORK_ERROR:
        return {
          title: 'Network Error',
          description: 'Unable to connect to the network. Please check your internet connection and try again.',
          canRetry: true,
        };
      case AppErrorType.DATA_FETCH_ERROR:
        return {
          title: 'Data Loading Error',
          description: 'Failed to load data. Please try refreshing the page.',
          canRetry: true,
        };
      case AppErrorType.VALIDATION_ERROR:
        return {
          title: 'Validation Error',
          description: 'The provided data is invalid. Please check your input and try again.',
          canRetry: false,
        };
      case AppErrorType.COMPONENT_ERROR:
        return {
          title: 'Loading Error',
          description: 'Failed to load a component. Please refresh the page.',
          canRetry: true,
        };
      default:
        return {
          title: 'Something Went Wrong',
          description: 'An unexpected error occurred. Please try refreshing the page.',
          canRetry: true,
        };
    }
  }

  render() {
    if (this.state.hasError && this.state.error) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;
      
      return (
        <FallbackComponent 
          error={this.state.error} 
          reset={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error: Error;
  reset: () => void;
}

const DefaultErrorFallback: React.FC<ErrorFallbackProps> = ({ error, reset }) => {
  const appError = error instanceof AppError ? error : AppError.fromError(error);
  
  // Handle wallet errors differently
  if (appError instanceof WalletError) {
    return (
      <div className="min-h-[200px] flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <h3 className="text-lg font-semibold mb-2">Wallet Connection Error</h3>
          <p className="text-sm text-text-secondary mb-4">{appError.message}</p>
          {reset && (
            <button onClick={reset} className="btn-primary">
              Try Again
            </button>
          )}
        </div>
      </div>
    );
  }

  const { title, description, canRetry } = getErrorMessage(appError as AppError);

  return (
    <div className="min-h-[200px] flex items-center justify-center p-8">
      <div className="max-w-md w-full">
        <div 
          className="p-6 rounded-lg border"
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
              style={{ color: 'var(--theme-error)' }}
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" 
              />
            </svg>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--theme-error)' }}>
              {title}
            </h2>
          </div>
          
          <p className="text-sm mb-4" style={{ color: 'var(--theme-textSecondary)' }}>
            {description}
          </p>
          
          {error.message && error.message !== title && (
            <p className="text-xs mb-4 p-2 rounded bg-opacity-10 bg-gray-500 font-mono" 
               style={{ color: 'var(--theme-textSecondary)' }}>
              {error.message}
            </p>
          )}
          
          {canRetry && (
            <button
              onClick={reset}
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
              Try Again
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Helper function to get error message based on error type
function getErrorMessage(error: AppError): { title: string; description: string; canRetry: boolean } {
  switch (error.type) {
    case AppErrorType.NETWORK_ERROR:
      return {
        title: 'Network Error',
        description: 'Unable to connect to the network. Please check your internet connection and try again.',
        canRetry: true,
      };
    case AppErrorType.DATA_FETCH_ERROR:
      return {
        title: 'Data Loading Error',
        description: 'Failed to load data. Please try refreshing the page.',
        canRetry: true,
      };
    case AppErrorType.VALIDATION_ERROR:
      return {
        title: 'Validation Error',
        description: 'The provided data is invalid. Please check your input and try again.',
        canRetry: false,
      };
    case AppErrorType.COMPONENT_ERROR:
      return {
        title: 'Loading Error',
        description: 'Failed to load a component. Please refresh the page.',
        canRetry: true,
      };
    default:
      return {
        title: 'Something Went Wrong',
        description: 'An unexpected error occurred. Please try refreshing the page.',
        canRetry: true,
      };
  }
}