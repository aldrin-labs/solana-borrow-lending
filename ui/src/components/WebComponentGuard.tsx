"use client";

import React, { useEffect } from 'react';

export const WebComponentGuard: React.FC = () => {
  useEffect(() => {
    // Early prevention in useEffect to catch any remaining cases
    if (typeof window !== 'undefined' && window.customElements) {
      const originalDefine = window.customElements.define.bind(window.customElements);
      const originalGet = window.customElements.get.bind(window.customElements);
      const definedElements = new Set<string>();
      
      // Override customElements.define to prevent re-definition
      window.customElements.define = function(name: string, constructor: any, options?: any) {
        // Check if element is already defined using get method
        const existing = originalGet(name);
        if (existing || definedElements.has(name)) {
          console.warn(`Custom element '${name}' already defined, skipping re-definition`);
          return existing;
        }
        
        try {
          definedElements.add(name);
          const result = originalDefine(name, constructor, options);
          console.log(`Custom element '${name}' defined successfully`);
          return result;
        } catch (error: any) {
          if (error.message && (
              error.message.includes('already been defined') ||
              error.message.includes('already defined') ||
              name === 'mce-autosize-textarea'
            )) {
            console.warn(`Custom element '${name}' already defined, caught error:`, error.message);
            // Return existing element instead of throwing
            return originalGet(name) || undefined;
          }
          console.error(`Failed to define custom element '${name}':`, error);
          throw error;
        }
      };
      
      // Override customElements.get to ensure consistency
      window.customElements.get = function(name: string) {
        try {
          return originalGet(name);
        } catch (error) {
          console.warn(`Error getting custom element '${name}':`, error);
          return undefined;
        }
      };
    }

    // Enhanced error handlers for multiple error types
    const handleCustomElementError = (error: ErrorEvent) => {
      const message = error.message || '';
      
      // Handle custom element conflicts
      if (message.includes('already been defined') || 
          message.includes('mce-autosize-textarea') ||
          message.includes('custom element')) {
        console.warn('Custom element already defined, ignoring:', message);
        error.preventDefault();
        return true;
      }
      
      // Handle wallet adapter null reference errors
      if (message.includes('Cannot read properties of null') ||
          message.includes('Cannot read property \'type\' of null') ||
          message.includes('Cannot set property ethereum') ||
          message.includes('Cannot redefine property')) {
        console.warn('Wallet/Ethereum provider error, ignoring:', message);
        error.preventDefault();
        return true;
      }
      
      // Handle tooltip null reference errors
      if (message.includes('getBoundingClientRect') ||
          message.includes('currentTarget is null')) {
        console.warn('Tooltip null reference error, ignoring:', message);
        error.preventDefault();
        return true;
      }
      
      return false;
    };

    // Add unhandled promise rejection handler
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (event.reason && event.reason.message) {
        const message = event.reason.message;
        
        // Handle custom element conflicts
        if (message.includes('already been defined') ||
            message.includes('mce-autosize-textarea') ||
            message.includes('custom element')) {
          console.warn('Custom element promise rejection, ignoring:', message);
          event.preventDefault();
          return true;
        }
        
        // Handle wallet adapter errors
        if (message.includes('Cannot read properties of null') ||
            message.includes('Cannot read property \'type\' of null') ||
            message.includes('Cannot set property ethereum') ||
            message.includes('Cannot redefine property') ||
            message.includes('wallet adapter')) {
          console.warn('Wallet adapter promise rejection, ignoring:', message);
          event.preventDefault();
          return true;
        }
        
        // Handle tooltip errors
        if (message.includes('getBoundingClientRect') ||
            message.includes('currentTarget is null')) {
          console.warn('Tooltip promise rejection, ignoring:', message);
          event.preventDefault();
          return true;
        }
      }
      
      return false;
    };

    window.addEventListener('error', handleCustomElementError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // Enhanced console.error override to filter known issues
    const originalConsoleError = console.error;
    console.error = (...args) => {
      const message = args.join(' ');
      
      // Filter out known problematic errors
      if (message.includes('Cannot read properties of null') ||
          message.includes('Cannot read property \'type\' of null') ||
          message.includes('Cannot set property ethereum') ||
          message.includes('Cannot redefine property') ||
          message.includes('wallet adapter') ||
          message.includes('already been defined') ||
          message.includes('mce-autosize-textarea') ||
          message.includes('getBoundingClientRect') ||
          message.includes('currentTarget is null')) {
        console.warn('Filtered console error:', ...args);
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