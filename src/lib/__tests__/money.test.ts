import { describe, expect, it } from '@jest/globals';

import { getCurrency } from '@/features/settings/currencies';

import {
  formatMoney,
  minorToInput,
  parseAmountInput,
  percentChange,
  sanitizeAmountInput,
  toMinor,
} from '../money';

describe('toMinor', () => {
  it('rounds to hundredths without float drift', () => {
    expect(toMinor(0.1 + 0.2)).toBe(30);
    expect(toMinor(1250.5)).toBe(125050);
  });
});

describe('parseAmountInput', () => {
  it.each([
    ['1250.5', 125050],
    ['1,234.56', 123456],
    ['.5', 50],
    ['0', 0],
    [' 42 ', 4200],
  ])('parses %p', (input, expected) => {
    expect(parseAmountInput(input)).toBe(expected);
  });

  it.each(['', '.', 'abc', '1.234', '-5', '1..2'])('rejects %p', (input) => {
    expect(parseAmountInput(input)).toBeNull();
  });
});

describe('sanitizeAmountInput', () => {
  it('keeps one decimal point and two decimals', () => {
    expect(sanitizeAmountInput('12.345')).toBe('12.34');
    expect(sanitizeAmountInput('1.2.3')).toBe('1.23');
  });

  it('drops invalid characters and leading zeros', () => {
    expect(sanitizeAmountInput('00a12')).toBe('12');
    expect(sanitizeAmountInput('.5')).toBe('0.5');
    expect(sanitizeAmountInput('-7')).toBe('7');
  });
});

describe('minorToInput', () => {
  it('formats for editing', () => {
    expect(minorToInput(1200)).toBe('12');
    expect(minorToInput(1250)).toBe('12.5');
    expect(minorToInput(1205)).toBe('12.05');
    expect(minorToInput(-990)).toBe('9.9');
  });
});

describe('formatMoney', () => {
  const usd = getCurrency('USD');
  const bdt = getCurrency('BDT');
  const jpy = getCurrency('JPY');

  it('groups digits and applies the symbol', () => {
    expect(formatMoney(123456789, usd)).toBe('$1,234,567.89');
    expect(formatMoney(-50, usd)).toBe('-$0.50');
  });

  it('uses Indian grouping where configured', () => {
    expect(formatMoney(11849925, bdt)).toBe('৳1,18,499.25');
  });

  it('respects currencies without minor units', () => {
    expect(formatMoney(150000, jpy)).toBe('¥1,500');
  });

  it('supports sign and compact options', () => {
    expect(formatMoney(1000, usd, { sign: 'always' })).toBe('+$10.00');
    expect(formatMoney(-1000, usd, { sign: 'never' })).toBe('$10.00');
    expect(formatMoney(12_345_000, usd, { compact: true })).toBe('$123K');
    expect(formatMoney(1_234_500, usd, { compact: true })).toBe('$12.3K');
    expect(formatMoney(250_000_000, usd, { compact: true, plain: true })).toBe('2.5M');
    expect(formatMoney(9_900, usd, { compact: true })).toBe('$99');
  });
});

describe('percentChange', () => {
  it('handles zero baselines', () => {
    expect(percentChange(0, 0)).toBe(0);
    expect(percentChange(10, 0)).toBeNull();
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(-50, -100)).toBe(50);
  });
});
