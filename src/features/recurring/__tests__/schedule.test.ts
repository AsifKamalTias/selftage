import { describe, expect, it } from '@jest/globals';

import {
  describeNextRun,
  describeRecurrence,
  firstOccurrenceOnOrAfter,
  nextOccurrenceAfter,
  occurrenceAt,
  occurrencesThrough,
} from '../schedule';

describe('occurrenceAt', () => {
  it('steps by days and weeks', () => {
    expect(occurrenceAt('2026-09-17', 'daily', 1, 3)).toBe('2026-09-20');
    expect(occurrenceAt('2026-09-17', 'daily', 5, 2)).toBe('2026-09-27');
    expect(occurrenceAt('2026-09-17', 'weekly', 1, 2)).toBe('2026-10-01');
    expect(occurrenceAt('2026-09-17', 'weekly', 3, 1)).toBe('2026-10-08');
  });

  it('keeps the weekday for weekly rules', () => {
    const start = '2026-09-14'; // Monday
    for (const steps of [1, 5, 12]) {
      expect(new Date(`${occurrenceAt(start, 'weekly', 2, steps)}T00:00:00`).getDay()).toBe(1);
    }
  });

  it('clamps the day of month without drifting', () => {
    // The 31st becomes the last day of shorter months, then returns to the 31st.
    expect(occurrenceAt('2026-01-31', 'monthly', 1, 1)).toBe('2026-02-28');
    expect(occurrenceAt('2026-01-31', 'monthly', 1, 2)).toBe('2026-03-31');
    expect(occurrenceAt('2026-01-31', 'monthly', 1, 3)).toBe('2026-04-30');
    expect(occurrenceAt('2026-01-31', 'monthly', 1, 4)).toBe('2026-05-31');
  });

  it('steps monthly intervals across year boundaries', () => {
    expect(occurrenceAt('2026-11-15', 'monthly', 3, 1)).toBe('2027-02-15');
    expect(occurrenceAt('2026-01-15', 'monthly', 2, 6)).toBe('2027-01-15');
  });

  it('handles leap days for yearly rules', () => {
    expect(occurrenceAt('2024-02-29', 'yearly', 1, 1)).toBe('2025-02-28');
    expect(occurrenceAt('2024-02-29', 'yearly', 4, 1)).toBe('2028-02-29');
    expect(occurrenceAt('2026-03-01', 'yearly', 2, 2)).toBe('2030-03-01');
  });
});

describe('firstOccurrenceOnOrAfter', () => {
  it('returns the start date when nothing has passed yet', () => {
    expect(firstOccurrenceOnOrAfter('2026-09-17', 'monthly', 1, '2026-09-01')).toBe('2026-09-17');
    expect(firstOccurrenceOnOrAfter('2026-09-17', 'monthly', 1, '2026-09-17')).toBe('2026-09-17');
  });

  it('finds the next occurrence for every frequency', () => {
    expect(firstOccurrenceOnOrAfter('2026-01-01', 'daily', 10, '2026-01-15')).toBe('2026-01-21');
    expect(firstOccurrenceOnOrAfter('2026-01-05', 'weekly', 2, '2026-02-01')).toBe('2026-02-02');
    expect(firstOccurrenceOnOrAfter('2026-01-31', 'monthly', 1, '2026-02-15')).toBe('2026-02-28');
    expect(firstOccurrenceOnOrAfter('2020-06-10', 'yearly', 1, '2026-01-01')).toBe('2026-06-10');
  });

  it('is exact after long gaps', () => {
    expect(firstOccurrenceOnOrAfter('2020-01-31', 'monthly', 1, '2026-09-20')).toBe('2026-09-30');
    expect(firstOccurrenceOnOrAfter('2020-01-01', 'daily', 7, '2026-09-20')).toBe('2026-09-23');
  });
});

describe('nextOccurrenceAfter', () => {
  it('always moves forward', () => {
    const rule = { startDate: '2026-01-31', frequency: 'monthly' as const, intervalCount: 1 };
    expect(nextOccurrenceAfter(rule, '2026-01-31')).toBe('2026-02-28');
    expect(nextOccurrenceAfter(rule, '2026-02-28')).toBe('2026-03-31');
  });
});

describe('occurrencesThrough', () => {
  const weekly = { startDate: '2026-09-01', frequency: 'weekly' as const, intervalCount: 1 };

  it('lists every due date in the window', () => {
    expect(occurrencesThrough(weekly, '2026-09-01', '2026-09-29', 50)).toEqual([
      '2026-09-01',
      '2026-09-08',
      '2026-09-15',
      '2026-09-22',
      '2026-09-29',
    ]);
  });

  it('stops at the limit', () => {
    expect(occurrencesThrough(weekly, '2026-09-01', '2026-12-31', 2)).toEqual([
      '2026-09-01',
      '2026-09-08',
    ]);
  });

  it('returns nothing before the start date', () => {
    expect(occurrencesThrough(weekly, '2026-08-01', '2026-08-31', 50)).toEqual([]);
  });

  it('catches up monthly rules missed while the app was closed', () => {
    const monthly = { startDate: '2026-05-10', frequency: 'monthly' as const, intervalCount: 1 };
    expect(occurrencesThrough(monthly, '2026-06-10', '2026-09-17', 50)).toEqual([
      '2026-06-10',
      '2026-07-10',
      '2026-08-10',
      '2026-09-10',
    ]);
  });
});

describe('describeRecurrence', () => {
  it('reads naturally for each cadence', () => {
    expect(describeRecurrence('daily', 1, '2026-09-17')).toBe('Daily');
    expect(describeRecurrence('daily', 3, '2026-09-17')).toBe('Every 3 days');
    expect(describeRecurrence('weekly', 1, '2026-09-14')).toBe('Weekly on Monday');
    expect(describeRecurrence('weekly', 2, '2026-09-14')).toBe('Every 2 weeks on Monday');
    expect(describeRecurrence('monthly', 1, '2026-09-01')).toBe('Monthly on the 1st');
    expect(describeRecurrence('monthly', 3, '2026-09-22')).toBe('Every 3 months on the 22nd');
    expect(describeRecurrence('monthly', 1, '2026-09-13')).toBe('Monthly on the 13th');
    expect(describeRecurrence('yearly', 1, '2026-01-05')).toBe('Yearly on 5 Jan');
  });
});

describe('describeNextRun', () => {
  it('distinguishes due, overdue and upcoming', () => {
    expect(describeNextRun('2026-09-17', '2026-09-17', 'DD MMM YYYY')).toBe('Due today');
    expect(describeNextRun('2026-09-10', '2026-09-17', 'DD MMM YYYY')).toBe(
      'Overdue since 10 Sep 2026'
    );
    expect(describeNextRun('2026-09-20', '2026-09-17', 'DD MMM YYYY')).toBe('Next on 20 Sep 2026');
  });
});
