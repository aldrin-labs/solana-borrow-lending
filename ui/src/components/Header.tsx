"use client";

import { FC } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import Link from "next/link";

export const Header: FC = () => {
  return (
    <header className="bg-white shadow-sm border-b border-border sticky top-0 z-50 backdrop-blur-sm">
      <div className="container mx-auto px-6 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-8">
            <Link href="/" className="flex items-center space-x-3 group">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center shadow-lg transition-transform duration-200 group-hover:scale-105">
                <span className="text-white font-bold text-sm">MAGA</span>
              </div>
              <span className="text-xl font-semibold text-text-primary group-hover:text-primary transition-colors duration-200">
                MAGA
              </span>
            </Link>
            
            <nav className="hidden md:flex space-x-1">
              <Link
                href="/"
                className="px-4 py-2 rounded-lg text-text-secondary hover:text-primary hover:bg-gray-50 transition-all duration-200 font-medium"
              >
                Dashboard
              </Link>
              <Link
                href="/lend"
                className="px-4 py-2 rounded-lg text-text-secondary hover:text-primary hover:bg-gray-50 transition-all duration-200 font-medium"
              >
                Lend
              </Link>
              <Link
                href="/borrow"
                className="px-4 py-2 rounded-lg text-text-secondary hover:text-primary hover:bg-gray-50 transition-all duration-200 font-medium"
              >
                Borrow
              </Link>
              <Link
                href="/farm"
                className="px-4 py-2 rounded-lg text-text-secondary hover:text-primary hover:bg-gray-50 transition-all duration-200 font-medium"
              >
                Yield Farm
              </Link>
            </nav>
          </div>
          
          <div className="flex items-center space-x-4">
            <WalletMultiButton className="btn-connect !rounded-lg !transition-all !duration-200 !font-medium" />
          </div>
        </div>
      </div>

      {/* Mobile menu - hidden on desktop */}
      <div className="md:hidden border-t border-border">
        <nav className="container mx-auto px-6 py-4 flex flex-col space-y-2">
          <Link
            href="/"
            className="px-4 py-2 rounded-lg text-text-secondary hover:text-primary hover:bg-gray-50 transition-all duration-200 font-medium"
          >
            Dashboard
          </Link>
          <Link
            href="/lend"
            className="px-4 py-2 rounded-lg text-text-secondary hover:text-primary hover:bg-gray-50 transition-all duration-200 font-medium"
          >
            Lend
          </Link>
          <Link
            href="/borrow"
            className="px-4 py-2 rounded-lg text-text-secondary hover:text-primary hover:bg-gray-50 transition-all duration-200 font-medium"
          >
            Borrow
          </Link>
          <Link
            href="/farm"
            className="px-4 py-2 rounded-lg text-text-secondary hover:text-primary hover:bg-gray-50 transition-all duration-200 font-medium"
          >
            Yield Farm
          </Link>
        </nav>
      </div>
    </header>
  );
};
