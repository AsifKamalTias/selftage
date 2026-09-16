import { describe, expect, it } from '@jest/globals';

import {
  daysBetween,
  formatDate,
  formatRange,
  isISODate,
  parseISODate,
  previousRange,
  rangeForPreset,
  toISODate,
  type DateFormat,
} from '../date';

describe('ISO date helpers', () => {
  it('round-trips local calendar dates', () => {
    expect(toISODate(parseISODate('2026-02-28'))).toBe('2026-02-28');
  });

  it('validates real dates only', () => {
    expect(isISODate('2026-09-17')).toBe(true);
    expect(isISODate('2026-02-30')).toBe(false);
    expect(isISODate('17/09/2026')).toBe(false);
  });

  it('counts days across month boundaries', () => {
    expect(daysBetween('2026-01-30', '2026-03-01')).toBe(30);
  });
});

describe('formatDate', () => {
  const cases: [DateFormat, string][] = [
    ['DD MMM YYYY', '07 Sep 2026'],
    ['MMM DD, YYYY', 'Sep 07, 2026'],
    ['DD/MM/YYYY', '07/09/2026'],
    ['MM/DD/YYYY', '09/07/2026'],
    ['YYYY-MM-DD', '2026-09-07'],
  ];

  it.each(cases)('formats %s', (format, expected) => {
    expect(formatDate('2026-09-07', format)).toBe(expected);
  });
});

describe('rangeForPreset', () => {
  const now = new Date(2026, 8, 17); // Thu 17 Sep 2026

  it('computes calendar ranges', () => {
    expect(rangeForPreset('today', now)).toEqual({ from: '2026-09-17', to: '2026-09-17' });
    expect(rangeForPreset('this-week', now)).toEqual({ from: '2026-09-14', to: '2026-09-20' });
    expect(rangeForPreset('this-month', now)).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(rangeForPreset('last-month', now)).toEqual({ from: '2026-08-01', to: '2026-08-31' });
    expect(rangeForPreset('last-3-months', now)).toEqual({ from: '2026-07-01', to: '2026-09-30' });
    expect(rangeForPreset('last-year', now)).toEqual({ from: '2025-01-01', to: '2025-12-31' });
    expect(rangeForPreset('all', now)).toEqual({});
  });

  it('handles January for "last month"', () => {
    expect(rangeForPreset('last-month', new Date(2026, 0, 10))).toEqual({
      from: '2025-12-01',
      to: '2025-12-31',
    });
  });
});

describe('previousRange', () => {
  it('shifts whole months by calendar months', () => {
    expect(previousRange({ from: '2026-03-01', to: '2026-03-31' })).toEqual({
      from: '2026-02-01',
      to: '2026-02-28',
    });
  });

  it('shifts arbitrary ranges by their length', () => {
    expect(previousRange({ from: '2026-09-14', to: '2026-09-20' })).toEqual({
      from: '2026-09-07',
      to: '2026-09-13',
    });
  });

  it('returns null for open ranges', () => {
    expect(previousRange({})).toBeNull();
  });
});

describe('formatRange', () => {
  it('describes bounded and open ranges', () => {
    expect(formatRange({}, 'DD MMM YYYY')).toBe('All time');
    expect(formatRange({ from: '2026-09-01', to: '2026-09-30' }, 'DD MMM YYYY')).toBe(
      '01 Sep 2026 – 30 Sep 2026'
    );
    expect(formatRange({ from: '2026-09-01' }, 'YYYY-MM-DD')).toBe('From 2026-09-01');
  });
});
