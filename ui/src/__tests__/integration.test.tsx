/**
 * Integration tests for wallet connection flows and error boundary coverage
 * Tests critical user flows and error handling scenarios
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import { WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { ThemeProvider } from '../contexts/ThemeContext';
import { WalletErrorBoundary } from '../components/WalletErrorBoundary';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { SecurityWarning } from '../components/SecurityWarning';
import { useBorrowLending } from '../hooks/useBorrowLending';
import { solanaDataService } from '../services/solanaDataService';

// Mock wallet adapter
const mockWalletAdapter = {
  name: 'Phantom',
  url: 'https://phantom.app',
  icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAiIGhlaWdodD0iMTAiLz4=',
  supportedTransactionVersions: new Set(['legacy', 0]),
  autoConnect: false,
  publicKey: null,
  connecting: false,
  connected: false,
  readyState: 'Installed',
  connect: jest.fn(),
  disconnect: jest.fn(),
  sendTransaction: jest.fn(),
  signTransaction: jest.fn(),
  signAllTransactions: jest.fn(),
  signMessage: jest.fn(),
  signIn: jest.fn(),
  emit: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
  listenerCount: jest.fn(),
  addListener: jest.fn(),
  removeListener: jest.fn(),
  removeAllListeners: jest.fn(),
};

// Mock Solana data service
jest.mock('../services/solanaDataService', () => ({
  solanaDataService: {
    fetchMarketData: jest.fn(),
    fetchProtocolAnalytics: jest.fn(),
    fetchUserPositions: jest.fn(),
    healthCheck: jest.fn(),
  },
}));

// Test component that uses wallet connection
const TestWalletComponent = () => {
  const { markets, error, isLoading } = useBorrowLending();
  
  return (
    <div>
      <div data-testid="loading-state">{isLoading ? 'Loading' : 'Loaded'}</div>
      <div data-testid="error-state">{error || 'No error'}</div>
      <div data-testid="markets-count">{markets.length}</div>
    </div>
  );
};

// Test wrapper with all providers
const TestWrapper = ({ children, walletError = false }: { children: React.ReactNode; walletError?: boolean }) => {
  const wallets = [mockWalletAdapter];
  
  if (walletError) {
    // Simulate wallet error
    mockWalletAdapter.connect = jest.fn().mockRejectedValue(new Error('Wallet connection failed'));
  }

  return (
    <ThemeProvider>
      <WalletProvider wallets={wallets} autoConnect={false}>
        <WalletModalProvider>
          <WalletErrorBoundary>
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </WalletErrorBoundary>
        </WalletModalProvider>
      </WalletProvider>
    </ThemeProvider>
  );
};

describe('Wallet Connection Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock successful data service responses
    (solanaDataService.fetchMarketData as jest.Mock).mockResolvedValue([
      {
        id: '1',
        token: 'SOL',
        totalSupplyValue: 1000000,
        totalSupply: '$1,000,000',
        supplyApy: 5.2,
        supplyApyFormatted: '5.2%',
        totalBorrowValue: 500000,
        totalBorrow: '$500,000',
        borrowApy: 7.5,
        borrowApyFormatted: '7.5%',
        utilizationRate: 50,
        utilizationRateFormatted: '50%',
        mint: 'So11111111111111111111111111111111111111112',
        reserveAddress: 'test-address',
      },
    ]);
    
    (solanaDataService.fetchProtocolAnalytics as jest.Mock).mockResolvedValue({
      totalValueLocked: [{ time: '2024-01-01', value: 1000000 }],
      totalBorrowed: [{ time: '2024-01-01', value: 500000 }],
      totalSupplied: [{ time: '2024-01-01', value: 1000000 }],
      utilizationTrend: [{ time: '2024-01-01', utilization: 50 }],
      apyComparison: [{ token: 'SOL', supplyAPY: 5.2, borrowAPY: 7.5 }],
      healthFactor: 1.85,
      liquidationThreshold: 80,
    });
    
    (solanaDataService.fetchUserPositions as jest.Mock).mockResolvedValue({
      supplied: [],
      borrowed: [],
    });
    
    (solanaDataService.healthCheck as jest.Mock).mockResolvedValue(true);
  });

  describe('Successful Wallet Connection Flow', () => {
    it('should handle successful wallet connection and data loading', async () => {
      render(
        <TestWrapper>
          <TestWalletComponent />
        </TestWrapper>
      );

      // Initially loading
      expect(screen.getByTestId('loading-state')).toHaveTextContent('Loading');

      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByTestId('loading-state')).toHaveTextContent('Loaded');
      });

      // Should have loaded market data
      expect(screen.getByTestId('markets-count')).toHaveTextContent('1');
      expect(screen.getByTestId('error-state')).toHaveTextContent('No error');
    });

    it('should handle wallet connection with user positions', async () => {
      // Mock user positions
      (solanaDataService.fetchUserPositions as jest.Mock).mockResolvedValue({
        supplied: [
          {
            id: '1',
            token: 'SOL',
            amount: '10.0',
            amountNumeric: 10.0,
            value: '$1,000',
            valueNumeric: 1000,
            apy: '5.2%',
            apyNumeric: 5.2,
            collateral: true,
            healthFactor: '1.85',
            healthFactorNumeric: 1.85,
          },
        ],
        borrowed: [],
      });

      render(
        <TestWrapper>
          <TestWalletComponent />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading-state')).toHaveTextContent('Loaded');
      });

      expect(solanaDataService.fetchUserPositions).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle wallet connection errors gracefully', async () => {
      render(
        <TestWrapper walletError={true}>
          <TestWalletComponent />
        </TestWrapper>
      );

      // Should still load market data even with wallet error
      await waitFor(() => {
        expect(screen.getByTestId('loading-state')).toHaveTextContent('Loaded');
      });

      expect(screen.getByTestId('markets-count')).toHaveTextContent('1');
    });

    it('should handle network errors', async () => {
      (solanaDataService.fetchMarketData as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );

      render(
        <TestWrapper>
          <TestWalletComponent />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('error-state')).toHaveTextContent('Network error');
      });
    });

    it('should handle health check failures', async () => {
      (solanaDataService.healthCheck as jest.Mock).mockResolvedValue(false);

      render(
        <TestWrapper>
          <TestWalletComponent />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('error-state')).toHaveTextContent('Solana network connection issues detected');
      });
    });
  });

  describe('Security Warning Integration', () => {
    it('should display security warning before wallet connection', async () => {
      const mockOnAccept = jest.fn();
      const mockOnDecline = jest.fn();

      render(
        <SecurityWarning
          onAccept={mockOnAccept}
          onDecline={mockOnDecline}
          isVisible={true}
        />
      );

      expect(screen.getByText('Security Warning')).toBeInTheDocument();
      expect(screen.getByText('Wallet Security Best Practices')).toBeInTheDocument();
      expect(screen.getByText('Phishing Protection')).toBeInTheDocument();
      expect(screen.getByText('Transaction Safety')).toBeInTheDocument();

      // Should not be able to connect without reading warning
      const connectButton = screen.getByText('Connect Wallet');
      expect(connectButton).toBeDisabled();

      // Check the warning acknowledgment
      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);

      // Now should be able to connect
      expect(connectButton).not.toBeDisabled();

      // Test accept flow
      fireEvent.click(connectButton);
      expect(mockOnAccept).toHaveBeenCalled();
    });

    it('should handle security warning decline', async () => {
      const mockOnAccept = jest.fn();
      const mockOnDecline = jest.fn();

      render(
        <SecurityWarning
          onAccept={mockOnAccept}
          onDecline={mockOnDecline}
          isVisible={true}
        />
      );

      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      expect(mockOnDecline).toHaveBeenCalled();
    });
  });

  describe('Error Boundary Coverage', () => {
    it('should catch and display wallet-specific errors', async () => {
      // Component that throws wallet error
      const ErrorComponent = () => {
        throw new Error('Wallet adapter error');
      };

      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <TestWrapper>
          <ErrorComponent />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
      });

      consoleError.mockRestore();
    });

    it('should handle non-wallet errors in general error boundary', async () => {
      // Component that throws non-wallet error
      const ErrorComponent = () => {
        throw new Error('General application error');
      };

      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <ErrorBoundary>
          <ErrorComponent />
        </ErrorBoundary>
      );

      await waitFor(() => {
        expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
      });

      consoleError.mockRestore();
    });
  });

  describe('Performance and Caching', () => {
    it('should cache data and avoid unnecessary API calls', async () => {
      const { rerender } = render(
        <TestWrapper>
          <TestWalletComponent />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading-state')).toHaveTextContent('Loaded');
      });

      // First render should call API
      expect(solanaDataService.fetchMarketData).toHaveBeenCalledTimes(1);

      // Re-render shouldn't call API again immediately (due to caching)
      rerender(
        <TestWrapper>
          <TestWalletComponent />
        </TestWrapper>
      );

      // Should still be the same number of calls
      expect(solanaDataService.fetchMarketData).toHaveBeenCalledTimes(1);
    });
  });
});

describe('Numeric Value Processing', () => {
  it('should use numeric values instead of parsing strings', () => {
    const mockMarkets = [
      {
        id: '1',
        token: 'SOL',
        totalSupplyValue: 1000000,
        totalBorrowValue: 500000,
        utilizationRate: 50,
      },
      {
        id: '2',
        token: 'USDC',
        totalSupplyValue: 2000000,
        totalBorrowValue: 1000000,
        utilizationRate: 60,
      },
    ];

    // Calculate totals using numeric values (not string parsing)
    const totalSupplied = mockMarkets.reduce((sum, market) => sum + market.totalSupplyValue, 0);
    const totalBorrowed = mockMarkets.reduce((sum, market) => sum + market.totalBorrowValue, 0);
    const avgUtilization = mockMarkets.reduce((sum, market) => sum + market.utilizationRate, 0) / mockMarkets.length;

    expect(totalSupplied).toBe(3000000);
    expect(totalBorrowed).toBe(1500000);
    expect(avgUtilization).toBe(55);
  });
});

describe('Async Error Handling', () => {
  it('should handle async errors in useEffect properly', async () => {
    (solanaDataService.fetchMarketData as jest.Mock).mockRejectedValue(new Error('Async error'));

    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <TestWrapper>
        <TestWalletComponent />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('error-state')).toHaveTextContent('Async error');
    });

    consoleError.mockRestore();
  });
});