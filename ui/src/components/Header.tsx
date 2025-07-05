"use client";

import { FC } from "react";
import { WalletConnectionButton } from "./WalletConnectionButton";
import Link from "next/link";

export const Header: FC = () => {
  return (
    <header className="bg-surface py-4 px-6 shadow-md border-b border-border sticky top-0 z-50">
      <div className="container mx-auto flex justify-between items-center">
        <div className="flex items-center space-x-6">
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <span className="text-white font-bold text-sm">SL</span>
            </div>
            <span className="text-xl font-bold text-white">Solana Lending</span>
          </Link>
          <nav className="hidden md:flex space-x-6">
            <Link
              href="/"
              className="text-text-secondary hover:text-white transition-colors font-medium"
            >
              Dashboard
            </Link>
            <Link
              href="/lend"
              className="text-text-secondary hover:text-white transition-colors font-medium"
            >
              Lend
            </Link>
            <Link
              href="/borrow"
              className="text-text-secondary hover:text-white transition-colors font-medium"
            >
              Borrow
            </Link>
            <Link
              href="/farm"
              className="text-text-secondary hover:text-white transition-colors font-medium"
            >
              Yield Farm
            </Link>
          </nav>
        </div>
        <div className="flex items-center space-x-4">
          <WalletConnectionButton className="btn-connect" />
        </div>
      </div>

      {/* Mobile menu - hidden on desktop */}
      <div className="md:hidden mt-4 border-t border-border pt-4">
        <nav className="flex flex-col space-y-3">
          <Link
            href="/"
            className="text-text-secondary hover:text-white transition-colors font-medium"
          >
            Dashboard
          </Link>
          <Link
            href="/lend"
            className="text-text-secondary hover:text-white transition-colors font-medium"
          >
            Lend
          </Link>
          <Link
            href="/borrow"
            className="text-text-secondary hover:text-white transition-colors font-medium"
          >
            Borrow
          </Link>
          <Link
            href="/farm"
            className="text-text-secondary hover:text-white transition-colors font-medium"
          >
            Yield Farm
          </Link>
        </nav>
      </div>
    </header>
  );
};
