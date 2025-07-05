/**
 * @maga-finance/custom-element-guard
 * Production-ready custom element protection library
 * 
 * Prevents custom element re-definition errors that commonly occur when:
 * - Multiple libraries define the same custom element
 * - Hot reloading in development environments
 * - Browser extensions interfere with page elements
 * - Multiple instances of the same application run on a page
 */

export interface CustomElementGuardConfig {
  /**
   * Enable debug logging for development
   */
  debug?: boolean;
  
  /**
   * Prefix for scoped elements (helps avoid conflicts)
   */
  scope?: string;
  
  /**
   * Maximum retry attempts for element definition
   */
  maxRetries?: number;
  
  /**
   * Delay between retry attempts (ms)
   */
  retryDelay?: number;
  
  /**
   * Strategy for handling conflicts
   */
  conflictStrategy?: 'skip' | 'retry' | 'throw';
  
  /**
   * Custom conflict resolver function
   */
  onConflict?: (elementName: string, error: Error) => void;
}

export interface ElementDefinitionResult {
  success: boolean;
  elementName: string;
  existed: boolean;
  error?: Error;
  retryCount?: number;
}

export interface GuardStatistics {
  totalAttempts: number;
  successfulDefinitions: number;
  skippedConflicts: number;
  retriedDefinitions: number;
  failedDefinitions: number;
  elementsTracked: Set<string>;
}

/**
 * Advanced custom element protection with scoping and retry logic
 */
export class CustomElementGuard {
  private static instance: CustomElementGuard | null = null;
  private definedElements = new Set<string>();
  private originalDefine: typeof customElements.define | null = null;
  private config: Required<CustomElementGuardConfig>;
  private stats: GuardStatistics;
  private isInitialized = false;

  constructor(config: CustomElementGuardConfig = {}) {
    this.config = {
      debug: config.debug ?? false,
      scope: config.scope ?? '',
      maxRetries: config.maxRetries ?? 3,
      retryDelay: config.retryDelay ?? 100,
      conflictStrategy: config.conflictStrategy ?? 'skip',
      onConflict: config.onConflict ?? (() => {}),
    };

    this.stats = {
      totalAttempts: 0,
      successfulDefinitions: 0,
      skippedConflicts: 0,
      retriedDefinitions: 0,
      failedDefinitions: 0,
      elementsTracked: new Set(),
    };
  }

  /**
   * Get singleton instance with global configuration
   */
  static getInstance(config?: CustomElementGuardConfig): CustomElementGuard {
    if (!CustomElementGuard.instance) {
      CustomElementGuard.instance = new CustomElementGuard(config);
    }
    return CustomElementGuard.instance;
  }

  /**
   * Initialize the guard by overriding customElements.define
   */
  initialize(): void {
    if (this.isInitialized || typeof window === 'undefined' || !customElements) {
      return;
    }

    this.originalDefine = customElements.define;
    const self = this;

    customElements.define = function(
      name: string,
      constructor: CustomElementConstructor,
      options?: ElementDefinitionOptions
    ) {
      return self.safeDefine(name, constructor, options);
    };

    this.isInitialized = true;
    this.log(`CustomElementGuard initialized with scope: "${this.config.scope}"`);
  }

  /**
   * Safely define a custom element with conflict resolution
   */
  private safeDefine(
    name: string,
    constructor: CustomElementConstructor,
    options?: ElementDefinitionOptions
  ): ElementDefinitionResult {
    this.stats.totalAttempts++;
    
    const scopedName = this.getScopedName(name);
    
    if (this.isElementDefined(scopedName)) {
      this.stats.skippedConflicts++;
      this.log(`Element ${scopedName} already defined, skipping`);
      
      if (this.config.conflictStrategy === 'throw') {
        const error = new Error(`Custom element ${scopedName} already defined`);
        this.config.onConflict(scopedName, error);
        throw error;
      }
      
      this.config.onConflict(scopedName, new Error(`Element ${scopedName} already exists`));
      return {
        success: false,
        elementName: scopedName,
        existed: true,
      };
    }

    return this.attemptDefinition(scopedName, constructor, options);
  }

  /**
   * Attempt to define element with retry logic
   */
  private attemptDefinition(
    name: string,
    constructor: CustomElementConstructor,
    options?: ElementDefinitionOptions,
    retryCount = 0
  ): ElementDefinitionResult {
    try {
      if (this.originalDefine) {
        this.originalDefine.call(customElements, name, constructor, options);
      } else {
        throw new Error('Original customElements.define not available');
      }

      this.definedElements.add(name);
      this.stats.elementsTracked.add(name);
      this.stats.successfulDefinitions++;
      
      if (retryCount > 0) {
        this.stats.retriedDefinitions++;
      }

      this.log(`Successfully defined custom element: ${name}${retryCount > 0 ? ` (retry ${retryCount})` : ''}`);

      return {
        success: true,
        elementName: name,
        existed: false,
        retryCount,
      };
    } catch (error) {
      this.log(`Failed to define ${name}: ${error.message}`);

      if (error instanceof DOMException && error.message.includes('already been defined')) {
        // Element was defined by another script between our check and definition
        this.definedElements.add(name);
        this.stats.elementsTracked.add(name);
        this.stats.skippedConflicts++;
        return {
          success: false,
          elementName: name,
          existed: true,
          error: error as Error,
        };
      }

      // Retry logic for transient errors
      if (retryCount < this.config.maxRetries && this.config.conflictStrategy === 'retry') {
        this.log(`Retrying definition of ${name} (${retryCount + 1}/${this.config.maxRetries})`);
        
        return new Promise<ElementDefinitionResult>((resolve) => {
          setTimeout(() => {
            resolve(this.attemptDefinition(name, constructor, options, retryCount + 1));
          }, this.config.retryDelay);
        }) as any; // Type assertion for synchronous compatibility
      }

      this.stats.failedDefinitions++;
      this.config.onConflict(name, error as Error);

      if (this.config.conflictStrategy === 'throw') {
        throw error;
      }

      return {
        success: false,
        elementName: name,
        existed: false,
        error: error as Error,
        retryCount,
      };
    }
  }

  /**
   * Check if an element is already defined
   */
  isElementDefined(name: string): boolean {
    const scopedName = this.getScopedName(name);
    return this.definedElements.has(scopedName) || customElements.get(scopedName) !== undefined;
  }

  /**
   * Get scoped element name
   */
  private getScopedName(name: string): string {
    if (!this.config.scope || name.startsWith(this.config.scope)) {
      return name;
    }
    return `${this.config.scope}-${name}`;
  }

  /**
   * Get current statistics
   */
  getStatistics(): GuardStatistics {
    return {
      ...this.stats,
      elementsTracked: new Set(this.stats.elementsTracked),
    };
  }

  /**
   * Reset the guard and restore original define method
   */
  reset(): void {
    if (this.originalDefine && typeof customElements !== 'undefined') {
      customElements.define = this.originalDefine;
    }
    
    this.definedElements.clear();
    this.stats = {
      totalAttempts: 0,
      successfulDefinitions: 0,
      skippedConflicts: 0,
      retriedDefinitions: 0,
      failedDefinitions: 0,
      elementsTracked: new Set(),
    };
    
    this.isInitialized = false;
    this.log('CustomElementGuard reset');
  }

  /**
   * Clean up resources and disable protection
   */
  destroy(): void {
    this.reset();
    CustomElementGuard.instance = null;
    this.log('CustomElementGuard destroyed');
  }

  /**
   * Log debug messages
   */
  private log(message: string): void {
    if (this.config.debug) {
      console.log(`[CustomElementGuard] ${message}`);
    }
  }

  /**
   * Feature detection for custom elements support
   */
  static isSupported(): boolean {
    return typeof window !== 'undefined' && 
           typeof customElements !== 'undefined' && 
           typeof customElements.define === 'function';
  }

  /**
   * Create a scoped guard for a specific namespace
   */
  static createScopedGuard(scope: string, config?: Omit<CustomElementGuardConfig, 'scope'>): CustomElementGuard {
    return new CustomElementGuard({
      ...config,
      scope,
    });
  }
}

/**
 * Convenient function to initialize protection with default settings
 */
export function initializeCustomElementProtection(config?: CustomElementGuardConfig): CustomElementGuard {
  const guard = CustomElementGuard.getInstance(config);
  guard.initialize();
  return guard;
}

/**
 * Decorator for auto-protecting custom element definitions
 */
export function protectedCustomElement(config?: CustomElementGuardConfig) {
  return function<T extends CustomElementConstructor>(target: T, context?: any) {
    const guard = CustomElementGuard.getInstance(config);
    
    // Auto-initialize if not already done
    if (!guard['isInitialized']) {
      guard.initialize();
    }
    
    return target;
  };
}

/**
 * React hook for managing custom element protection
 */
export function useCustomElementGuard(config?: CustomElementGuardConfig) {
  if (typeof window === 'undefined') {
    return null;
  }

  const guard = CustomElementGuard.getInstance(config);
  
  // Initialize on first use
  if (!guard['isInitialized']) {
    guard.initialize();
  }

  return {
    guard,
    isElementDefined: (name: string) => guard.isElementDefined(name),
    getStatistics: () => guard.getStatistics(),
  };
}

// Export default instance for convenience
export default CustomElementGuard;