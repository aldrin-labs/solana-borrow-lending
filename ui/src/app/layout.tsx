import './globals.css';
import type { Metadata } from 'next';
import { WalletProviderWrapper } from '@/components/WalletProviderWrapper';

export const metadata: Metadata = {
  title: 'Solana Borrow Lending Protocol',
  description: 'A high-performance UI for Solana Borrow Lending Protocol',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <WalletProviderWrapper>
          {children}
        </WalletProviderWrapper>
      </body>
    </html>
  );
}