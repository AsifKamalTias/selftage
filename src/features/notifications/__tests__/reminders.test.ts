import { describe, expect, it } from '@jest/globals';

import { formatReminderTime, parseReminderTime, planReminders } from '../reminders';

const event = (key: string, date: string) => ({
  key,
  kind: 'payable' as const,
  date,
  title: 'Payment due',
  body: 'Rent is due.',
  route: '/outstanding',
});

describe('parseReminderTime', () => {
  it('reads a 24-hour time', () => {
    expect(parseReminderTime('07:30')).toEqual({ hour: 7, minute: 30 });
    expect(parseReminderTime('23:59')).toEqual({ hour: 23, minute: 59 });
  });

  it('falls back to 9am for anything unusable', () => {
    for (const value of ['', 'noon', '25:00', '09:60']) {
      expect(parseReminderTime(value)).toEqual({ hour: 9, minute: 0 });
    }
  });
});

describe('formatReminderTime', () => {
  it('reads as a clock time', () => {
    expect(formatReminderTime('00:00')).toBe('12:00 am');
    expect(formatReminderTime('09:05')).toBe('9:05 am');
    expect(formatReminderTime('12:00')).toBe('12:00 pm');
    expect(formatReminderTime('18:30')).toBe('6:30 pm');
  });
});

describe('planReminders', () => {
  // Fixed "now": 21 Sep 2026, 08:00 local.
  const now = new Date(2026, 8, 21, 8, 0, 0);

  it('fires future events at the chosen time on their own day', () => {
    const [reminder] = planReminders([event('a', '2026-09-24')], { time: '09:00', now });
    expect(reminder.at).toEqual(new Date(2026, 8, 24, 9, 0, 0));
  });

  it('still surfaces something overdue, at the next slot today', () => {
    const [reminder] = planReminders([event('a', '2026-09-01')], { time: '09:00', now });
    expect(reminder.at).toEqual(new Date(2026, 8, 21, 9, 0, 0));
  });

  it('pushes overdue items just past now when today’s slot has gone', () => {
    const late = new Date(2026, 8, 21, 22, 0, 0);
    const [reminder] = planReminders([event('a', '2026-09-01')], { time: '09:00', now: late });
    expect(reminder.at.getTime()).toBe(late.getTime() + 60_000);
  });

  it('drops duplicates by key', () => {
    const planned = planReminders([event('a', '2026-09-24'), event('a', '2026-09-25')], {
      time: '09:00',
      now,
    });
    expect(planned).toHaveLength(1);
  });

  it('returns them in the order they will fire', () => {
    const planned = planReminders(
      [event('c', '2026-10-01'), event('a', '2026-09-22'), event('b', '2026-09-25')],
      { time: '09:00', now }
    );
    expect(planned.map((r) => r.key)).toEqual(['a', 'b', 'c']);
  });
});
