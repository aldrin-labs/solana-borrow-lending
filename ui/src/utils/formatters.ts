/**
 * Utility functions for formatting monetary values, percentages, and numbers
 * Keeps data as numbers internally and provides consistent display formatting
 */

// Currency formatter with locale support
export const formatCurrency = (
  value: number,
  options: {
    currency?: string;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
    notation?: 'standard' | 'scientific' | 'engineering' | 'compact';
    locale?: string;
  } = {}
): string => {
  const {
    currency = 'USD',
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
    notation = 'standard',
    locale = 'en-US'
  } = options;

  // Handle invalid numbers
  if (!isFinite(value) || isNaN(value)) {
    return '$0.00';
  }

  // Use compact notation for large numbers
  const useCompact = Math.abs(value) >= 1000000 && notation === 'standard';
  
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: useCompact ? 1 : minimumFractionDigits,
    maximumFractionDigits: useCompact ? 1 : maximumFractionDigits,
    notation: useCompact ? 'compact' : notation,
  }).format(value);
};

// Format percentage values
export const formatPercentage = (
  value: number,
  options: {
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
    showSign?: boolean;
  } = {}
): string => {
  const {
    minimumFractionDigits = 1,
    maximumFractionDigits = 2,
    showSign = false
  } = options;

  if (!isFinite(value) || isNaN(value)) {
    return '0.0%';
  }

  const formatted = new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits,
    maximumFractionDigits,
    signDisplay: showSign ? 'always' : 'auto',
  }).format(value / 100);

  return formatted;
};

// Format token amounts with appropriate decimals
export const formatTokenAmount = (
  value: number,
  options: {
    symbol?: string;
    decimals?: number;
    showFullPrecision?: boolean;
  } = {}
): string => {
  const {
    symbol = '',
    decimals = 6,
    showFullPrecision = false
  } = options;

  if (!isFinite(value) || isNaN(value)) {
    return `0${symbol ? ` ${symbol}` : ''}`;
  }

  let fractionDigits = 2;
  
  if (showFullPrecision) {
    fractionDigits = decimals;
  } else if (value < 0.01) {
    fractionDigits = Math.min(6, decimals);
  } else if (value < 1) {
    fractionDigits = 4;
  }

  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  }).format(value);

  return `${formatted}${symbol ? ` ${symbol}` : ''}`;
};

// Format large numbers with K/M/B suffixes
export const formatCompactNumber = (value: number): string => {
  if (!isFinite(value) || isNaN(value)) {
    return '0';
  }

  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (absValue >= 1e9) {
    return `${sign}${(absValue / 1e9).toFixed(1)}B`;
  } else if (absValue >= 1e6) {
    return `${sign}${(absValue / 1e6).toFixed(1)}M`;
  } else if (absValue >= 1e3) {
    return `${sign}${(absValue / 1e3).toFixed(1)}K`;
  }

  return value.toString();
};

// Parse currency string back to number (for existing string data)
export const parseCurrencyString = (currencyStr: string): number => {
  if (typeof currencyStr !== 'string') {
    return 0;
  }

  // Remove currency symbols, commas, and spaces
  const cleaned = currencyStr.replace(/[$,\s]/g, '');
  
  // Handle K/M/B suffixes
  const value = parseFloat(cleaned);
  if (isNaN(value)) {
    return 0;
  }

  const lastChar = cleaned.slice(-1).toLowerCase();
  if (lastChar === 'k') {
    return value * 1000;
  } else if (lastChar === 'm') {
    return value * 1000000;
  } else if (lastChar === 'b') {
    return value * 1000000000;
  }

  return value;
};

// Parse percentage string back to number
export const parsePercentageString = (percentStr: string): number => {
  if (typeof percentStr !== 'string') {
    return 0;
  }

  const cleaned = percentStr.replace(/[%\s]/g, '');
  const value = parseFloat(cleaned);
  return isNaN(value) ? 0 : value;
};

// Utility to safely convert legacy string values to numbers
export const safeCurrencyToNumber = (value: string | number): number => {
  if (typeof value === 'number') {
    return isFinite(value) ? value : 0;
  }
  return parseCurrencyString(value);
};

export const safePercentageToNumber = (value: string | number): number => {
  if (typeof value === 'number') {
    return isFinite(value) ? value : 0;
  }
  return parsePercentageString(value);
};