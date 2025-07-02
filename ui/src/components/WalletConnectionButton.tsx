"use client";

import { FC, useState } from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWalletConnection } from '@/hooks/useWalletConnection';

interface WalletConnectionButtonProps {
  className?: string;
  showBalance?: boolean;
}

export const WalletConnectionButton: FC<WalletConnectionButtonProps> = ({ 
  className = '',
  showBalance = false 
}) => {
  const {
    connected,
    connecting,
    disconnecting,
    connectionError,
    isReconnecting,
    connect,
    disconnect,
    clearError,
    shouldShowRetry,
  } = useWalletConnection();

  const [showError, setShowError] = useState(false);

  const handleRetry = () => {
    clearError();
    connect();
  };

  const handleErrorToggle = () => {
    setShowError(!showError);
  };

  const getButtonText = () => {
    if (connecting) return 'Connecting...';
    if (disconnecting) return 'Disconnecting...';
    if (isReconnecting) return 'Reconnecting...';
    if (connected) return 'Connected';
    return 'Connect Wallet';
  };

  const getButtonStatus = () => {
    if (connectionError) return 'error';
    if (connecting || disconnecting || isReconnecting) return 'loading';
    if (connected) return 'connected';
    return 'disconnected';
  };

  const buttonStatus = getButtonStatus();

  return (
    <div className="relative">
      {/* Main wallet button */}
      <WalletMultiButton 
        className={`
          wallet-connection-button
          ${className}
          ${buttonStatus === 'error' ? '!bg-red-600 hover:!bg-red-700' : ''}
          ${buttonStatus === 'loading' ? '!opacity-75 !cursor-not-allowed' : ''}
          ${buttonStatus === 'connected' ? '!bg-green-600 hover:!bg-green-700' : ''}
          !py-2 !px-4 !rounded !transition-all !duration-200 !font-medium
          ${connecting || disconnecting || isReconnecting ? '!pointer-events-none' : ''}
        `}
      />

      {/* Error indicator */}
      {connectionError && (
        <div className="absolute -top-2 -right-2">
          <button
            onClick={handleErrorToggle}
            className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white text-xs hover:bg-red-600 transition-colors"
            title="Connection Error - Click for details"
          >
            !
          </button>
        </div>
      )}

      {/* Error tooltip/popup */}
      {connectionError && showError && (
        <div className="absolute top-full mt-2 left-0 right-0 bg-red-600 text-white p-3 rounded-lg shadow-lg z-50 min-w-64">
          <div className="text-sm mb-2">{connectionError}</div>
          <div className="flex gap-2">
            {shouldShowRetry && (
              <button
                onClick={handleRetry}
                className="px-3 py-1 bg-red-700 hover:bg-red-800 rounded text-xs transition-colors"
              >
                Retry
              </button>
            )}
            <button
              onClick={() => setShowError(false)}
              className="px-3 py-1 bg-red-700 hover:bg-red-800 rounded text-xs transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {(connecting || disconnecting || isReconnecting) && (
        <div className="absolute inset-0 bg-black bg-opacity-20 rounded flex items-center justify-center">
          <svg
            className="animate-spin h-5 w-5 text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </div>
      )}
    </div>
  );
};

export default WalletConnectionButton;