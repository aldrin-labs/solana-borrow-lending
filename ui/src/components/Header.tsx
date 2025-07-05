"use client";

import { FC } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeSelector } from "./ThemeSelector";
import { ErrorBoundary } from "./ErrorBoundary";
import { RPCProviderSelector } from "./RPCProviderSelector";

// Safe wallet button component with enhanced error handling
const SafeWalletButton: FC = () => {
  const WalletFallback: React.FC<{ error: Error; reset: () => void }> = ({ error, reset }) => (
    <button
      className="px-4 py-2 rounded-lg font-medium transition-all duration-200"
      style={{
        backgroundColor: 'var(--theme-primary)',
        color: 'white',
      }}
      onClick={reset}
      disabled
    >
      Wallet Unavailable
    </button>
  );

  try {
    return (
      <ErrorBoundary fallback={WalletFallback}>
        <WalletMultiButton className="btn-connect !rounded-lg !transition-all !duration-200 !font-medium focus-visible" />
      </ErrorBoundary>
    );
  } catch (error) {
    console.warn('WalletMultiButton error:', error);
    return (
      <button
        className="px-4 py-2 rounded-lg font-medium transition-all duration-200"
        style={{
          backgroundColor: 'var(--theme-primary)',
          color: 'white',
        }}
        disabled
      >
        Connect Wallet
      </button>
    );
  }
};

// Breadcrumb component
const Breadcrumbs: FC = () => {
  const pathname = usePathname();
  
  const getBreadcrumbs = (path: string) => {
    const segments = path.split('/').filter(Boolean);
    
    const breadcrumbs = [
      { label: 'Dashboard', href: '/', current: path === '/' }
    ];
    
    if (segments.length > 0) {
      const segment = segments[0];
      const labels: Record<string, string> = {
        'lend': 'Lending',
        'borrow': 'Borrowing', 
        'farm': 'Yield Farming',
      };
      
      breadcrumbs.push({
        label: labels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1),
        href: `/${segment}`,
        current: true
      });
    }
    
    return breadcrumbs;
  };

  const breadcrumbs = getBreadcrumbs(pathname);

  return (
    <nav className="flex items-center space-x-2 text-sm" aria-label="Breadcrumb">
      {breadcrumbs.map((breadcrumb, index) => (
        <div key={breadcrumb.href} className="flex items-center">
          {index > 0 && (
            <svg className="w-4 h-4 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--theme-textMuted)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}
          {breadcrumb.current ? (
            <span className="typography-body-sm font-medium" style={{ color: 'var(--theme-primary)' }}>
              {breadcrumb.label}
            </span>
          ) : (
            <Link
              href={breadcrumb.href}
              className="typography-body-sm hover:underline transition-colors duration-200 focus-visible"
              style={{ color: 'var(--theme-textSecondary)' }}
            >
              {breadcrumb.label}
            </Link>
          )}
        </div>
      ))}
    </nav>
  );
};

export const Header: FC = () => {
  const pathname = usePathname();

  const isActive = (path: string) => {
    if (path === '/' && pathname === '/') return true;
    return pathname.startsWith(path) && path !== '/';
  };

  return (
    <header className="sticky-header">
      <div className="container mx-auto px-6 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-8">
            <Link href="/" className="flex items-center space-x-3 group focus-visible">
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
                MAGA - Make Aldrin Great Again
              </span>
            </Link>
            
            <nav className="hidden md:flex space-x-1" role="navigation" aria-label="Main navigation">
              <Link
                href="/"
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 hover:bg-opacity-10 focus-visible ${
                  isActive('/') ? 'text-primary' : ''
                }`}
                style={{
                  color: isActive('/') ? 'var(--theme-primary)' : 'var(--theme-textSecondary)',
                  backgroundColor: isActive('/') ? 'color-mix(in srgb, var(--theme-primary) 10%, transparent)' : 'transparent',
                }}
              >
                Dashboard
              </Link>
              <Link
                href="/lend"
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 hover:bg-opacity-10 focus-visible ${
                  isActive('/lend') ? 'text-primary' : ''
                }`}
                style={{
                  color: isActive('/lend') ? 'var(--theme-primary)' : 'var(--theme-textSecondary)',
                  backgroundColor: isActive('/lend') ? 'color-mix(in srgb, var(--theme-primary) 10%, transparent)' : 'transparent',
                }}
              >
                Lend
              </Link>
              <Link
                href="/borrow"
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 hover:bg-opacity-10 focus-visible ${
                  isActive('/borrow') ? 'text-primary' : ''
                }`}
                style={{
                  color: isActive('/borrow') ? 'var(--theme-primary)' : 'var(--theme-textSecondary)',
                  backgroundColor: isActive('/borrow') ? 'color-mix(in srgb, var(--theme-primary) 10%, transparent)' : 'transparent',
                }}
              >
                Borrow
              </Link>
              <Link
                href="/farm"
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 hover:bg-opacity-10 focus-visible ${
                  isActive('/farm') ? 'text-primary' : ''
                }`}
                style={{
                  color: isActive('/farm') ? 'var(--theme-primary)' : 'var(--theme-textSecondary)',
                  backgroundColor: isActive('/farm') ? 'color-mix(in srgb, var(--theme-primary) 10%, transparent)' : 'transparent',
                }}
              >
                Yield Farm
              </Link>
            </nav>
          </div>
          
          <div className="flex items-center space-x-3">
            <RPCProviderSelector />
            <ThemeSelector />
            <SafeWalletButton />
          </div>
        </div>

        {/* Breadcrumb navigation */}
        <div className="mt-3 hidden md:block">
          <Breadcrumbs />
        </div>
      </div>

      {/* Mobile menu - hidden on desktop */}
      <div 
        className="md:hidden border-t transition-all duration-300"
        style={{
          borderColor: 'var(--theme-border)',
        }}
      >
        <nav className="container mx-auto px-6 py-4 flex flex-col space-y-2" role="navigation" aria-label="Mobile navigation">
          <Link
            href="/"
            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 hover:bg-opacity-10 focus-visible ${
              isActive('/') ? 'text-primary' : ''
            }`}
            style={{
              color: isActive('/') ? 'var(--theme-primary)' : 'var(--theme-textSecondary)',
              backgroundColor: isActive('/') ? 'color-mix(in srgb, var(--theme-primary) 10%, transparent)' : 'transparent',
            }}
          >
            Dashboard
          </Link>
          <Link
            href="/lend"
            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 hover:bg-opacity-10 focus-visible ${
              isActive('/lend') ? 'text-primary' : ''
            }`}
            style={{
              color: isActive('/lend') ? 'var(--theme-primary)' : 'var(--theme-textSecondary)',
              backgroundColor: isActive('/lend') ? 'color-mix(in srgb, var(--theme-primary) 10%, transparent)' : 'transparent',
            }}
          >
            Lend
          </Link>
          <Link
            href="/borrow"
            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 hover:bg-opacity-10 focus-visible ${
              isActive('/borrow') ? 'text-primary' : ''
            }`}
            style={{
              color: isActive('/borrow') ? 'var(--theme-primary)' : 'var(--theme-textSecondary)',
              backgroundColor: isActive('/borrow') ? 'color-mix(in srgb, var(--theme-primary) 10%, transparent)' : 'transparent',
            }}
          >
            Borrow
          </Link>
          <Link
            href="/farm"
            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 hover:bg-opacity-10 focus-visible ${
              isActive('/farm') ? 'text-primary' : ''
            }`}
            style={{
              color: isActive('/farm') ? 'var(--theme-primary)' : 'var(--theme-textSecondary)',
              backgroundColor: isActive('/farm') ? 'color-mix(in srgb, var(--theme-primary) 10%, transparent)' : 'transparent',
            }}
          >
            Yield Farm
          </Link>
        </nav>

        {/* Mobile breadcrumbs */}
        <div className="container mx-auto px-6 pb-4">
          <Breadcrumbs />
        </div>
      </div>
    </header>
  );
};
