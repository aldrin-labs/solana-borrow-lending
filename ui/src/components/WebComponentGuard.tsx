"use client";

import React, { useEffect } from 'react';

export const WebComponentGuard: React.FC = () => {
  useEffect(() => {
    // Prevent custom element re-definition by overriding customElements.define
    if (typeof window !== 'undefined' && window.customElements) {
      const originalDefine = window.customElements.define.bind(window.customElements);
      const definedElements = new Set<string>();
      
      window.customElements.define = function(name: string, constructor: any, options?: any) {
        if (definedElements.has(name) || window.customElements.get(name)) {
          console.warn(`Custom element '${name}' already defined, skipping re-definition`);
          return;
        }
        
        try {
          definedElements.add(name);
          return originalDefine(name, constructor, options);
        } catch (error: any) {
          if (error.message && error.message.includes('already been defined')) {
            console.warn(`Custom element '${name}' already defined, caught error:`, error.message);
            return;
          }
          throw error;
        }
      };
    }

    // Handle custom element conflicts
    const handleCustomElementError = (error: ErrorEvent) => {
      if (error.message && error.message.includes('already been defined')) {
        console.warn('Custom element already defined, ignoring:', error.message);
        error.preventDefault();
        return true;
      }
      
      // Handle wallet adapter null reference errors
      if (error.message && 
          (error.message.includes('Cannot read properties of null') ||
           error.message.includes('Cannot read property \'type\' of null'))) {
        console.warn('Wallet adapter null reference error, ignoring:', error.message);
        error.preventDefault();
        return true;
      }
      
      return false;
    };

    // Add error listener
    window.addEventListener('error', handleCustomElementError);
    
    // Add unhandled promise rejection handler
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (event.reason && event.reason.message) {
        // Handle custom element conflicts
        if (event.reason.message.includes('already been defined')) {
          console.warn('Custom element promise rejection, ignoring:', event.reason.message);
          event.preventDefault();
          return true;
        }
        
        // Handle wallet adapter errors
        if (event.reason.message.includes('Cannot read properties of null') ||
            event.reason.message.includes('Cannot read property \'type\' of null')) {
          console.warn('Wallet adapter promise rejection, ignoring:', event.reason.message);
          event.preventDefault();
          return true;
        }
      }
      
      return false;
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // Override console.error temporarily to catch and filter wallet errors
    const originalConsoleError = console.error;
    console.error = (...args) => {
      // Filter out known wallet adapter errors and custom element errors
      const message = args.join(' ');
      if (message.includes('Cannot read properties of null') ||
          message.includes('Cannot read property \'type\' of null') ||
          message.includes('wallet adapter') ||
          message.includes('already been defined')) {
        console.warn('Filtered error:', ...args);
        return;
      }
      originalConsoleError.apply(console, args);
    };

    // Cleanup
    return () => {
      window.removeEventListener('error', handleCustomElementError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      console.error = originalConsoleError;
    };
  }, []);

  return null;
};