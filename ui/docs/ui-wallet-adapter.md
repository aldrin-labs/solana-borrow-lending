# UI Wallet Adapter Guide

## Overview

The Solana Borrow-Lending Protocol UI uses advanced wallet adapter integration to provide a reliable and user-friendly wallet connection experience. This guide covers the implementation, usage, and troubleshooting of wallet adapters in the UI.

## Architecture

### Core Components

1. **WalletProviderWrapper** (`src/components/WalletProviderWrapper.tsx`)
   - Wraps the entire application with wallet context
   - Configures available wallet adapters
   - Handles provider-level error handling

2. **useWalletConnection Hook** (`src/hooks/useWalletConnection.ts`)
   - Enhanced wallet connection management
   - Automatic reconnection logic
   - Comprehensive error handling and retry mechanisms

3. **WalletConnectionButton** (`src/components/WalletConnectionButton.tsx`)
   - Enhanced wallet connection UI component
   - Visual error indicators and loading states
   - User-friendly error messages

## Supported Wallets

The current implementation supports the following wallet providers:

- **Phantom Wallet** - Most popular Solana wallet
- **Solflare Wallet** - Multi-platform Solana wallet
- **Torus Wallet** - Social login wallet integration

> **Note**: Backpack and Sollet wallet adapters are not available in the current version of `@solana/wallet-adapter-wallets` but will be added when they become available.

## Features

### Enhanced Connection Management

- **Auto-reconnect**: Automatically reconnects to the last used wallet on page reload
- **Retry Logic**: Attempts up to 3 reconnection attempts with exponential backoff
- **Connection Health Checks**: Monitors connection status and validates connectivity
- **Error Recovery**: Graceful handling of connection failures with user feedback

### Error Handling

The system provides comprehensive error handling for various wallet connection scenarios:

- `WalletNotFoundError` - Wallet extension not installed
- `WalletConnectionError` - General connection failures
- `WalletDisconnectedError` - Unexpected disconnections
- `WalletTimeoutError` - Connection timeouts
- `WalletNotReadyError` - Wallet not ready state

### State Management

The `useWalletConnection` hook provides the following state:

```typescript
{
  // Wallet state
  wallet: Wallet | null;
  connected: boolean;
  connecting: boolean;
  disconnecting: boolean;
  
  // Enhanced state
  connectionError: string | null;
  isReconnecting: boolean;
  connectionAttempts: number;
  lastConnectedWallet: string | null;
  
  // Actions
  connect: (walletName?: WalletName) => Promise<void>;
  disconnect: () => Promise<void>;
  select: (walletName: WalletName) => void;
  
  // Utilities
  checkConnection: () => Promise<boolean>;
  clearError: () => void;
  canRetry: boolean;
  shouldShowRetry: boolean;
}
```

## Usage

### Basic Implementation

```tsx
import { useWalletConnection } from '@/hooks/useWalletConnection';

export const MyComponent = () => {
  const { connected, connect, disconnect, connectionError } = useWalletConnection();

  if (!connected) {
    return (
      <button onClick={() => connect()}>
        Connect Wallet
      </button>
    );
  }

  return (
    <div>
      <p>Wallet connected!</p>
      <button onClick={() => disconnect()}>
        Disconnect
      </button>
    </div>
  );
};
```

### Using the Enhanced Button Component

```tsx
import { WalletConnectionButton } from '@/components/WalletConnectionButton';

export const Header = () => {
  return (
    <header>
      <WalletConnectionButton className="btn-connect" />
    </header>
  );
};
```

### Error Handling Example

```tsx
import { useWalletConnection } from '@/hooks/useWalletConnection';

export const WalletStatus = () => {
  const { 
    connected, 
    connecting, 
    connectionError, 
    shouldShowRetry, 
    connect,
    clearError 
  } = useWalletConnection();

  if (connectionError) {
    return (
      <div className="error-container">
        <p>{connectionError}</p>
        {shouldShowRetry && (
          <button onClick={() => connect()}>
            Retry Connection
          </button>
        )}
        <button onClick={clearError}>
          Dismiss
        </button>
      </div>
    );
  }

  return <div>Status: {connected ? 'Connected' : 'Disconnected'}</div>;
};
```

## Configuration

### Network Configuration

The wallet provider is configured for Devnet by default. To change the network:

```tsx
// In WalletProviderWrapper.tsx
const network = WalletAdapterNetwork.Mainnet; // or Testnet
```

### Custom RPC Endpoint

To use a custom RPC endpoint:

```tsx
// In WalletProviderWrapper.tsx
const endpoint = useMemo(() => "https://your-custom-rpc-endpoint.com", []);
```

### Adding New Wallet Adapters

To add new wallet adapters when they become available:

```tsx
// In WalletProviderWrapper.tsx
const wallets = useMemo(
  () => [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
    new TorusWalletAdapter(),
    new YourNewWalletAdapter(), // Add here
  ],
  [],
);
```

## Troubleshooting

### Common Issues

1. **Peer Dependency Conflicts**
   - Issue: React 19.0.0 causes peer dependency warnings
   - Solution: Install with `npm install --legacy-peer-deps`

2. **Wallet Not Found Error**
   - Issue: User doesn't have wallet extension installed
   - Solution: The UI shows helpful error message with installation guidance

3. **Connection Timeouts**
   - Issue: Wallet connection times out
   - Solution: Automatic retry logic handles this with user feedback

4. **Stale Connection State**
   - Issue: UI shows connected but wallet is actually disconnected
   - Solution: Connection health checks detect and handle this scenario

### Debugging

To enable detailed logging:

```tsx
// Add to your component
useEffect(() => {
  const { connected, wallet, connectionError } = useWalletConnection();
  console.log('Wallet State:', { connected, wallet: wallet?.adapter.name, connectionError });
}, [connected, wallet, connectionError]);
```

### Manual Testing Scenarios

1. **Basic Connection Flow**
   - Click "Connect Wallet"
   - Select wallet from modal
   - Verify successful connection

2. **Error Handling**
   - Try connecting without wallet extension installed
   - Verify error message appears
   - Test retry functionality

3. **Reconnection**
   - Connect wallet
   - Refresh page
   - Verify automatic reconnection

4. **Disconnect Flow**
   - Connect wallet
   - Click disconnect
   - Verify clean disconnection

## Best Practices

1. **Always handle connection errors gracefully**
2. **Provide clear user feedback during connection states**
3. **Use the enhanced hook instead of raw wallet adapter hooks**
4. **Test with multiple wallet providers**
5. **Monitor connection health for long-running sessions**

## Future Improvements

- Add support for hardware wallets (Ledger)
- Implement wallet-specific connection optimizations
- Add analytics for connection success rates
- Support for mobile wallet adapters
- Enhanced error reporting and user guidance

## Dependencies

- `@solana/wallet-adapter-react`: ^0.15.39
- `@solana/wallet-adapter-react-ui`: ^0.9.39
- `@solana/wallet-adapter-wallets`: ^0.19.37
- `@solana/wallet-adapter-base`: ^0.9.27
- `@solana/web3.js`: ^1.98.2

## Related Files

- `src/components/WalletProviderWrapper.tsx` - Main provider configuration
- `src/hooks/useWalletConnection.ts` - Enhanced connection hook
- `src/components/WalletConnectionButton.tsx` - UI component
- `src/components/Header.tsx` - Header with wallet button
- `src/styles/wallet-adapter.css` - Wallet adapter styles