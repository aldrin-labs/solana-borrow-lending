/**
 * Performance utility for animations and device capability detection
 * Optimizes animations based on device capabilities and user preferences
 */

// Performance monitoring and device capability detection
export class PerformanceManager {
  private static instance: PerformanceManager;
  private deviceCapabilities: {
    isLowEndDevice: boolean;
    hasReducedMotion: boolean;
    supportsCSSAnimations: boolean;
    supportsWebGL: boolean;
    memoryInfo?: any;
  };

  private constructor() {
    this.deviceCapabilities = this.detectDeviceCapabilities();
    this.setupPerformanceMonitoring();
  }

  public static getInstance(): PerformanceManager {
    if (!PerformanceManager.instance) {
      PerformanceManager.instance = new PerformanceManager();
    }
    return PerformanceManager.instance;
  }

  private detectDeviceCapabilities() {
    const capabilities = {
      isLowEndDevice: false,
      hasReducedMotion: false,
      supportsCSSAnimations: true,
      supportsWebGL: false,
      memoryInfo: undefined,
    };

    // Check for reduced motion preference
    if (typeof window !== 'undefined') {
      capabilities.hasReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      
      // Check CSS animation support
      const testElement = document.createElement('div');
      capabilities.supportsCSSAnimations = 
        'animationName' in testElement.style ||
        'webkitAnimationName' in testElement.style;

      // Check WebGL support
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      capabilities.supportsWebGL = !!gl;

      // Memory information (Chrome only)
      if ('memory' in performance) {
        capabilities.memoryInfo = (performance as any).memory;
      }

      // Device detection heuristics
      const hardwareConcurrency = navigator.hardwareConcurrency || 2;
      const deviceMemory = (navigator as any).deviceMemory || 4;
      
      // Consider device low-end if:
      // - Less than 4 CPU cores
      // - Less than 4GB RAM
      // - User prefers reduced motion
      capabilities.isLowEndDevice = 
        hardwareConcurrency < 4 || 
        deviceMemory < 4 || 
        capabilities.hasReducedMotion;
    }

    return capabilities;
  }

  private setupPerformanceMonitoring() {
    if (typeof window === 'undefined') return;

    // Monitor frame rate
    let lastFrameTime = performance.now();
    let frameCount = 0;
    let avgFrameTime = 16.67; // Target 60fps

    const measureFrameRate = () => {
      const now = performance.now();
      const delta = now - lastFrameTime;
      lastFrameTime = now;
      frameCount++;

      // Moving average of frame times
      avgFrameTime = (avgFrameTime * 0.9) + (delta * 0.1);

      // If frame rate drops below 30fps consistently, consider device struggling
      if (frameCount > 60 && avgFrameTime > 33) {
        this.deviceCapabilities.isLowEndDevice = true;
      }

      requestAnimationFrame(measureFrameRate);
    };

    requestAnimationFrame(measureFrameRate);
  }

  // Get optimized animation config based on device capabilities
  public getAnimationConfig() {
    const { isLowEndDevice, hasReducedMotion, supportsCSSAnimations } = this.deviceCapabilities;

    if (hasReducedMotion) {
      return {
        enableAnimations: false,
        duration: 0,
        easing: 'linear',
        complexity: 'none',
      };
    }

    if (isLowEndDevice) {
      return {
        enableAnimations: supportsCSSAnimations,
        duration: 150, // Shorter durations
        easing: 'ease-out',
        complexity: 'minimal', // Simple transforms only
      };
    }

    return {
      enableAnimations: true,
      duration: 300,
      easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
      complexity: 'full', // All animations enabled
    };
  }

  // CSS classes based on performance capabilities
  public getPerformanceClasses(): string {
    const config = this.getAnimationConfig();
    const classes = [];

    if (!config.enableAnimations) {
      classes.push('reduce-motion');
    }

    if (this.deviceCapabilities.isLowEndDevice) {
      classes.push('low-end-device');
    }

    if (config.complexity === 'minimal') {
      classes.push('minimal-animations');
    }

    return classes.join(' ');
  }

  // Debounced function wrapper for performance
  public debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  // Throttled function wrapper for performance
  public throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean;
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  // Check if device can handle complex operations
  public canHandleComplexOperations(): boolean {
    return !this.deviceCapabilities.isLowEndDevice && 
           this.deviceCapabilities.supportsCSSAnimations;
  }

  // Get device information for debugging
  public getDeviceInfo() {
    return {
      ...this.deviceCapabilities,
      userAgent: navigator.userAgent,
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemory: (navigator as any).deviceMemory,
      connectionType: (navigator as any).connection?.effectiveType,
    };
  }
}

// Singleton instance
export const performanceManager = PerformanceManager.getInstance();

// CSS custom properties for dynamic animation configuration
export const injectPerformanceCSS = () => {
  if (typeof document === 'undefined') return;

  const config = performanceManager.getAnimationConfig();
  const root = document.documentElement;

  root.style.setProperty('--animation-duration', `${config.duration}ms`);
  root.style.setProperty('--animation-easing', config.easing);
  
  // Add performance classes to body
  document.body.className = 
    document.body.className.replace(/\b(reduce-motion|low-end-device|minimal-animations)\b/g, '').trim() +
    ' ' + performanceManager.getPerformanceClasses();
};