/**
 * Debug utility for conditional logging
 * Gates console logs behind environment flags for production builds
 */

const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';
const IS_DEBUG_ENABLED = process.env.NEXT_PUBLIC_DEBUG === 'true' || IS_DEVELOPMENT;

export const debugLog = {
  info: (message: string, ...args: any[]) => {
    if (IS_DEBUG_ENABLED) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  },
  
  warn: (message: string, ...args: any[]) => {
    if (IS_DEBUG_ENABLED) {
      console.warn(`[DEBUG] ${message}`, ...args);
    }
  },
  
  error: (message: string, ...args: any[]) => {
    // Always log errors, but prefix with debug info
    console.error(`[DEBUG] ${message}`, ...args);
  },
  
  serviceWorker: (message: string, ...args: any[]) => {
    if (IS_DEBUG_ENABLED) {
      console.log(`[Service Worker] ${message}`, ...args);
    }
  },
  
  wallet: (message: string, ...args: any[]) => {
    if (IS_DEBUG_ENABLED) {
      console.log(`[Wallet] ${message}`, ...args);
    }
  },
  
  network: (message: string, ...args: any[]) => {
    if (IS_DEBUG_ENABLED) {
      console.log(`[Network] ${message}`, ...args);
    }
  },
  
  // Utility to check if debugging is enabled
  isEnabled: () => IS_DEBUG_ENABLED,
  
  // Performance timing utility
  time: (label: string) => {
    if (IS_DEBUG_ENABLED) {
      console.time(`[DEBUG] ${label}`);
    }
  },
  
  timeEnd: (label: string) => {
    if (IS_DEBUG_ENABLED) {
      console.timeEnd(`[DEBUG] ${label}`);
    }
  }
};

// Export for compatibility
export default debugLog;