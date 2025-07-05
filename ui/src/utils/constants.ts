/**
 * Application constants and configuration values
 * Centralizes magic numbers and thresholds for better maintainability
 */

// Health Factor and Risk Management
export const HEALTH_FACTOR = {
  CRITICAL_THRESHOLD: 1.0,
  WARNING_THRESHOLD: 1.2,
  SAFE_THRESHOLD: 1.5,
  EXCELLENT_THRESHOLD: 2.0,
  DEFAULT_VALUE: 1.85,
  VARIANCE_RANGE: 0.3, // ±0.15 for realistic simulation
} as const;

// Liquidation and Collateral
export const LIQUIDATION = {
  THRESHOLD_PERCENTAGE: 80,
  PENALTY_PERCENTAGE: 5,
  GRACE_PERIOD_HOURS: 24,
} as const;

// APY and Interest Rate Configuration
export const INTEREST_RATES = {
  BASE_SUPPLY_APY: {
    MIN: 1.0,
    MAX: 5.0,
    MULTIPLIER: 4.0, // Based on utilization rate
  },
  BORROW_APY_MULTIPLIER: 1.5,
  ADDITIONAL_BORROW_VARIANCE: 2.0,
  UTILIZATION_RATE: {
    MIN: 40,
    MAX: 70,
    OPTIMAL: 50,
  },
} as const;

// Price Variance for Realistic Simulation
export const PRICE_VARIANCE = {
  SOL: { BASE: 100, RANGE: 10 }, // $100 ± $5
  USDC: { BASE: 1.0, RANGE: 0.01 }, // $1.00 ± $0.005
  USDT: { BASE: 1.0, RANGE: 0.01 }, // $1.00 ± $0.005  
  ETH: { BASE: 2500, RANGE: 100 }, // $2500 ± $50
  BTC: { BASE: 45000, RANGE: 1000 }, // $45000 ± $500
} as const;

// Cache Configuration
export const CACHE = {
  DURATION_MS: 30000, // 30 seconds
  TOKEN_PRICES_KEY: 'tokenPrices',
  MARKET_DATA_KEY: 'marketData',
  PROTOCOL_ANALYTICS_KEY: 'protocolAnalytics',
  USER_POSITIONS_PREFIX: 'userPositions_',
} as const;

// Data Refresh Intervals
export const REFRESH_INTERVALS = {
  REAL_TIME_DATA_MS: 15000, // 15 seconds
  ANALYTICS_DATA_MS: 60000, // 1 minute
  PRICE_DATA_MS: 10000, // 10 seconds
  CONNECTION_HEALTH_MS: 30000, // 30 seconds
} as const;

// Network and Connection Settings
export const NETWORK = {
  COMMITMENT: 'confirmed' as const,
  CONFIRMATION_TIMEOUT_MS: 30000,
  HEALTH_CHECK_TIMEOUT_MS: 5000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 1000,
} as const;

// UI Animation and Interaction
export const ANIMATION = {
  TOOLTIP_DELAY_MS: 300,
  TRANSITION_DURATION_MS: 300,
  LOADING_SKELETON_DELAY_MS: 200,
  TOAST_DURATION_MS: 5000,
} as const;

// Chart and Analytics Configuration
export const CHARTS = {
  DEFAULT_DAYS: 30,
  MAX_DATA_POINTS: 50,
  MIN_VALUE_PERCENTAGE: 0.5, // Minimum 50% of base value
  TREND_VARIANCE: 0.1, // ±10% variance
  TREND_DECLINE_FACTOR: 0.001,
} as const;

// Token Decimals and Display
export const TOKEN_DECIMALS = {
  SOL: 9,
  USDC: 6,
  USDT: 6,
  ETH: 8,
  BTC: 8,
  DEFAULT: 6,
} as const;

// Risk Level Configuration
export const RISK_LEVELS = {
  CRITICAL: {
    COLOR: '#DC2626', // red-600
    THRESHOLD: 1.0,
    LABEL: 'Critical Risk',
  },
  HIGH: {
    COLOR: '#EA580C', // orange-600
    THRESHOLD: 1.2,
    LABEL: 'High Risk',
  },
  MEDIUM: {
    COLOR: '#CA8A04', // yellow-600
    THRESHOLD: 1.5,
    LABEL: 'Medium Risk',
  },
  LOW: {
    COLOR: '#16A34A', // green-600
    THRESHOLD: 2.0,
    LABEL: 'Low Risk',
  },
} as const;

// Pagination and Data Loading
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 100,
  INFINITE_SCROLL_THRESHOLD: 0.8,
} as const;

// Wallet Connection
export const WALLET = {
  AUTO_CONNECT_DELAY_MS: 1000,
  CONNECTION_RETRY_ATTEMPTS: 3,
  SIGN_TRANSACTION_TIMEOUT_MS: 30000,
} as const;

// Error Handling
export const ERROR_CODES = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  WALLET_ERROR: 'WALLET_ERROR',
  TRANSACTION_ERROR: 'TRANSACTION_ERROR',
  DATA_FETCH_ERROR: 'DATA_FETCH_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
} as const;

// Service Worker and PWA
export const PWA = {
  CACHE_VERSION: 'v1',
  STATIC_CACHE_NAME: 'static-assets-v1',
  DYNAMIC_CACHE_NAME: 'dynamic-data-v1',
  MAX_CACHE_AGE_MS: 86400000, // 24 hours
  BACKGROUND_SYNC_TAG: 'solana-data-sync',
} as const;

// Development and Testing
export const DEV = {
  ENABLE_DEBUG_LOGS: process.env.NODE_ENV === 'development',
  MOCK_DATA_ENABLED: process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true',
  DISABLE_ANALYTICS: process.env.NEXT_PUBLIC_DISABLE_ANALYTICS === 'true',
} as const;