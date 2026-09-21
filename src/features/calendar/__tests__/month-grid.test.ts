import { describe, expect, it } from '@jest/globals';

import { monthGridDays } from '../grid';

describe('monthGridDays', () => {
  it('always returns six full weeks', () => {
    expect(monthGridDays(new Date(2026, 8, 1), 1)).toHaveLength(42);
  });

  it('starts on the configured first day of the week', () => {
    // 1 Sep 2026 is a Tuesday.
    const mondayFirst = monthGridDays(new Date(2026, 8, 1), 1);
    expect(mondayFirst[0]).toBe('2026-08-31');

    const sundayFirst = monthGridDays(new Date(2026, 8, 1), 0);
    expect(sundayFirst[0]).toBe('2026-08-30');

    const saturdayFirst = monthGridDays(new Date(2026, 8, 1), 6);
    expect(saturdayFirst[0]).toBe('2026-08-29');
  });

  it('covers every day of the month', () => {
    const days = monthGridDays(new Date(2026, 8, 15), 1);
    expect(days).toContain('2026-09-01');
    expect(days).toContain('2026-09-30');
  });

  it('runs in consecutive days without gaps', () => {
    const days = monthGridDays(new Date(2026, 1, 1), 0);
    for (let i = 1; i < days.length; i += 1) {
      const previous = new Date(`${days[i - 1]}T00:00:00`);
      const current = new Date(`${days[i]}T00:00:00`);
      expect((current.getTime() - previous.getTime()) / 86_400_000).toBe(1);
    }
  });

  it('handles a month that starts on the first day of the week', () => {
    // 1 Feb 2026 is a Sunday.
    expect(monthGridDays(new Date(2026, 1, 1), 0)[0]).toBe('2026-02-01');
  });
});
