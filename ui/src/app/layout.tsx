import "./globals.css";
import type { Metadata, Viewport } from "next";
import { WalletProviderWrapper } from "@/components/WalletProviderWrapper";
import { Header } from "@/components/Header";
import { PWAInstaller } from "@/components/PWAInstaller";
import { Onboarding } from "@/components/Onboarding";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { WalletErrorBoundary } from "@/components/WalletErrorBoundary";
import { WebComponentGuard } from "@/components/WebComponentGuard";

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
              // Prevent custom element re-definition early in document lifecycle
              (function() {
                if (typeof window !== 'undefined' && window.customElements) {
                  const originalDefine = window.customElements.define.bind(window.customElements);
                  const definedElements = new Set();
                  
                  window.customElements.define = function(name, constructor, options) {
                    if (definedElements.has(name) || window.customElements.get(name)) {
                      console.warn('Custom element "' + name + '" already defined, skipping re-definition');
                      return;
                    }
                    
                    try {
                      definedElements.add(name);
                      return originalDefine(name, constructor, options);
                    } catch (error) {
                      if (error.message && error.message.includes('already been defined')) {
                        console.warn('Custom element "' + name + '" already defined, caught error:', error.message);
                        return;
                      }
                      throw error;
                    }
                  };
                  
                  // Suppress specific custom element errors
                  window.addEventListener('error', function(error) {
                    if (error.message && (
                        error.message.includes('already been defined') ||
                        error.message.includes('mce-autosize-textarea')
                      )) {
                      error.preventDefault();
                      console.warn('Suppressed custom element error:', error.message);
                      return false;
                    }
                  });
                }
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-screen font-sans theme-transition">
        <WebComponentGuard />
        <ErrorBoundary>
          <ThemeProvider>
            <WalletErrorBoundary>
              <WalletProviderWrapper>
                <PWAInstaller />
                <Onboarding />
                <div className="flex flex-col min-h-screen">
                  <Header />
                  <main className="flex-grow pt-6 pb-12 animate-fade-in">
                    <ErrorBoundary>
                      {children}
                    </ErrorBoundary>
                  </main>
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
              </WalletProviderWrapper>
            </WalletErrorBoundary>
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
