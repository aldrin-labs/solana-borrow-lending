'use client';

import { FC } from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import Link from 'next/link';

export const Header: FC = () => {
  return (
    <header className="bg-surface py-4 px-6 shadow-md">
      <div className="container mx-auto flex justify-between items-center">
        <div className="flex items-center space-x-6">
          <Link href="/" className="text-2xl font-bold text-primary">
            Solana Lending
          </Link>
          <nav className="hidden md:flex space-x-6">
            <Link href="/" className="text-text-primary hover:text-primary transition-colors">
              Dashboard
            </Link>
            <Link href="/lend" className="text-text-primary hover:text-primary transition-colors">
              Lend
            </Link>
            <Link href="/borrow" className="text-text-primary hover:text-primary transition-colors">
              Borrow
            </Link>
            <Link href="/farm" className="text-text-primary hover:text-primary transition-colors">
              Yield Farm
            </Link>
          </nav>
        </div>
        <div className="flex items-center space-x-4">
          <WalletMultiButton className="!bg-primary hover:!bg-primary-dark" />
        </div>
      </div>
    </header>
  );
};