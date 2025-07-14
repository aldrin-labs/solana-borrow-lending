import "./globals.css";
import type { Metadata, Viewport } from "next";
import { WalletProviderWrapper } from "@/components/WalletProviderWrapper";
import { Header } from "@/components/Header";
import { PWAInstaller } from "@/components/PWAInstaller";
import { Onboarding, OnboardingProvider } from "@/components/Onboarding";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { RPCProviderProvider } from "@/contexts/RPCProviderContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { WalletErrorBoundary } from "@/components/WalletErrorBoundary";
import { ClientOnly } from "@/components/ClientOnly";
import { WebComponentGuard } from "@/components/WebComponentGuard";
import { QuickActions } from "@/components/QuickActions";
import { PerformanceInitializer } from "@/components/PerformanceInitializer";
import { KeyboardNavigationProvider } from "@/contexts/KeyboardNavigationContext";
import { KeyboardShortcutsHelp } from "@/components/KeyboardShortcutsHelp";
import { HotkeyFloatingButton } from "@/components/HotkeyFloatingButton";

export const metadata: Metadata = {
  title: "MAGA - Make Aldrin Great Again",
  description: "A professional banking-grade interface for MAGA - Make Aldrin Great Again",
  manifest: "/manifest.json",
  formatDetection: {
    telephone: false,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MAGA",
  },
  icons: {
    icon: [
      { url: "/icon-72x72.png", sizes: "72x72", type: "image/png" },
      { url: "/icon-96x96.png", sizes: "96x96", type: "image/png" },
      { url: "/icon-128x128.png", sizes: "128x128", type: "image/png" },
      { url: "/icon-144x144.png", sizes: "144x144", type: "image/png" },
      { url: "/icon-152x152.png", sizes: "152x152", type: "image/png" },
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-384x384.png", sizes: "384x384", type: "image/png" },
      { url: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icon-152x152.png", sizes: "152x152", type: "image/png" },
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
    "apple-mobile-web-app-title": "MAGA",
    "application-name": "MAGA - Make Aldrin Great Again",
    "msapplication-TileColor": "#3182CE",
    "msapplication-TileImage": "/icon-144x144.png",
    "msapplication-config": "/browserconfig.xml",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#3182CE",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Comprehensive custom element and wallet extension protection
              (function() {
                if (typeof window === 'undefined') return;
                
                // Protect against wallet extension conflicts first
                try {
                  // Prevent multiple wallet extensions from overriding ethereum
                  const originalEthereum = window.ethereum;
                  if (originalEthereum) {
                    Object.defineProperty(window, 'ethereum', {
                      value: originalEthereum,
                      writable: false,
                      configurable: false
                    });
                  }
                } catch (e) {
                  console.warn('Ethereum provider protection failed:', e.message);
                }
                
                // Enhanced custom element protection
                if (window.customElements) {
                  const originalDefine = window.customElements.define.bind(window.customElements);
                  const originalGet = window.customElements.get.bind(window.customElements);
                  const definedElements = new Set();
                  
                  window.customElements.define = function(name, constructor, options) {
                    // Always check if element exists first
                    try {
                      const existing = originalGet(name);
                      if (existing || definedElements.has(name)) {
                        console.warn('Custom element "' + name + '" already defined, skipping');
                        return existing;
                      }
                    } catch (e) {
                      console.warn('Error checking existing element:', e.message);
                    }
                    
                    try {
                      definedElements.add(name);
                      const result = originalDefine(name, constructor, options);
                      console.log('Successfully defined custom element:', name);
                      return result;
                    } catch (error) {
                      if (error.message && (
                          error.message.includes('already been defined') ||
                          error.message.includes('already defined') ||
                          name === 'mce-autosize-textarea'
                        )) {
                        console.warn('Custom element "' + name + '" conflict resolved');
                        return originalGet(name);
                      }
                      console.error('Failed to define custom element "' + name + '":', error.message);
                      throw error;
                    }
                  };
                }
                
                // Global error suppression for known issues
                window.addEventListener('error', function(error) {
                  const msg = error.message || '';
                  if (msg.includes('already been defined') ||
                      msg.includes('mce-autosize-textarea') ||
                      msg.includes('Cannot set property ethereum') ||
                      msg.includes('Cannot redefine property') ||
                      msg.includes('Cannot read properties of null') ||
                      msg.includes('getBoundingClientRect')) {
                    console.warn('Suppressed known error:', msg);
                    error.preventDefault();
                    return false;
                  }
                });
                
                // Global promise rejection suppression
                window.addEventListener('unhandledrejection', function(event) {
                  const msg = event.reason?.message || '';
                  if (msg.includes('already been defined') ||
                      msg.includes('mce-autosize-textarea') ||
                      msg.includes('Cannot set property ethereum') ||
                      msg.includes('Cannot redefine property') ||
                      msg.includes('Cannot read properties of null') ||
                      msg.includes('getBoundingClientRect')) {
                    console.warn('Suppressed known rejection:', msg);
                    event.preventDefault();
                    return false;
                  }
                });
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-screen font-sans theme-transition" style={{ fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' }}>
        <WebComponentGuard />
        <PerformanceInitializer />
        <ClientOnly>
          <ErrorBoundary>
            <ThemeProvider>
              <RPCProviderProvider>
                <WalletErrorBoundary>
                  <WalletProviderWrapper>
                    <KeyboardNavigationProvider>
                      <OnboardingProvider>
                      <PWAInstaller />
                      <Onboarding />
                      <div className="flex flex-col min-h-screen">
                        <Header />
                        <main className="flex-grow pt-6 pb-12 animate-fade-in">
                          <ErrorBoundary>
                            {children}
                          </ErrorBoundary>
                        </main>
                        <QuickActions />
                        <footer className="py-6 border-t transition-all duration-300" 
                          style={{
                            backgroundColor: 'var(--theme-surface)',
                            borderColor: 'var(--theme-border)',
                          }}>
                          <div className="container mx-auto px-4 text-center" 
                            style={{ color: 'var(--theme-textSecondary)' }}>
                            <p className="text-sm">
                              © 2025 MAGA - Make Aldrin Great Again. All rights reserved.
                            </p>
                          </div>
                        </footer>
                      </div>
                      <KeyboardShortcutsHelp />
                      <HotkeyFloatingButton />
                    </OnboardingProvider>
                    </KeyboardNavigationProvider>
                  </WalletProviderWrapper>
                </WalletErrorBoundary>
              </RPCProviderProvider>
            </ThemeProvider>
          </ErrorBoundary>
        </ClientOnly>
      </body>
    </html>
  );
}
