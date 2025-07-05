import "./globals.css";
import type { Metadata } from "next";
import { WalletProviderWrapper } from "@/components/WalletProviderWrapper";
import { Header } from "@/components/Header";
import { PWAInstaller } from "@/components/PWAInstaller";
import { Onboarding } from "@/components/Onboarding";

export const metadata: Metadata = {
  title: "MAGA - Make Aldrin Great Again",
  description: "A professional banking-grade interface for MAGA - Make Aldrin Great Again",
  manifest: "/manifest.json",
  themeColor: "#3182CE",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: "cover",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MAGA",
  },
  formatDetection: {
    telephone: false,
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-text-primary font-sans">
        <WalletProviderWrapper>
          <PWAInstaller />
          <Onboarding />
          <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-grow pt-6 pb-12 animate-fade-in">{children}</main>
            <footer className="bg-surface py-6 border-t border-border">
              <div className="container mx-auto px-4 text-center text-text-secondary">
                <p className="text-sm">
                  © 2025 MAGA - Make Aldrin Great Again. All rights reserved.
                </p>
              </div>
            </footer>
          </div>
        </WalletProviderWrapper>
      </body>
    </html>
  );
}
