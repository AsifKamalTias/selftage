/**
 * Transaction dates are stored as local calendar dates ("YYYY-MM-DD"), so no
 * timezone conversion is ever applied to them. Timestamps (created/updated) are
 * full ISO strings.
 */

export const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

export const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export const WEEKDAYS_LONG = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

/** Day a week starts on, matching `Date.getDay()` (0 = Sunday). */
export type WeekStart = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const WEEK_STARTS: readonly WeekStart[] = [0, 1, 2, 3, 4, 5, 6];

export const DEFAULT_WEEK_START: WeekStart = 1;

export type DateFormat =
  'DD MMM YYYY' | 'MMM DD, YYYY' | 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';

export const DATE_FORMATS: readonly DateFormat[] = [
  'DD MMM YYYY',
  'MMM DD, YYYY',
  'DD/MM/YYYY',
  'MM/DD/YYYY',
  'YYYY-MM-DD',
];

const pad = (n: number) => String(n).padStart(2, '0');

export function toISODate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function isISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return toISODate(parseISODate(value)) === value;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function nowTimestamp(): string {
  return new Date().toISOString();
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

/** First day of the week containing `date`, honouring the user's week-start preference. */
export function startOfWeek(date: Date, weekStartsOn: WeekStart = DEFAULT_WEEK_START): Date {
  return addDays(date, -((date.getDay() - weekStartsOn + 7) % 7));
}

export function endOfWeek(date: Date, weekStartsOn: WeekStart = DEFAULT_WEEK_START): Date {
  return addDays(startOfWeek(date, weekStartsOn), 6);
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function startOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 0, 1);
}

export function endOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 11, 31);
}

export function daysBetween(fromISO: string, toISO: string): number {
  const ms = parseISODate(toISO).getTime() - parseISODate(fromISO).getTime();
  return Math.round(ms / 86_400_000);
}

export function formatDate(iso: string, format: DateFormat = 'DD MMM YYYY'): string {
  const date = parseISODate(iso);
  const d = pad(date.getDate());
  const m = pad(date.getMonth() + 1);
  const y = date.getFullYear();
  const mon = MONTHS_SHORT[date.getMonth()];
  switch (format) {
    case 'MMM DD, YYYY':
      return `${mon} ${d}, ${y}`;
    case 'DD/MM/YYYY':
      return `${d}/${m}/${y}`;
    case 'MM/DD/YYYY':
      return `${m}/${d}/${y}`;
    case 'YYYY-MM-DD':
      return iso;
    default:
      return `${d} ${mon} ${y}`;
  }
}

/** "Today", "Yesterday", "Mon, 14 Sep" (current year) or the full formatted date. */
export function formatDayHeading(iso: string, format: DateFormat): string {
  const today = todayISO();
  if (iso === today) return 'Today';
  if (iso === toISODate(addDays(new Date(), -1))) return 'Yesterday';
  const date = parseISODate(iso);
  if (date.getFullYear() === new Date().getFullYear()) {
    return `${WEEKDAYS_SHORT[date.getDay()]}, ${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`;
  }
  return formatDate(iso, format);
}

export function formatMonthYear(date: Date): string {
  return `${MONTHS_SHORT[date.getMonth()]} ${date.getFullYear()}`;
}

export function greetingForNow(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 5) return 'Good night';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export interface DateRange {
  /** Inclusive lower bound (YYYY-MM-DD). Undefined means unbounded. */
  from?: string;
  /** Inclusive upper bound (YYYY-MM-DD). Undefined means unbounded. */
  to?: string;
}

export type PeriodPreset =
  | 'today'
  | 'this-week'
  | 'this-month'
  | 'last-month'
  | 'last-3-months'
  | 'this-year'
  | 'last-year'
  | 'all';

export const PERIOD_PRESETS: readonly { value: PeriodPreset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'this-week', label: 'This week' },
  { value: 'this-month', label: 'This month' },
  { value: 'last-month', label: 'Last month' },
  { value: 'last-3-months', label: 'Last 3 months' },
  { value: 'this-year', label: 'This year' },
  { value: 'last-year', label: 'Last year' },
  { value: 'all', label: 'All time' },
];

export function periodLabel(preset: PeriodPreset): string {
  return PERIOD_PRESETS.find((p) => p.value === preset)?.label ?? preset;
}

export interface RangeOptions {
  weekStartsOn?: WeekStart;
  /** Reference date; defaults to now. */
  now?: Date;
}

export function rangeForPreset(
  preset: PeriodPreset,
  { weekStartsOn = DEFAULT_WEEK_START, now = new Date() }: RangeOptions = {}
): DateRange {
  switch (preset) {
    case 'today':
      return { from: toISODate(now), to: toISODate(now) };
    case 'this-week': {
      const start = startOfWeek(now, weekStartsOn);
      return { from: toISODate(start), to: toISODate(addDays(start, 6)) };
    }
    case 'this-month':
      return { from: toISODate(startOfMonth(now)), to: toISODate(endOfMonth(now)) };
    case 'last-month': {
      const last = addMonths(now, -1);
      return { from: toISODate(startOfMonth(last)), to: toISODate(endOfMonth(last)) };
    }
    case 'last-3-months':
      return { from: toISODate(addMonths(now, -2)), to: toISODate(endOfMonth(now)) };
    case 'this-year':
      return { from: toISODate(startOfYear(now)), to: toISODate(endOfYear(now)) };
    case 'last-year': {
      const last = new Date(now.getFullYear() - 1, 0, 1);
      return { from: toISODate(startOfYear(last)), to: toISODate(endOfYear(last)) };
    }
    default:
      return {};
  }
}

/** The equally long range immediately before `range`, used for period-over-period comparisons. */
export function previousRange(range: DateRange): DateRange | null {
  if (!range.from || !range.to) return null;
  const from = parseISODate(range.from);
  const to = parseISODate(range.to);
  const isWholeMonths = from.getDate() === 1 && toISODate(endOfMonth(to)) === range.to;
  if (isWholeMonths) {
    const months =
      (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) + 1;
    const prevFrom = addMonths(from, -months);
    return { from: toISODate(prevFrom), to: toISODate(addDays(from, -1)) };
  }
  const length = daysBetween(range.from, range.to) + 1;
  return { from: toISODate(addDays(from, -length)), to: toISODate(addDays(from, -1)) };
}

export function formatRange(range: DateRange, format: DateFormat): string {
  if (!range.from && !range.to) return 'All time';
  if (range.from && range.to) {
    if (range.from === range.to) return formatDate(range.from, format);
    return `${formatDate(range.from, format)} – ${formatDate(range.to, format)}`;
  }
  if (range.from) return `From ${formatDate(range.from, format)}`;
  return `Until ${formatDate(range.to!, format)}`;
}
