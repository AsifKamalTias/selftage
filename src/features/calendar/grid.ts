import { addDays, startOfWeek, toISODate, type WeekStart } from '@/lib/date';

/** Weeks shown for one month; six keeps the grid a fixed height all year. */
export const CALENDAR_ROWS = 6;

/** The days shown for a month, starting on the user's first day of the week. */
export function monthGridDays(monthStart: Date, weekStartsOn: WeekStart): string[] {
  const first = startOfWeek(
    new Date(monthStart.getFullYear(), monthStart.getMonth(), 1),
    weekStartsOn
  );
  return Array.from({ length: CALENDAR_ROWS * 7 }, (_, index) => toISODate(addDays(first, index)));
}
