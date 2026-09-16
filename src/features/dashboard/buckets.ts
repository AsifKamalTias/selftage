import {
  addDays,
  addMonths,
  daysBetween,
  MONTHS_SHORT,
  parseISODate,
  toISODate,
  type DateRange,
} from '@/lib/date';

export type Granularity = 'day' | 'week' | 'month' | 'year';

export interface DailyTotal {
  date: string;
  income: number;
  expense: number;
}

export interface Bucket {
  key: string;
  label: string;
  from: string;
  to: string;
  income: number;
  expense: number;
}

export type BoundedRange = Required<DateRange>;

export function pickGranularity(range: BoundedRange): Granularity {
  const days = daysBetween(range.from, range.to) + 1;
  if (days <= 14) return 'day';
  if (days <= 92) return 'week';
  const from = parseISODate(range.from);
  const to = parseISODate(range.to);
  const months = (to.getFullYear() - from.getFullYear()) * 12 + to.getMonth() - from.getMonth() + 1;
  return months <= 24 ? 'month' : 'year';
}

function mondayOf(date: Date): Date {
  return addDays(date, -((date.getDay() + 6) % 7));
}

function bucketKey(iso: string, granularity: Granularity): string {
  switch (granularity) {
    case 'day':
      return iso;
    case 'week':
      return toISODate(mondayOf(parseISODate(iso)));
    case 'month':
      return iso.slice(0, 7);
    default:
      return iso.slice(0, 4);
  }
}

/** Builds contiguous, zero-filled buckets covering `range` and sums daily totals into them. */
export function bucketize(
  daily: DailyTotal[],
  range: BoundedRange,
  granularity: Granularity
): Bucket[] {
  const buckets: Bucket[] = [];
  const end = parseISODate(range.to);
  const multiYear = range.from.slice(0, 4) !== range.to.slice(0, 4);
  const shortSpan = daysBetween(range.from, range.to) < 7;
  let cursor = parseISODate(range.from);

  while (cursor <= end) {
    let next: Date;
    let label: string;
    switch (granularity) {
      case 'day':
        next = addDays(cursor, 1);
        label = shortSpan
          ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][cursor.getDay()]
          : String(cursor.getDate());
        break;
      case 'week':
        next = addDays(mondayOf(cursor), 7);
        label = `${cursor.getDate()} ${MONTHS_SHORT[cursor.getMonth()]}`;
        break;
      case 'month':
        next = addMonths(cursor, 1);
        label = multiYear
          ? `${MONTHS_SHORT[cursor.getMonth()]} '${String(cursor.getFullYear()).slice(2)}`
          : MONTHS_SHORT[cursor.getMonth()];
        break;
      default:
        next = new Date(cursor.getFullYear() + 1, 0, 1);
        label = String(cursor.getFullYear());
    }
    const bucketEnd = addDays(next, -1) < end ? addDays(next, -1) : end;
    const from = toISODate(cursor);
    buckets.push({
      key: bucketKey(from, granularity),
      label,
      from,
      to: toISODate(bucketEnd),
      income: 0,
      expense: 0,
    });
    cursor = next;
  }

  const index = new Map(buckets.map((b) => [b.key, b]));
  for (const day of daily) {
    const bucket = index.get(bucketKey(day.date, granularity));
    if (bucket) {
      bucket.income += day.income;
      bucket.expense += day.expense;
    }
  }
  return buckets;
}

export interface CumulativePoint {
  label: string;
  income: number;
  expense: number;
}

export function cumulative(buckets: Bucket[]): CumulativePoint[] {
  let income = 0;
  let expense = 0;
  return buckets.map((b) => {
    income += b.income;
    expense += b.expense;
    return { label: b.label, income, expense };
  });
}
