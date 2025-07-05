/**
 * Comprehensive test suite for CustomElementGuard
 */

import { CustomElementGuard, initializeCustomElementProtection, useCustomElementGuard } from './index';

// Mock DOM environment
Object.defineProperty(window, 'customElements', {
  value: {
    define: jest.fn(),
    get: jest.fn(),
  },
  writable: true,
});

describe('CustomElementGuard', () => {
  let originalDefine: jest.Mock;
  let originalGet: jest.Mock;

  beforeEach(() => {
    originalDefine = jest.fn();
    originalGet = jest.fn();
    
    (window as any).customElements = {
      define: originalDefine,
      get: originalGet,
    };

    // Reset singleton
    (CustomElementGuard as any).instance = null;
  });

  afterEach(() => {
    // Clean up any existing guards
    const guard = (CustomElementGuard as any).instance;
    if (guard) {
      guard.destroy();
    }
  });

  describe('Singleton Pattern', () => {
    it('should return same instance when called multiple times', () => {
      const guard1 = CustomElementGuard.getInstance();
      const guard2 = CustomElementGuard.getInstance();
      
      expect(guard1).toBe(guard2);
    });

    it('should accept configuration on first call', () => {
      const config = { debug: true, scope: 'test' };
      const guard = CustomElementGuard.getInstance(config);
      
      expect(guard['config'].debug).toBe(true);
      expect(guard['config'].scope).toBe('test');
    });
  });

  describe('Initialization', () => {
    it('should override customElements.define', () => {
      const guard = new CustomElementGuard();
      guard.initialize();
      
      expect(typeof customElements.define).toBe('function');
      expect(customElements.define).not.toBe(originalDefine);
    });

    it('should not initialize multiple times', () => {
      const guard = new CustomElementGuard();
      guard.initialize();
      guard.initialize();
      
      // Should only store original define once
      expect(guard['originalDefine']).toBe(originalDefine);
    });

    it('should handle missing customElements gracefully', () => {
      delete (window as any).customElements;
      
      const guard = new CustomElementGuard();
      expect(() => guard.initialize()).not.toThrow();
    });
  });

  describe('Element Definition', () => {
    let guard: CustomElementGuard;
    
    beforeEach(() => {
      guard = new CustomElementGuard({ debug: true });
      guard.initialize();
    });

    it('should successfully define new elements', () => {
      class TestElement extends HTMLElement {}
      
      customElements.define('test-element', TestElement);
      
      expect(originalDefine).toHaveBeenCalledWith('test-element', TestElement, undefined);
      expect(guard.isElementDefined('test-element')).toBe(true);
    });

    it('should skip already defined elements', () => {
      originalGet.mockReturnValue(class ExistingElement extends HTMLElement {});
      
      class TestElement extends HTMLElement {}
      const result = customElements.define('existing-element', TestElement);
      
      expect(originalDefine).not.toHaveBeenCalled();
      expect(result.existed).toBe(true);
      expect(result.success).toBe(false);
    });

    it('should handle scoped elements', () => {
      const scopedGuard = new CustomElementGuard({ scope: 'maga' });
      scopedGuard.initialize();
      
      class TestElement extends HTMLElement {}
      customElements.define('button', TestElement);
      
      expect(originalDefine).toHaveBeenCalledWith('maga-button', TestElement, undefined);
    });

    it('should handle DOMException for already defined elements', () => {
      originalDefine.mockImplementation(() => {
        throw new DOMException('already been defined');
      });
      
      class TestElement extends HTMLElement {}
      const result = customElements.define('duplicate-element', TestElement);
      
      expect(result.existed).toBe(true);
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(DOMException);
    });
  });

  describe('Conflict Resolution Strategies', () => {
    it('should skip conflicts by default', () => {
      const guard = new CustomElementGuard({ conflictStrategy: 'skip' });
      guard.initialize();
      
      originalGet.mockReturnValue(class ExistingElement extends HTMLElement {});
      
      class TestElement extends HTMLElement {}
      expect(() => customElements.define('existing', TestElement)).not.toThrow();
    });

    it('should throw on conflicts when configured', () => {
      const guard = new CustomElementGuard({ conflictStrategy: 'throw' });
      guard.initialize();
      
      originalGet.mockReturnValue(class ExistingElement extends HTMLElement {});
      
      class TestElement extends HTMLElement {}
      expect(() => customElements.define('existing', TestElement)).toThrow();
    });

    it('should call onConflict callback', () => {
      const onConflict = jest.fn();
      const guard = new CustomElementGuard({ onConflict });
      guard.initialize();
      
      originalGet.mockReturnValue(class ExistingElement extends HTMLElement {});
      
      class TestElement extends HTMLElement {}
      customElements.define('existing', TestElement);
      
      expect(onConflict).toHaveBeenCalledWith('existing', expect.any(Error));
    });
  });

  describe('Retry Logic', () => {
    it('should retry failed definitions', async () => {
      const guard = new CustomElementGuard({ 
        conflictStrategy: 'retry',
        maxRetries: 2,
        retryDelay: 10
      });
      guard.initialize();
      
      let attempts = 0;
      originalDefine.mockImplementation(() => {
        attempts++;
        if (attempts < 2) {
          throw new Error('Transient error');
        }
      });
      
      class TestElement extends HTMLElement {}
      const result = await new Promise(resolve => {
        const defineResult = customElements.define('retry-element', TestElement);
        setTimeout(() => resolve(defineResult), 50);
      });
      
      expect(attempts).toBe(2);
    });
  });

  describe('Statistics Tracking', () => {
    it('should track definition attempts', () => {
      const guard = new CustomElementGuard();
      guard.initialize();
      
      class TestElement extends HTMLElement {}
      customElements.define('stats-element', TestElement);
      
      const stats = guard.getStatistics();
      expect(stats.totalAttempts).toBe(1);
      expect(stats.successfulDefinitions).toBe(1);
      expect(stats.elementsTracked.has('stats-element')).toBe(true);
    });

    it('should track conflicts', () => {
      const guard = new CustomElementGuard();
      guard.initialize();
      
      originalGet.mockReturnValue(class ExistingElement extends HTMLElement {});
      
      class TestElement extends HTMLElement {}
      customElements.define('conflict-element', TestElement);
      
      const stats = guard.getStatistics();
      expect(stats.skippedConflicts).toBe(1);
    });
  });

  describe('Utility Functions', () => {
    it('should detect custom elements support', () => {
      expect(CustomElementGuard.isSupported()).toBe(true);
      
      delete (window as any).customElements;
      expect(CustomElementGuard.isSupported()).toBe(false);
    });

    it('should create scoped guards', () => {
      const scopedGuard = CustomElementGuard.createScopedGuard('test-scope', { debug: true });
      expect(scopedGuard['config'].scope).toBe('test-scope');
      expect(scopedGuard['config'].debug).toBe(true);
    });
  });

  describe('Cleanup and Reset', () => {
    it('should reset guard state', () => {
      const guard = new CustomElementGuard();
      guard.initialize();
      
      class TestElement extends HTMLElement {}
      customElements.define('reset-element', TestElement);
      
      guard.reset();
      
      expect(customElements.define).toBe(originalDefine);
      expect(guard.isElementDefined('reset-element')).toBe(false);
    });

    it('should destroy guard completely', () => {
      const guard = CustomElementGuard.getInstance();
      guard.initialize();
      
      guard.destroy();
      
      expect((CustomElementGuard as any).instance).toBeNull();
    });
  });
});

describe('Convenience Functions', () => {
  beforeEach(() => {
    (window as any).customElements = {
      define: jest.fn(),
      get: jest.fn(),
    };
  });

  it('should initialize protection with default settings', () => {
    const guard = initializeCustomElementProtection();
    expect(guard).toBeInstanceOf(CustomElementGuard);
    expect(guard['isInitialized']).toBe(true);
  });

  it('should work with React hook pattern', () => {
    const hookResult = useCustomElementGuard({ debug: true });
    
    expect(hookResult).toHaveProperty('guard');
    expect(hookResult).toHaveProperty('isElementDefined');
    expect(hookResult).toHaveProperty('getStatistics');
    expect(typeof hookResult!.isElementDefined).toBe('function');
  });

  it('should return null in SSR environment', () => {
    const originalWindow = global.window;
    delete (global as any).window;
    
    const hookResult = useCustomElementGuard();
    expect(hookResult).toBeNull();
    
    global.window = originalWindow;
  });
});

describe('Edge Cases', () => {
  it('should handle malformed element names gracefully', () => {
    const guard = new CustomElementGuard();
    guard.initialize();
    
    class TestElement extends HTMLElement {}
    
    // Should not crash with invalid names
    expect(() => {
      customElements.define('', TestElement);
    }).not.toThrow();
  });

  it('should handle custom element constructor errors', () => {
    const guard = new CustomElementGuard();
    guard.initialize();
    
    const originalDefine = jest.spyOn(customElements, 'define');
    originalDefine.mockImplementation(() => {
      throw new Error('Constructor error');
    });
    
    class TestElement extends HTMLElement {}
    
    expect(() => {
      customElements.define('error-element', TestElement);
    }).not.toThrow();
    
    originalDefine.mockRestore();
  });
});