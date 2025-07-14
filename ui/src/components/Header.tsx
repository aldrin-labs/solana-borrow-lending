"use client";

import { FC } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeSelector } from "./ThemeSelector";
import { ErrorBoundary } from "./ErrorBoundary";
import { RPCProviderSelector } from "./RPCProviderSelector";
import { KeyboardShortcutTooltip } from "./KeyboardShortcutTooltip";
import { useRouter } from "next/navigation";

// Helper component to highlight hotkey letters in button text
const HighlightedText: FC<{ text: string; highlight: string }> = ({ text, highlight }) => {
  const highlightIndex = text.toLowerCase().indexOf(highlight.toLowerCase());
  
  if (highlightIndex === -1) {
    return <>{text}</>;
  }
  
  const before = text.slice(0, highlightIndex);
  const highlighted = text.slice(highlightIndex, highlightIndex + highlight.length);
  const after = text.slice(highlightIndex + highlight.length);
  
  return (
    <>
      {before}
      <span 
        className="underline font-semibold" 
        style={{ 
          textDecorationColor: 'var(--theme-primary)',
          textDecorationThickness: '2px',
          textUnderlineOffset: '2px'
        }}
      >
        {highlighted}
      </span>
      {after}
    </>
  );
};

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
  const router = useRouter();

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
              <KeyboardShortcutTooltip
                shortcut={{
                  key: 'd',
                  description: 'Go to Dashboard',
                  category: 'Navigation',
                }}
                action={() => router.push('/')}
                element="nav-dashboard"
              >
                <Link
                  href="/"
                  className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 hover:bg-opacity-10 focus-visible ${
                    isActive('/') ? 'text-primary' : ''
                  }`}
                  style={{
                    color: isActive('/') ? 'var(--theme-primary)' : 'var(--theme-textSecondary)',
                    backgroundColor: isActive('/') ? 'color-mix(in srgb, var(--theme-primary) 10%, transparent)' : 'transparent',
                  }}
                  data-business-function="This takes you to the main screen where you can see how much money is in the lending protocol, what interest rates people are getting, and how well everything is performing. Think of it like the homepage that shows you the big picture."
                  aria-label="Dashboard - View protocol overview and market statistics"
                >
                  <HighlightedText text="Dashboard" highlight="D" />
                </Link>
              </KeyboardShortcutTooltip>
              <KeyboardShortcutTooltip
                shortcut={{
                  key: 'l',
                  description: 'Go to Lend',
                  category: 'Navigation',
                }}
                action={() => router.push('/lend')}
                element="nav-lend"
              >
                <Link
                  href="/lend"
                  className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 hover:bg-opacity-10 focus-visible ${
                    isActive('/lend') ? 'text-primary' : ''
                  }`}
                  style={{
                    color: isActive('/lend') ? 'var(--theme-primary)' : 'var(--theme-textSecondary)',
                    backgroundColor: isActive('/lend') ? 'color-mix(in srgb, var(--theme-primary) 10%, transparent)' : 'transparent',
                  }}
                  data-business-function="This is where you can give your cryptocurrency to others and earn money while you sleep! You deposit your coins, and people who need them pay you interest - like putting money in a savings account that pays much better rates."
                  aria-label="Lend - Deposit assets to earn interest"
                >
                  <HighlightedText text="Lend" highlight="L" />
                </Link>
              </KeyboardShortcutTooltip>
              <KeyboardShortcutTooltip
                shortcut={{
                  key: 'b',
                  description: 'Go to Borrow',
                  category: 'Navigation',
                }}
                action={() => router.push('/borrow')}
                element="nav-borrow"
              >
                <Link
                  href="/borrow"
                  className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 hover:bg-opacity-10 focus-visible ${
                    isActive('/borrow') ? 'text-primary' : ''
                  }`}
                  style={{
                    color: isActive('/borrow') ? 'var(--theme-primary)' : 'var(--theme-textSecondary)',
                    backgroundColor: isActive('/borrow') ? 'color-mix(in srgb, var(--theme-primary) 10%, transparent)' : 'transparent',
                  }}
                  data-business-function="This lets you borrow someone else's cryptocurrency by using your own coins as a promise to pay it back. It's like getting a loan from a bank, but instead of your house as collateral, you use your crypto. Useful when you need cash but don't want to sell your coins."
                  aria-label="Borrow - Take loans against your collateral"
                >
                  <HighlightedText text="Borrow" highlight="B" />
                </Link>
              </KeyboardShortcutTooltip>
              <KeyboardShortcutTooltip
                shortcut={{
                  key: 'f',
                  description: 'Go to Yield Farm',
                  category: 'Navigation',
                }}
                action={() => router.push('/farm')}
                element="nav-farm"
              >
                <Link
                  href="/farm"
                  className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 hover:bg-opacity-10 focus-visible ${
                    isActive('/farm') ? 'text-primary' : ''
                  }`}
                  style={{
                    color: isActive('/farm') ? 'var(--theme-primary)' : 'var(--theme-textSecondary)',
                    backgroundColor: isActive('/farm') ? 'color-mix(in srgb, var(--theme-primary) 10%, transparent)' : 'transparent',
                  }}
                  data-business-function="This is where you can earn extra money by providing your cryptocurrency to special pools that help the platform work smoothly. Think of it like getting paid to be a helper - you provide your coins to make trades possible and get reward tokens in return."
                  aria-label="Yield Farm - Earn rewards through liquidity provision"
                >
                  <HighlightedText text="Yield Farm" highlight="F" />
                </Link>
              </KeyboardShortcutTooltip>
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
            data-business-function="This takes you to the main screen where you can see how much money is in the lending protocol, what interest rates people are getting, and how well everything is performing. Think of it like the homepage that shows you the big picture."
            aria-label="Dashboard - View protocol overview and market statistics"
          >
            <HighlightedText text="Dashboard" highlight="D" />
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
            data-business-function="This is where you can give your cryptocurrency to others and earn money while you sleep! You deposit your coins, and people who need them pay you interest - like putting money in a savings account that pays much better rates."
            aria-label="Lend - Deposit assets to earn interest"
          >
            <HighlightedText text="Lend" highlight="L" />
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
            data-business-function="This lets you borrow someone else's cryptocurrency by using your own coins as a promise to pay it back. It's like getting a loan from a bank, but instead of your house as collateral, you use your crypto. Useful when you need cash but don't want to sell your coins."
            aria-label="Borrow - Take loans against your collateral"
          >
            <HighlightedText text="Borrow" highlight="B" />
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
            data-business-function="This is where you can earn extra money by providing your cryptocurrency to special pools that help the platform work smoothly. Think of it like getting paid to be a helper - you provide your coins to make trades possible and get reward tokens in return."
            aria-label="Yield Farm - Earn rewards through liquidity provision"
          >
            <HighlightedText text="Yield Farm" highlight="F" />
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
