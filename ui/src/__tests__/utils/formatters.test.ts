/**
 * Tests for formatter utilities
 * Ensures monetary values are handled correctly
 */

import {
  formatCurrency,
  formatPercentage,
  formatTokenAmount,
  formatCompactNumber,
  parseCurrencyString,
  parsePercentageString,
  safeCurrencyToNumber,
  safePercentageToNumber,
} from '../utils/formatters';

describe('formatters', () => {
  describe('formatCurrency', () => {
    it('should format currency correctly', () => {
      expect(formatCurrency(1000.50)).toBe('$1,000.50');
      expect(formatCurrency(1000000)).toBe('$1M');
      expect(formatCurrency(1500000)).toBe('$1.5M');
      expect(formatCurrency(0)).toBe('$0.00');
    });

    it('should handle invalid numbers', () => {
      expect(formatCurrency(NaN)).toBe('$0.00');
      expect(formatCurrency(Infinity)).toBe('$0.00');
      expect(formatCurrency(-Infinity)).toBe('$0.00');
    });

    it('should support custom options', () => {
      expect(formatCurrency(1000.123, { maximumFractionDigits: 3 })).toBe('$1,000.123');
      expect(formatCurrency(1000000, { notation: 'standard' })).toBe('$1,000,000.00');
    });
  });

  describe('formatPercentage', () => {
    it('should format percentage correctly', () => {
      expect(formatPercentage(25.5)).toBe('25.5%');
      expect(formatPercentage(0)).toBe('0.0%');
      expect(formatPercentage(100)).toBe('100.0%');
    });

    it('should handle invalid numbers', () => {
      expect(formatPercentage(NaN)).toBe('0.0%');
      expect(formatPercentage(Infinity)).toBe('0.0%');
    });

    it('should support sign display', () => {
      expect(formatPercentage(25.5, { showSign: true })).toBe('+25.5%');
      expect(formatPercentage(-10.2, { showSign: true })).toBe('-10.2%');
    });
  });

  describe('formatTokenAmount', () => {
    it('should format token amounts correctly', () => {
      expect(formatTokenAmount(1000.5, { symbol: 'SOL' })).toBe('1,000.5 SOL');
      expect(formatTokenAmount(0.001, { symbol: 'BTC' })).toBe('0.001 BTC');
      expect(formatTokenAmount(1000)).toBe('1,000');
    });

    it('should handle precision correctly', () => {
      expect(formatTokenAmount(0.000001, { symbol: 'SOL', showFullPrecision: true, decimals: 9 }))
        .toBe('0.000001000 SOL');
      expect(formatTokenAmount(0.001, { symbol: 'BTC' })).toBe('0.0010 BTC');
    });
  });

  describe('formatCompactNumber', () => {
    it('should format numbers with suffixes', () => {
      expect(formatCompactNumber(1000)).toBe('1.0K');
      expect(formatCompactNumber(1000000)).toBe('1.0M');
      expect(formatCompactNumber(1000000000)).toBe('1.0B');
      expect(formatCompactNumber(999)).toBe('999');
    });

    it('should handle negative numbers', () => {
      expect(formatCompactNumber(-1000)).toBe('-1.0K');
      expect(formatCompactNumber(-1500000)).toBe('-1.5M');
    });
  });

  describe('parseCurrencyString', () => {
    it('should parse currency strings correctly', () => {
      expect(parseCurrencyString('$1,000.50')).toBe(1000.50);
      expect(parseCurrencyString('$1.5M')).toBe(1500000);
      expect(parseCurrencyString('$2.5K')).toBe(2500);
      expect(parseCurrencyString('$1.5B')).toBe(1500000000);
    });

    it('should handle invalid strings', () => {
      expect(parseCurrencyString('invalid')).toBe(0);
      expect(parseCurrencyString('')).toBe(0);
      expect(parseCurrencyString('$')).toBe(0);
    });

    it('should handle non-string inputs', () => {
      expect(parseCurrencyString(null as any)).toBe(0);
      expect(parseCurrencyString(undefined as any)).toBe(0);
      expect(parseCurrencyString(123 as any)).toBe(0);
    });
  });

  describe('parsePercentageString', () => {
    it('should parse percentage strings correctly', () => {
      expect(parsePercentageString('25.5%')).toBe(25.5);
      expect(parsePercentageString('0%')).toBe(0);
      expect(parsePercentageString('100%')).toBe(100);
    });

    it('should handle invalid strings', () => {
      expect(parsePercentageString('invalid')).toBe(0);
      expect(parsePercentageString('')).toBe(0);
      expect(parsePercentageString('%')).toBe(0);
    });
  });

  describe('safe conversion functions', () => {
    describe('safeCurrencyToNumber', () => {
      it('should handle both strings and numbers', () => {
        expect(safeCurrencyToNumber(1000.50)).toBe(1000.50);
        expect(safeCurrencyToNumber('$1,000.50')).toBe(1000.50);
        expect(safeCurrencyToNumber('$1.5M')).toBe(1500000);
      });

      it('should handle invalid inputs', () => {
        expect(safeCurrencyToNumber(NaN)).toBe(0);
        expect(safeCurrencyToNumber(Infinity)).toBe(0);
        expect(safeCurrencyToNumber('invalid')).toBe(0);
      });
    });

    describe('safePercentageToNumber', () => {
      it('should handle both strings and numbers', () => {
        expect(safePercentageToNumber(25.5)).toBe(25.5);
        expect(safePercentageToNumber('25.5%')).toBe(25.5);
      });

      it('should handle invalid inputs', () => {
        expect(safePercentageToNumber(NaN)).toBe(0);
        expect(safePercentageToNumber(Infinity)).toBe(0);
        expect(safePercentageToNumber('invalid')).toBe(0);
      });
    });
  });
});