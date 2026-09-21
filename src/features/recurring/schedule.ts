import type { RecurrenceFrequency } from '@/db/types';
import {
  addDays,
  formatDate,
  MONTHS_SHORT,
  parseISODate,
  toISODate,
  WEEKDAYS_LONG,
  type DateFormat,
} from '@/lib/date';

export const FREQUENCY_LABELS: Record<RecurrenceFrequency, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
};

/** Singular/plural unit used in "every 2 weeks". */
const FREQUENCY_UNITS: Record<RecurrenceFrequency, [one: string, many: string]> = {
  daily: ['day', 'days'],
  weekly: ['week', 'weeks'],
  monthly: ['month', 'months'],
  yearly: ['year', 'years'],
};

export const MAX_INTERVAL = 99;

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function ordinal(day: number): string {
  const rest = day % 100;
  if (rest >= 11 && rest <= 13) return `${day}th`;
  return `${day}${['th', 'st', 'nd', 'rd'][day % 10] ?? 'th'}`;
}

/**
 * The occurrence `steps` intervals after `startDate`. Day-of-month and month-of-year come
 * from the start date and are clamped to the target month, so the 31st becomes the 28th in
 * February without the schedule drifting earlier for later months.
 */
export function occurrenceAt(
  startDate: string,
  frequency: RecurrenceFrequency,
  intervalCount: number,
  steps: number
): string {
  const start = parseISODate(startDate);
  const step = Math.max(1, intervalCount) * steps;
  if (frequency === 'daily') return toISODate(addDays(start, step));
  if (frequency === 'weekly') return toISODate(addDays(start, step * 7));

  const anchorDay = start.getDate();
  if (frequency === 'monthly') {
    const target = new Date(start.getFullYear(), start.getMonth() + step, 1);
    const day = Math.min(anchorDay, daysInMonth(target.getFullYear(), target.getMonth()));
    return toISODate(new Date(target.getFullYear(), target.getMonth(), day));
  }
  const year = start.getFullYear() + step;
  const day = Math.min(anchorDay, daysInMonth(year, start.getMonth()));
  return toISODate(new Date(year, start.getMonth(), day));
}

/** The first occurrence on or after `from` (defaults to the start date itself). */
export function firstOccurrenceOnOrAfter(
  startDate: string,
  frequency: RecurrenceFrequency,
  intervalCount: number,
  from: string
): string {
  if (from <= startDate) return startDate;
  // Estimate the step count, then walk the last few to absorb clamping.
  const start = parseISODate(startDate);
  const target = parseISODate(from);
  const interval = Math.max(1, intervalCount);
  const days = Math.round((target.getTime() - start.getTime()) / 86_400_000);
  const months =
    (target.getFullYear() - start.getFullYear()) * 12 + (target.getMonth() - start.getMonth());
  const estimate =
    frequency === 'daily'
      ? Math.floor(days / interval)
      : frequency === 'weekly'
        ? Math.floor(days / (interval * 7))
        : frequency === 'monthly'
          ? Math.floor(months / interval)
          : Math.floor((target.getFullYear() - start.getFullYear()) / interval);

  let steps = Math.max(0, estimate - 1);
  let date = occurrenceAt(startDate, frequency, interval, steps);
  while (date < from) {
    steps += 1;
    date = occurrenceAt(startDate, frequency, interval, steps);
  }
  return date;
}

/** Whether the rule has an occurrence on exactly `date`. */
export function occursOn(
  rule: { startDate: string; frequency: RecurrenceFrequency; intervalCount: number },
  date: string
): boolean {
  if (date < rule.startDate) return false;
  return (
    firstOccurrenceOnOrAfter(rule.startDate, rule.frequency, rule.intervalCount, date) === date
  );
}

/** The occurrence strictly after `date`. */
export function nextOccurrenceAfter(
  rule: { startDate: string; frequency: RecurrenceFrequency; intervalCount: number },
  date: string
): string {
  return firstOccurrenceOnOrAfter(
    rule.startDate,
    rule.frequency,
    rule.intervalCount,
    toISODate(addDays(parseISODate(date), 1))
  );
}

/** Occurrences from `from` through `through` (both inclusive), capped at `limit`. */
export function occurrencesThrough(
  rule: {
    startDate: string;
    frequency: RecurrenceFrequency;
    intervalCount: number;
  },
  from: string,
  through: string,
  limit: number
): string[] {
  const dates: string[] = [];
  let date = firstOccurrenceOnOrAfter(rule.startDate, rule.frequency, rule.intervalCount, from);
  while (date <= through && dates.length < limit) {
    dates.push(date);
    date = nextOccurrenceAfter(rule, date);
  }
  return dates;
}

/** "Every 2 weeks on Monday", "Monthly on the 15th", "Yearly on 5 Jan". */
export function describeRecurrence(
  frequency: RecurrenceFrequency,
  intervalCount: number,
  startDate: string
): string {
  const interval = Math.max(1, intervalCount);
  const [, many] = FREQUENCY_UNITS[frequency];
  const cadence = interval === 1 ? FREQUENCY_LABELS[frequency] : `Every ${interval} ${many}`;
  const start = parseISODate(startDate);

  switch (frequency) {
    case 'daily':
      return interval === 1 ? cadence : `Every ${interval} ${many}`;
    case 'weekly':
      return `${cadence} on ${WEEKDAYS_LONG[start.getDay()]}`;
    case 'monthly':
      return `${cadence} on the ${ordinal(start.getDate())}`;
    default:
      return `${cadence} on ${start.getDate()} ${MONTHS_SHORT[start.getMonth()]}`;
  }
}

/** "Next on 21 Sep 2026" / "Due today" / "Overdue since …". */
export function describeNextRun(nextDate: string, today: string, format: DateFormat): string {
  if (nextDate === today) return 'Due today';
  if (nextDate < today) return `Overdue since ${formatDate(nextDate, format)}`;
  return `Next on ${formatDate(nextDate, format)}`;
}
