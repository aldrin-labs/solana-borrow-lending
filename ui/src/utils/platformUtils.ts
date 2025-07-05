/**
 * Platform utilities for handling browser-specific issues and protections
 * Consolidates wallet adapter and custom element handling
 */

import { ERROR_CODES } from './constants';

// Custom Element Protection
export class CustomElementProtection {
  private static definedElements = new Set<string>();
  private static originalDefine: typeof customElements.define;

  static initialize(): void {
    // Only initialize once to prevent multiple overrides
    if (this.originalDefine !== undefined) {
      return;
    }

    this.originalDefine = customElements.define;
    
    // Override customElements.define to prevent re-definition errors
    customElements.define = function(name: string, constructor: CustomElementConstructor, options?: ElementDefinitionOptions) {
      if (CustomElementProtection.definedElements.has(name)) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`[CustomElementProtection] Prevented re-definition of custom element: ${name}`);
        }
        return;
      }

      try {
        CustomElementProtection.originalDefine.call(this, name, constructor, options);
        CustomElementProtection.definedElements.add(name);
      } catch (error) {
        // Silently handle already defined elements
        if (error instanceof DOMException && error.message.includes('already been defined')) {
          CustomElementProtection.definedElements.add(name);
          if (process.env.NODE_ENV === 'development') {
            console.warn(`[CustomElementProtection] Element ${name} already defined, skipping`);
          }
        } else {
          console.error(`[CustomElementProtection] Error defining custom element ${name}:`, error);
        }
      }
    };
  }

  static isElementDefined(name: string): boolean {
    return this.definedElements.has(name) || customElements.get(name) !== undefined;
  }

  static reset(): void {
    // For testing purposes
    this.definedElements.clear();
    if (this.originalDefine) {
      customElements.define = this.originalDefine;
    }
  }
}

// Ethereum Provider Protection
export class EthereumProviderProtection {
  private static isProtected = false;

  static initialize(): void {
    if (this.isProtected || typeof window === 'undefined') {
      return;
    }

    try {
      // Protect against ethereum provider conflicts
      const originalDescriptor = Object.getOwnPropertyDescriptor(window, 'ethereum');
      
      if (originalDescriptor && !originalDescriptor.configurable) {
        // ethereum property is already non-configurable, likely set by another wallet
        this.isProtected = true;
        return;
      }

      // Create a protected property that can handle multiple wallet injections
      let ethereumProvider: any = null;
      
      Object.defineProperty(window, 'ethereum', {
        get() {
          return ethereumProvider;
        },
        set(value) {
          // Only set if not already set or if the new value is more complete
          if (!ethereumProvider || (value && Object.keys(value).length > Object.keys(ethereumProvider).length)) {
            ethereumProvider = value;
          }
        },
        configurable: true,
        enumerable: true
      });

      this.isProtected = true;
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[EthereumProviderProtection] Could not protect ethereum provider:', error);
      }
    }
  }
}

// Wallet Error Classification
export enum WalletErrorType {
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  DISCONNECTION_FAILED = 'DISCONNECTION_FAILED',
  SIGN_TRANSACTION_FAILED = 'SIGN_TRANSACTION_FAILED',
  SEND_TRANSACTION_FAILED = 'SEND_TRANSACTION_FAILED',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  USER_REJECTED = 'USER_REJECTED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export class WalletError extends Error {
  public readonly type: WalletErrorType;
  public readonly code?: string | number;
  public readonly originalError?: Error;

  constructor(
    type: WalletErrorType,
    message: string,
    code?: string | number,
    originalError?: Error
  ) {
    super(message);
    this.name = 'WalletError';
    this.type = type;
    this.code = code;
    this.originalError = originalError;
  }

  static fromError(error: any): WalletError {
    if (error instanceof WalletError) {
      return error;
    }

    const message = error?.message || 'Unknown wallet error';
    const code = error?.code || error?.name;

    // Classify common wallet errors
    if (message.includes('User rejected') || code === 4001) {
      return new WalletError(WalletErrorType.USER_REJECTED, message, code, error);
    }

    if (message.includes('insufficient funds') || message.includes('Insufficient funds')) {
      return new WalletError(WalletErrorType.INSUFFICIENT_FUNDS, message, code, error);
    }

    if (message.includes('network') || message.includes('Network')) {
      return new WalletError(WalletErrorType.NETWORK_ERROR, message, code, error);
    }

    if (message.includes('connect') || message.includes('Connect')) {
      return new WalletError(WalletErrorType.CONNECTION_FAILED, message, code, error);
    }

    if (message.includes('sign') || message.includes('Sign')) {
      return new WalletError(WalletErrorType.SIGN_TRANSACTION_FAILED, message, code, error);
    }

    return new WalletError(WalletErrorType.UNKNOWN_ERROR, message, code, error);
  }

  isUserRejection(): boolean {
    return this.type === WalletErrorType.USER_REJECTED;
  }

  isNetworkError(): boolean {
    return this.type === WalletErrorType.NETWORK_ERROR;
  }

  isRecoverable(): boolean {
    return ![
      WalletErrorType.USER_REJECTED,
      WalletErrorType.INSUFFICIENT_FUNDS,
    ].includes(this.type);
  }
}

// General Application Error Classification
export enum AppErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  DATA_FETCH_ERROR = 'DATA_FETCH_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  COMPONENT_ERROR = 'COMPONENT_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export class AppError extends Error {
  public readonly type: AppErrorType;
  public readonly code?: string;
  public readonly originalError?: Error;

  constructor(
    type: AppErrorType,
    message: string,
    code?: string,
    originalError?: Error
  ) {
    super(message);
    this.name = 'AppError';
    this.type = type;
    this.code = code;
    this.originalError = originalError;
  }

  static fromError(error: any): AppError | WalletError {
    if (error instanceof AppError) {
      return error;
    }

    const message = error?.message || 'Unknown application error';
    const code = error?.code || error?.name;

    // Don't convert wallet errors to app errors
    if (error instanceof WalletError) {
      return error;
    }

    // Classify common app errors
    if (message.includes('fetch') || message.includes('network') || code === 'NETWORK_ERROR') {
      return new AppError(AppErrorType.NETWORK_ERROR, message, code, error);
    }

    if (message.includes('validation') || message.includes('invalid')) {
      return new AppError(AppErrorType.VALIDATION_ERROR, message, code, error);
    }

    if (error?.name === 'ChunkLoadError' || message.includes('Loading chunk')) {
      return new AppError(AppErrorType.COMPONENT_ERROR, message, code, error);
    }

    return new AppError(AppErrorType.UNKNOWN_ERROR, message, code, error);
  }
}

// Platform initialization function
export const initializePlatformProtections = (): void => {
  if (typeof window === 'undefined') {
    return;
  }

  // Initialize all protections
  CustomElementProtection.initialize();
  EthereumProviderProtection.initialize();

  // Global error handler for unhandled promises
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason;
    
    // Handle wallet errors gracefully
    if (error instanceof WalletError && error.isUserRejection()) {
      event.preventDefault(); // Prevent console logging for user rejections
      return;
    }

    // Log other errors for debugging
    if (process.env.NODE_ENV === 'development') {
      console.error('[Platform] Unhandled promise rejection:', error);
    }
  });
};

// Utility to check if we're in a browser environment
export const isBrowser = (): boolean => {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
};

// Utility to check if service workers are supported
export const isServiceWorkerSupported = (): boolean => {
  return isBrowser() && 'serviceWorker' in navigator;
};

// Utility to check if we're in a secure context (required for some features)
export const isSecureContext = (): boolean => {
  return isBrowser() && (window.isSecureContext || window.location.protocol === 'https:');
};

// Utility to safely execute code that requires browser APIs
export const safeExecute = <T>(
  fn: () => T,
  fallback?: T
): T | undefined => {
  if (!isBrowser()) {
    return fallback;
  }

  try {
    return fn();
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Platform] Safe execution failed:', error);
    }
    return fallback;
  }
};