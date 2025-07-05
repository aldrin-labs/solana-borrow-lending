/**
 * Security Warning Component for Wallet Connections
 * Provides phishing protection and security best practices
 */

import React, { useState } from 'react';

interface SecurityWarningProps {
  onAccept: () => void;
  onDecline: () => void;
  isVisible: boolean;
}

export const SecurityWarning: React.FC<SecurityWarningProps> = ({
  onAccept,
  onDecline,
  isVisible,
}) => {
  const [hasReadWarning, setHasReadWarning] = useState(false);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-surface border border-border rounded-lg p-6 max-w-md mx-4 shadow-lg">
        <div className="flex items-center mb-4">
          <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center mr-3">
            <svg className="w-5 h-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-primary">Security Warning</h3>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <h4 className="font-medium text-text mb-2">🔒 Wallet Security Best Practices</h4>
            <ul className="text-sm text-text-secondary space-y-1">
              <li>• Only connect wallets you trust and control</li>
              <li>• Never share your private keys or seed phrases</li>
              <li>• Verify you&apos;re on the correct website URL</li>
              <li>• Use hardware wallets for large amounts</li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium text-text mb-2">⚠️ Phishing Protection</h4>
            <ul className="text-sm text-text-secondary space-y-1">
              <li>• Check the URL bar for &quot;maga-fi.netlify.app&quot;</li>
              <li>• Look for the secure lock icon in your browser</li>
              <li>• Never enter wallet info on suspicious sites</li>
              <li>• Bookmark this site for future access</li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium text-text mb-2">🛡️ Transaction Safety</h4>
            <ul className="text-sm text-text-secondary space-y-1">
              <li>• Always review transaction details carefully</li>
              <li>• Start with small amounts to test</li>
              <li>• Keep your wallet software updated</li>
              <li>• Monitor your positions regularly</li>
            </ul>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-700">
              <strong>Important:</strong> This protocol involves financial risk. Only invest what you can afford to lose.
              Past performance does not guarantee future results.
            </p>
          </div>
        </div>

        <div className="flex items-center mb-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={hasReadWarning}
              onChange={(e) => setHasReadWarning(e.target.checked)}
              className="mr-2 h-4 w-4 text-primary focus:ring-primary border-border rounded"
            />
            <span className="text-sm text-text">
              I have read and understand the security warnings
            </span>
          </label>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={onDecline}
            className="flex-1 px-4 py-2 text-sm font-medium text-text-secondary bg-surface border border-border rounded-lg hover:bg-surface-hover transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onAccept}
            disabled={!hasReadWarning}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-primary border border-primary rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Connect Wallet
          </button>
        </div>
      </div>
    </div>
  );
};

// Hook for managing security warning state
export const useSecurityWarning = () => {
  const [showWarning, setShowWarning] = useState(false);
  const [isWarningAccepted, setIsWarningAccepted] = useState(false);

  const promptSecurityWarning = () => {
    if (!isWarningAccepted) {
      setShowWarning(true);
      return new Promise<boolean>((resolve) => {
        const handleAccept = () => {
          setIsWarningAccepted(true);
          setShowWarning(false);
          resolve(true);
        };
        
        const handleDecline = () => {
          setShowWarning(false);
          resolve(false);
        };

        // Store callbacks for the component to use
        (window as any).__securityWarningCallbacks = {
          accept: handleAccept,
          decline: handleDecline,
        };
      });
    }
    return Promise.resolve(true);
  };

  const resetWarning = () => {
    setIsWarningAccepted(false);
  };

  return {
    showWarning,
    isWarningAccepted,
    promptSecurityWarning,
    resetWarning,
    setShowWarning,
  };
};