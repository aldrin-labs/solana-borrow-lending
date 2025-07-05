"use client";

import { useEffect } from "react";

export function PWAInstaller() {
  useEffect(() => {
    // Register service worker with error handling
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('Service Worker registered successfully:', registration);
          
          // Check for updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New content available, prompt user to refresh
                  if (confirm('New version available! Refresh to update?')) {
                    window.location.reload();
                  }
                }
              });
            }
          });
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error);
        });
    }

    // Handle PWA install prompt with error handling
    let deferredPrompt: any;
    
    const handleBeforeInstallPrompt = (e: Event) => {
      try {
        // Prevent Chrome 67 and earlier from automatically showing the prompt
        e.preventDefault();
        // Stash the event so it can be triggered later
        deferredPrompt = e;
        
        // Show custom install button or notification
        console.log('PWA install prompt available');
        
        // You could dispatch a custom event here to show an install button
        const installEvent = new CustomEvent('pwa-install-available');
        window.dispatchEvent(installEvent);
      } catch (error) {
        console.error('Error handling install prompt:', error);
      }
    };

    const handleAppInstalled = () => {
      try {
        console.log('PWA was installed');
        deferredPrompt = null;
        
        // Hide install button
        const installedEvent = new CustomEvent('pwa-installed');
        window.dispatchEvent(installedEvent);
      } catch (error) {
        console.error('Error handling app installed:', error);
      }
    };

    // Add event listeners with error handling
    try {
      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.addEventListener('appinstalled', handleAppInstalled);
    } catch (error) {
      console.error('Error adding PWA event listeners:', error);
    }

    // Background sync registration (for data updates) with error handling
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      navigator.serviceWorker.ready.then((registration) => {
        try {
          // Register for background sync
          return (registration as any).sync.register('solana-data-sync');
        } catch (error) {
          console.error('Background sync registration failed:', error);
        }
      }).catch((error) => {
        console.error('Service worker not ready for background sync:', error);
      });
    }

    // Cleanup
    return () => {
      try {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.removeEventListener('appinstalled', handleAppInstalled);
      } catch (error) {
        console.error('Error removing PWA event listeners:', error);
      }
    };
  }, []);

  return null; // This component doesn't render anything
}

// PWA Install Button Component
export function PWAInstallButton() {
  const handleInstallClick = async () => {
    // Get the deferred prompt from the global scope
    const deferredPrompt = (window as any).deferredPrompt;
    
    if (deferredPrompt) {
      // Show the install prompt
      deferredPrompt.prompt();
      
      // Wait for the user to respond to the prompt
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
      } else {
        console.log('User dismissed the install prompt');
      }
      
      // Clear the deferred prompt
      (window as any).deferredPrompt = null;
    }
  };

  return (
    <button
      onClick={handleInstallClick}
      className="btn-primary text-sm px-3 py-1 hidden"
      id="pwa-install-button"
    >
      Install App
    </button>
  );
}