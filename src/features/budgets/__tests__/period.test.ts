import { describe, expect, it } from '@jest/globals';

import { budgetHealth } from '../repository';
import { budgetWindow, dailyAllowance } from '../period';

// Thu 17 Sep 2026.
const now = new Date(2026, 8, 17);

describe('budgetWindow', () => {
  it('covers the current day', () => {
    expect(budgetWindow('daily', { weekStartsOn: 1, now })).toEqual({
      from: '2026-09-17',
      to: '2026-09-17',
      daysLeft: 1,
    });
  });

  it('follows the configured week start', () => {
    expect(budgetWindow('weekly', { weekStartsOn: 1, now })).toEqual({
      from: '2026-09-14',
      to: '2026-09-20',
      daysLeft: 4,
    });
    expect(budgetWindow('weekly', { weekStartsOn: 0, now })).toEqual({
      from: '2026-09-13',
      to: '2026-09-19',
      daysLeft: 3,
    });
    expect(budgetWindow('weekly', { weekStartsOn: 6, now })).toEqual({
      from: '2026-09-12',
      to: '2026-09-18',
      daysLeft: 2,
    });
  });

  it('covers the calendar month', () => {
    expect(budgetWindow('monthly', { weekStartsOn: 1, now })).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
      daysLeft: 14,
    });
  });

  it('counts a single day left on the last day of the period', () => {
    const lastDay = new Date(2026, 8, 30);
    expect(budgetWindow('monthly', { weekStartsOn: 1, now: lastDay }).daysLeft).toBe(1);
  });
});

describe('budgetHealth', () => {
  it('warns from the threshold and flags at or over the limit', () => {
    expect(budgetHealth(0, 1000, 80)).toBe('ok');
    expect(budgetHealth(799, 1000, 80)).toBe('ok');
    expect(budgetHealth(800, 1000, 80)).toBe('warning');
    expect(budgetHealth(999, 1000, 80)).toBe('warning');
    expect(budgetHealth(1000, 1000, 80)).toBe('exceeded');
    expect(budgetHealth(1500, 1000, 80)).toBe('exceeded');
  });

  it('respects a custom threshold', () => {
    expect(budgetHealth(500, 1000, 50)).toBe('warning');
    expect(budgetHealth(499, 1000, 50)).toBe('ok');
  });

  it('never divides by a zero limit', () => {
    expect(budgetHealth(100, 0, 80)).toBe('ok');
  });
});

describe('dailyAllowance', () => {
  it('spreads what is left over the days that remain', () => {
    expect(dailyAllowance(10_000, 4)).toBe(2500);
    expect(dailyAllowance(10_001, 4)).toBe(2500);
  });

  it('is zero once the budget is spent or the period is over', () => {
    expect(dailyAllowance(-500, 4)).toBe(0);
    expect(dailyAllowance(1000, 0)).toBe(0);
  });
});
