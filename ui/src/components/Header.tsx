"use client";

import { FC } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import Link from "next/link";
import { ThemeSelector } from "./ThemeSelector";
import { ErrorBoundary } from "./ErrorBoundary";

// Safe wallet button component with error handling
const SafeWalletButton: FC = () => {
  try {
    return (
      <WalletMultiButton className="btn-connect !rounded-lg !transition-all !duration-200 !font-medium" />
    );
  } catch (error) {
    console.warn('WalletMultiButton error:', error);
    return (
      <button
        className="px-4 py-2 rounded-lg font-medium transition-all duration-200"
        style={{
          backgroundColor: 'var(--theme-primary)',
          color: 'var(--theme-onPrimary)',
        }}
        disabled
      >
        Connect Wallet
      </button>
    );
  }
};

export const Header: FC = () => {
  return (
    <header 
      className="shadow-sm border-b sticky top-0 z-50 backdrop-blur-sm transition-all duration-300"
      style={{
        backgroundColor: 'var(--theme-background)',
        borderColor: 'var(--theme-border)',
      }}
    >
      <div className="container mx-auto px-6 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-8">
            <Link href="/" className="flex items-center space-x-3 group">
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center shadow-lg transition-transform duration-200 group-hover:scale-105"
                style={{
                  background: 'var(--theme-gradient-primary)',
                }}
              >
                <span className="text-white font-bold text-sm">MAGA</span>
              </div>
              <span 
                className="text-xl font-semibold transition-colors duration-200"
                style={{
                  color: 'var(--theme-textPrimary)',
                }}
              >
                MAGA
              </span>
            </Link>
            
            <nav className="hidden md:flex space-x-1">
              <Link
                href="/"
                className="px-4 py-2 rounded-lg font-medium transition-all duration-200 hover:bg-opacity-10"
                style={{
                  color: 'var(--theme-textSecondary)',
                }}
              >
                Dashboard
              </Link>
              <Link
                href="/lend"
                className="px-4 py-2 rounded-lg font-medium transition-all duration-200 hover:bg-opacity-10"
                style={{
                  color: 'var(--theme-textSecondary)',
                }}
              >
                Lend
              </Link>
              <Link
                href="/borrow"
                className="px-4 py-2 rounded-lg font-medium transition-all duration-200 hover:bg-opacity-10"
                style={{
                  color: 'var(--theme-textSecondary)',
                }}
              >
                Borrow
              </Link>
              <Link
                href="/farm"
                className="px-4 py-2 rounded-lg font-medium transition-all duration-200 hover:bg-opacity-10"
                style={{
                  color: 'var(--theme-textSecondary)',
                }}
              >
                Yield Farm
              </Link>
            </nav>
          </div>
          
          <div className="flex items-center space-x-4">
            <ThemeSelector />
            <ErrorBoundary>
              <SafeWalletButton />
            </ErrorBoundary>
          </div>
        </div>
      </div>

      {/* Mobile menu - hidden on desktop */}
      <div 
        className="md:hidden border-t transition-all duration-300"
        style={{
          borderColor: 'var(--theme-border)',
        }}
      >
        <nav className="container mx-auto px-6 py-4 flex flex-col space-y-2">
          <Link
            href="/"
            className="px-4 py-2 rounded-lg font-medium transition-all duration-200 hover:bg-opacity-10"
            style={{
              color: 'var(--theme-textSecondary)',
            }}
          >
            Dashboard
          </Link>
          <Link
            href="/lend"
            className="px-4 py-2 rounded-lg font-medium transition-all duration-200 hover:bg-opacity-10"
            style={{
              color: 'var(--theme-textSecondary)',
            }}
          >
            Lend
          </Link>
          <Link
            href="/borrow"
            className="px-4 py-2 rounded-lg font-medium transition-all duration-200 hover:bg-opacity-10"
            style={{
              color: 'var(--theme-textSecondary)',
            }}
          >
            Borrow
          </Link>
          <Link
            href="/farm"
            className="px-4 py-2 rounded-lg font-medium transition-all duration-200 hover:bg-opacity-10"
            style={{
              color: 'var(--theme-textSecondary)',
            }}
          >
            Yield Farm
          </Link>
        </nav>
      </div>
    </header>
  );
};
