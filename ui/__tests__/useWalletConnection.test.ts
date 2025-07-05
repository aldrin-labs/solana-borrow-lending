/**
 * @jest-environment jsdom
 */

import { renderHook, act } from '@testing-library/react';
import { useWalletConnection } from '../src/hooks/useWalletConnection';

// Mock the wallet adapter hooks
jest.mock('@solana/wallet-adapter-react', () => ({
  useWallet: jest.fn(),
  useConnection: jest.fn(),
}));

describe('useWalletConnection', () => {
  const mockConnect = jest.fn();
  const mockDisconnect = jest.fn();
  const mockSelect = jest.fn();
  const mockUseWallet = require('@solana/wallet-adapter-react').useWallet;
  const mockUseConnection = require('@solana/wallet-adapter-react').useConnection;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseWallet.mockReturnValue({
      wallet: null,
      connected: false,
      connecting: false,
      disconnecting: false,
      connect: mockConnect,
      disconnect: mockDisconnect,
      select: mockSelect,
    });
    mockUseConnection.mockReturnValue({
      connection: {
        getLatestBlockhash: jest.fn().mockResolvedValue({ blockhash: 'test' }),
      },
    });
    
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
      },
      writable: true,
    });
  });

  it('should initialize with correct default state', () => {
    const { result } = renderHook(() => useWalletConnection());

    expect(result.current.connected).toBe(false);
    expect(result.current.connecting).toBe(false);
    expect(result.current.disconnecting).toBe(false);
    expect(result.current.connectionError).toBe(null);
    expect(result.current.isReconnecting).toBe(false);
  });

  it('should handle connection success', async () => {
    mockConnect.mockResolvedValue(undefined);
    
    const { result } = renderHook(() => useWalletConnection());

    await act(async () => {
      await result.current.connect();
    });

    expect(mockConnect).toHaveBeenCalled();
  });

  it('should handle connection errors', async () => {
    const error = new Error('Connection failed');
    mockConnect.mockRejectedValue(error);
    
    const { result } = renderHook(() => useWalletConnection());

    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.connectionError).toBeTruthy();
  });

  it('should handle disconnect', async () => {
    mockDisconnect.mockResolvedValue(undefined);
    
    const { result } = renderHook(() => useWalletConnection());

    await act(async () => {
      await result.current.disconnect();
    });

    expect(mockDisconnect).toHaveBeenCalled();
  });

  it('should clear errors when clearing', () => {
    const { result } = renderHook(() => useWalletConnection());

    act(() => {
      result.current.clearError();
    });

    expect(result.current.connectionError).toBe(null);
  });

  it('should check connection health', async () => {
    mockUseWallet.mockReturnValue({
      wallet: null,
      connected: true,
      connecting: false,
      disconnecting: false,
      connect: mockConnect,
      disconnect: mockDisconnect,
      select: mockSelect,
    });

    const { result } = renderHook(() => useWalletConnection());

    const isHealthy = await result.current.checkConnection();
    expect(isHealthy).toBe(true);
  });
});