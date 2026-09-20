import type { Goal } from '@/db/types';
import { daysBetween, todayISO } from '@/lib/date';

export type GoalPace = 'reached' | 'no-deadline' | 'on-track' | 'behind' | 'due-today' | 'overdue';

export interface GoalProgress {
  /** Share of the target saved, where 1 is exactly at the target (can exceed 1). */
  ratio: number;
  percent: number;
  /** Still needed to reach the target; 0 once reached. */
  remaining: number;
  reached: boolean;
  /** Days until the deadline counting today (1 = due today, 0 or less = past). Null without one. */
  daysLeft: number | null;
  pace: GoalPace;
  /** Share of the target that an even pace would have reached by now. Null without a deadline. */
  expectedRatio: number | null;
  /** What to set aside per period to finish on time; 0 when reached or past due. */
  perDay: number;
  perWeek: number;
  perMonth: number;
}

export type GoalProgressInput = Pick<
  Goal,
  'targetAmount' | 'targetDate' | 'saved' | 'status' | 'createdAt'
>;

/** Progress against the target and, when set, the deadline. */
export function goalProgress(goal: GoalProgressInput, today = todayISO()): GoalProgress {
  const ratio = goal.targetAmount > 0 ? goal.saved / goal.targetAmount : 0;
  const remaining = Math.max(0, goal.targetAmount - goal.saved);
  const reached = goal.saved >= goal.targetAmount;
  const daysLeft = goal.targetDate ? daysBetween(today, goal.targetDate) + 1 : null;
  const expected = expectedRatio(goal, today);

  const pace: GoalPace = reached
    ? 'reached'
    : daysLeft == null
      ? 'no-deadline'
      : daysLeft <= 0
        ? 'overdue'
        : daysLeft === 1
          ? 'due-today'
          : // Small tolerance so a goal does not flip to "behind" on the first day.
            expected != null && ratio + 0.05 < expected
            ? 'behind'
            : 'on-track';

  const usableDays = daysLeft != null && daysLeft > 0 && !reached ? daysLeft : 0;

  return {
    ratio,
    percent: Math.round(ratio * 100),
    remaining,
    reached,
    daysLeft,
    pace,
    expectedRatio: expected,
    perDay: usableDays > 0 ? Math.ceil(remaining / usableDays) : 0,
    perWeek: usableDays > 0 ? Math.ceil(remaining / Math.max(1, usableDays / 7)) : 0,
    perMonth: usableDays > 0 ? Math.ceil(remaining / Math.max(1, usableDays / 30)) : 0,
  };
}

/** Even pace from the day the goal was created to its target date. */
function expectedRatio(goal: GoalProgressInput, today: string): number | null {
  if (!goal.targetDate) return null;
  const start = goal.createdAt.slice(0, 10);
  const span = daysBetween(start, goal.targetDate);
  if (span <= 0) return 1;
  const elapsed = daysBetween(start, today);
  return Math.min(1, Math.max(0, elapsed / span));
}

/** "12 days left", "Due today", "3 days past due", "No deadline". */
export function describeDeadline(progress: GoalProgress): string {
  if (progress.daysLeft == null) return 'No deadline';
  if (progress.daysLeft === 1) return 'Due today';
  if (progress.daysLeft <= 0) {
    const late = 1 - progress.daysLeft;
    return `${late} day${late === 1 ? '' : 's'} past due`;
  }
  return `${progress.daysLeft} day${progress.daysLeft === 1 ? '' : 's'} left`;
}

const PACE_LABELS: Record<GoalPace, string> = {
  reached: 'Target reached',
  'no-deadline': 'No deadline set',
  'on-track': 'On track',
  behind: 'Behind schedule',
  'due-today': 'Due today',
  overdue: 'Past due',
};

export function describePace(pace: GoalPace): string {
  return PACE_LABELS[pace];
}
