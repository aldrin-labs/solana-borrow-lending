/**
 * Tests for platform utilities
 * Ensures error handling and browser protections work correctly
 */

import {
  CustomElementProtection,
  WalletError,
  WalletErrorType,
  AppError,
  AppErrorType,
  initializePlatformProtections,
  isBrowser,
  isServiceWorkerSupported,
  isSecureContext,
  safeExecute,
} from '../utils/platformUtils';

// Mock DOM APIs for testing
const mockCustomElements = {
  define: jest.fn(),
  get: jest.fn(),
};

const mockWindow = {
  customElements: mockCustomElements,
  navigator: { serviceWorker: {} },
  location: { protocol: 'https:' },
  isSecureContext: true,
};

// Setup global mocks
beforeAll(() => {
  global.customElements = mockCustomElements;
  global.window = mockWindow as any;
  global.document = {} as any;
});

describe('platformUtils', () => {
  describe('CustomElementProtection', () => {
    beforeEach(() => {
      CustomElementProtection.reset();
      mockCustomElements.define.mockClear();
      mockCustomElements.get.mockReturnValue(undefined);
    });

    it('should prevent re-definition of custom elements', () => {
      CustomElementProtection.initialize();
      
      // First definition should succeed
      customElements.define('test-element', class extends HTMLElement {});
      expect(mockCustomElements.define).toHaveBeenCalledTimes(1);
      
      // Second definition should be prevented
      customElements.define('test-element', class extends HTMLElement {});
      expect(mockCustomElements.define).toHaveBeenCalledTimes(1); // Still only called once
    });

    it('should handle DOMException for already defined elements', () => {
      const mockError = new DOMException('Element already been defined', 'NotSupportedError');
      mockCustomElements.define.mockImplementationOnce(() => {
        throw mockError;
      });

      CustomElementProtection.initialize();
      
      // Should not throw and should mark as defined
      expect(() => {
        customElements.define('existing-element', class extends HTMLElement {});
      }).not.toThrow();
      
      expect(CustomElementProtection.isElementDefined('existing-element')).toBe(true);
    });

    it('should check if element is defined', () => {
      CustomElementProtection.initialize();
      
      expect(CustomElementProtection.isElementDefined('undefined-element')).toBe(false);
      
      customElements.define('defined-element', class extends HTMLElement {});
      expect(CustomElementProtection.isElementDefined('defined-element')).toBe(true);
    });
  });

  describe('WalletError', () => {
    it('should classify user rejection errors', () => {
      const error = new Error('User rejected the request');
      const walletError = WalletError.fromError(error);
      
      expect(walletError.type).toBe(WalletErrorType.USER_REJECTED);
      expect(walletError.isUserRejection()).toBe(true);
      expect(walletError.isRecoverable()).toBe(false);
    });

    it('should classify insufficient funds errors', () => {
      const error = new Error('insufficient funds for transaction');
      const walletError = WalletError.fromError(error);
      
      expect(walletError.type).toBe(WalletErrorType.INSUFFICIENT_FUNDS);
      expect(walletError.isRecoverable()).toBe(false);
    });

    it('should classify network errors', () => {
      const error = new Error('Network request failed');
      const walletError = WalletError.fromError(error);
      
      expect(walletError.type).toBe(WalletErrorType.NETWORK_ERROR);
      expect(walletError.isNetworkError()).toBe(true);
      expect(walletError.isRecoverable()).toBe(true);
    });

    it('should preserve existing WalletError instances', () => {
      const originalError = new WalletError(
        WalletErrorType.CONNECTION_FAILED,
        'Connection failed',
        'CONN_001'
      );
      
      const result = WalletError.fromError(originalError);
      expect(result).toBe(originalError);
    });

    it('should handle code-based classification', () => {
      const error = { message: 'Request failed', code: 4001 };
      const walletError = WalletError.fromError(error);
      
      expect(walletError.type).toBe(WalletErrorType.USER_REJECTED);
      expect(walletError.code).toBe(4001);
    });
  });

  describe('AppError', () => {
    it('should classify network errors', () => {
      const error = new Error('Failed to fetch data from server');
      const appError = AppError.fromError(error);
      
      expect(appError.type).toBe(AppErrorType.NETWORK_ERROR);
    });

    it('should classify validation errors', () => {
      const error = new Error('Invalid input provided');
      const appError = AppError.fromError(error);
      
      expect(appError.type).toBe(AppErrorType.VALIDATION_ERROR);
    });

    it('should classify component errors', () => {
      const error = new Error('Loading chunk 123 failed');
      const appError = AppError.fromError(error);
      
      expect(appError.type).toBe(AppErrorType.COMPONENT_ERROR);
    });

    it('should not convert WalletError to AppError', () => {
      const walletError = new WalletError(
        WalletErrorType.CONNECTION_FAILED,
        'Wallet connection failed'
      );
      
      const result = AppError.fromError(walletError);
      expect(result).toBe(walletError); // Should return the same instance
    });

    it('should preserve existing AppError instances', () => {
      const originalError = new AppError(
        AppErrorType.DATA_FETCH_ERROR,
        'Failed to fetch market data'
      );
      
      const result = AppError.fromError(originalError);
      expect(result).toBe(originalError);
    });
  });

  describe('Environment detection', () => {
    it('should detect browser environment', () => {
      expect(isBrowser()).toBe(true);
    });

    it('should detect service worker support', () => {
      expect(isServiceWorkerSupported()).toBe(true);
    });

    it('should detect secure context', () => {
      expect(isSecureContext()).toBe(true);
    });
  });

  describe('safeExecute', () => {
    it('should execute function and return result', () => {
      const result = safeExecute(() => 42);
      expect(result).toBe(42);
    });

    it('should return fallback on error', () => {
      const result = safeExecute(() => {
        throw new Error('Test error');
      }, 'fallback');
      
      expect(result).toBe('fallback');
    });

    it('should return undefined when no fallback provided', () => {
      const result = safeExecute(() => {
        throw new Error('Test error');
      });
      
      expect(result).toBeUndefined();
    });
  });

  describe('initializePlatformProtections', () => {
    it('should initialize without errors', () => {
      expect(() => {
        initializePlatformProtections();
      }).not.toThrow();
    });

    it('should add unhandled rejection handler', () => {
      const addEventListenerSpy = jest.spyOn(window, 'addEventListener');
      
      initializePlatformProtections();
      
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'unhandledrejection',
        expect.any(Function)
      );
      
      addEventListenerSpy.mockRestore();
    });
  });
});