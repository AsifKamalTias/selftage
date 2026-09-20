import type { BudgetPeriod } from '@/db/types';
import {
  daysBetween,
  endOfMonth,
  endOfWeek,
  startOfMonth,
  startOfWeek,
  toISODate,
  type WeekStart,
} from '@/lib/date';

export const BUDGET_PERIOD_LABELS: Record<BudgetPeriod, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

/** "today" / "this week" / "this month" — reads naturally inside a sentence. */
export const BUDGET_PERIOD_WINDOW: Record<BudgetPeriod, string> = {
  daily: 'today',
  weekly: 'this week',
  monthly: 'this month',
};

export interface BudgetWindow {
  from: string;
  to: string;
  /** Days left in the window, including today. */
  daysLeft: number;
}

/** The current window for a budget period, anchored on `now`. */
export function budgetWindow(
  period: BudgetPeriod,
  { weekStartsOn, now = new Date() }: { weekStartsOn: WeekStart; now?: Date }
): BudgetWindow {
  const today = toISODate(now);
  const range =
    period === 'daily'
      ? { from: today, to: today }
      : period === 'weekly'
        ? {
            from: toISODate(startOfWeek(now, weekStartsOn)),
            to: toISODate(endOfWeek(now, weekStartsOn)),
          }
        : { from: toISODate(startOfMonth(now)), to: toISODate(endOfMonth(now)) };
  return { ...range, daysLeft: Math.max(0, daysBetween(today, range.to) + 1) };
}

/** The window that contains `date`, used to tell whether a transaction affects a budget. */
export function budgetWindowFor(
  period: BudgetPeriod,
  date: Date,
  weekStartsOn: WeekStart
): BudgetWindow {
  return budgetWindow(period, { weekStartsOn, now: date });
}

/** Even daily share of the remaining limit, for "you can still spend X/day" hints. */
export function dailyAllowance(remaining: number, daysLeft: number): number {
  if (remaining <= 0 || daysLeft <= 0) return 0;
  return Math.floor(remaining / daysLeft);
}
