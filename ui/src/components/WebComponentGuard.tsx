"use client";

import React, { useEffect } from 'react';
import { debugLog } from '../utils/debug';

// Advanced custom element management with scoping and feature detection
class AdvancedCustomElementManager {
  private static instance: AdvancedCustomElementManager;
  private definedElements = new Map<string, any>();
  private originalDefine?: typeof window.customElements.define;
  private originalGet?: typeof window.customElements.get;
  private isInitialized = false;

  private constructor() {
    if (typeof window !== 'undefined' && window.customElements) {
      this.originalDefine = window.customElements.define.bind(window.customElements);
      this.originalGet = window.customElements.get.bind(window.customElements);
    }
  }

  public static getInstance(): AdvancedCustomElementManager {
    if (!AdvancedCustomElementManager.instance) {
      AdvancedCustomElementManager.instance = new AdvancedCustomElementManager();
    }
    return AdvancedCustomElementManager.instance;
  }

  public initialize() {
    if (this.isInitialized || typeof window === 'undefined' || !window.customElements) {
      return;
    }

    this.setupCustomElementOverrides();
    this.isInitialized = true;
  }

  private setupCustomElementOverrides() {
    // Enhanced define override with namespacing and conflict resolution
    window.customElements.define = (name: string, constructor: any, options?: any) => {
      try {
        // Check for existing definition using multiple methods
        const existing = this.getExistingElement(name);
        if (existing) {
          debugLog.warn(`Custom element '${name}' already defined, using existing definition`);
          return existing;
        }

        // Validate element name format
        if (!this.isValidElementName(name)) {
          debugLog.error(`Invalid custom element name: ${name}`);
          throw new Error(`Invalid custom element name: ${name}`);
        }

        // Add scoping for known problematic elements
        const scopedName = this.getScopedName(name);
        if (scopedName !== name) {
          debugLog.info(`Scoping element '${name}' to '${scopedName}'`);
        }

        // Attempt to define with error handling and retries
        const result = this.safeDefine(scopedName, constructor, options);
        this.definedElements.set(name, result);
        
        debugLog.info(`Custom element '${name}' defined successfully`);
        return result;
        
      } catch (error: any) {
        return this.handleDefineError(name, constructor, options, error);
      }
    };

    // Enhanced get override with fallback mechanisms
    window.customElements.get = (name: string) => {
      try {
        // Check our cache first
        if (this.definedElements.has(name)) {
          return this.definedElements.get(name);
        }

        // Try original get
        if (this.originalGet) {
          const result = this.originalGet(name);
          if (result) {
            this.definedElements.set(name, result);
          }
          return result;
        }
      } catch (error) {
        debugLog.warn(`Error getting custom element '${name}':`, error);
        return undefined;
      }
    };
  }

  private getExistingElement(name: string): any {
    // Multiple methods to check for existing elements
    try {
      // Method 1: Check our cache
      if (this.definedElements.has(name)) {
        return this.definedElements.get(name);
      }

      // Method 2: Use original get method
      if (this.originalGet) {
        const existing = this.originalGet(name);
        if (existing) {
          this.definedElements.set(name, existing);
          return existing;
        }
      }

      // Method 3: Check if name is in registry
      if (typeof window.customElements.get === 'function') {
        return window.customElements.get(name);
      }

      return null;
    } catch (error) {
      debugLog.warn(`Error checking existing element ${name}:`, error);
      return null;
    }
  }

  private isValidElementName(name: string): boolean {
    // Custom element names must contain a hyphen and be lowercase
    return /^[a-z][a-z0-9]*(-[a-z0-9]+)+$/.test(name);
  }

  private getScopedName(name: string): string {
    // Add scoping to problematic elements
    const problematicElements = [
      'mce-autosize-textarea',
      'tinymce-editor',
      'rich-text-editor',
    ];

    if (problematicElements.includes(name)) {
      // Add application prefix to avoid conflicts
      return `maga-${name}`;
    }

    return name;
  }

  private safeDefine(name: string, constructor: any, options?: any): any {
    let retries = 3;
    let lastError: Error = new Error('Failed to define element');

    while (retries > 0) {
      try {
        if (this.originalDefine) {
          return this.originalDefine(name, constructor, options);
        } else {
          throw new Error('Original define method not available');
        }
      } catch (error: any) {
        lastError = error;
        retries--;

        if (this.isRecoverableError(error)) {
          debugLog.warn(`Define attempt failed for ${name}, retrying... (${retries} left)`);
          // Wait a bit before retry
          const delay = (4 - retries) * 100; // 100ms, 200ms, 300ms
          this.sleep(delay);
          continue;
        } else {
          // Non-recoverable error, break out
          break;
        }
      }
    }

    throw lastError;
  }

  private isRecoverableError(error: Error): boolean {
    const message = error.message;
    return message.includes('network') || 
           message.includes('timeout') ||
           message.includes('temporary');
  }

  private sleep(ms: number): void {
    const start = Date.now();
    while (Date.now() - start < ms) {
      // Busy wait for small delays
    }
  }

  private handleDefineError(name: string, constructor: any, options: any, error: Error): any {
    const message = error.message || '';
    
    if (message.includes('already been defined') || 
        message.includes('already defined') ||
        name === 'mce-autosize-textarea') {
      
      debugLog.warn(`Custom element '${name}' already defined, returning existing:`, message);
      
      // Try to get the existing element
      const existing = this.getExistingElement(name);
      if (existing) {
        this.definedElements.set(name, existing);
        return existing;
      }
    }

    // For other errors, log and re-throw
    debugLog.error(`Failed to define custom element '${name}':`, error);
    throw error;
  }

  public cleanup() {
    if (!this.isInitialized) return;

    // Restore original methods
    if (window.customElements && this.originalDefine) {
      window.customElements.define = this.originalDefine;
    }
    if (window.customElements && this.originalGet) {
      window.customElements.get = this.originalGet;
    }

    this.definedElements.clear();
    this.isInitialized = false;
  }
}

export const WebComponentGuard: React.FC = () => {
  useEffect(() => {
    const manager = AdvancedCustomElementManager.getInstance();
    manager.initialize();

    // Enhanced error handlers for multiple error types
    const handleCustomElementError = (error: ErrorEvent) => {
      const message = error.message || '';
      
      // Handle custom element conflicts
      if (message.includes('already been defined') || 
          message.includes('mce-autosize-textarea') ||
          message.includes('custom element')) {
        debugLog.warn('Custom element error handled:', message);
        error.preventDefault();
        return true;
      }
      
      // Handle wallet adapter null reference errors
      if (message.includes('Cannot read properties of null') ||
          message.includes('Cannot read property \'type\' of null') ||
          message.includes('Cannot set property ethereum') ||
          message.includes('Cannot redefine property')) {
        debugLog.warn('Wallet/Ethereum provider error handled:', message);
        error.preventDefault();
        return true;
      }
      
      // Handle tooltip null reference errors
      if (message.includes('getBoundingClientRect') ||
          message.includes('currentTarget is null')) {
        debugLog.warn('Tooltip null reference error handled:', message);
        error.preventDefault();
        return true;
      }
      
      return false;
    };

    // Add unhandled promise rejection handler
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (event.reason && event.reason.message) {
        const message = event.reason.message;
        
        // Handle various known issues
        const knownIssues = [
          'already been defined',
          'mce-autosize-textarea',
          'custom element',
          'Cannot read properties of null',
          'Cannot read property \'type\' of null',
          'Cannot set property ethereum',
          'Cannot redefine property',
          'wallet adapter',
          'getBoundingClientRect',
          'currentTarget is null'
        ];

        if (knownIssues.some(issue => message.includes(issue))) {
          debugLog.warn('Promise rejection handled:', message);
          event.preventDefault();
          return true;
        }
      }
      
      return false;
    };

    window.addEventListener('error', handleCustomElementError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // Cleanup
    return () => {
      window.removeEventListener('error', handleCustomElementError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      manager.cleanup();
    };
  }, []);

  return null;
};