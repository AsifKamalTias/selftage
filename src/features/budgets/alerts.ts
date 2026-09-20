import type { SQLiteDatabase } from 'expo-sqlite';

import type { BudgetHealth, BudgetPeriod, BudgetStatus } from '@/db/types';
import { getWeekStart } from '@/features/settings/repository';

import { listBudgetStatuses } from './repository';

export interface BudgetAlert {
  budgetId: string;
  /** Category name, or "Overall spending" for the whole-period budget. */
  label: string;
  period: BudgetPeriod;
  health: Exclude<BudgetHealth, 'ok'>;
  spent: number;
  amount: number;
  remaining: number;
  progress: number;
  daysLeft: number;
}

const RANK: Record<BudgetHealth, number> = { ok: 0, warning: 1, exceeded: 2 };

export function budgetLabel(status: Pick<BudgetStatus, 'categoryName'>): string {
  return status.categoryName ?? 'Overall spending';
}

/** Health of every active budget, keyed by id — the "before" half of a comparison. */
export async function budgetHealthSnapshot(db: SQLiteDatabase): Promise<Map<string, BudgetHealth>> {
  const weekStartsOn = await getWeekStart(db);
  const statuses = await listBudgetStatuses(db, { weekStartsOn });
  return new Map(statuses.map((status) => [status.id, status.health]));
}

/**
 * Alerts for budgets that got worse since `before`, so a limit is announced when it is
 * crossed rather than on every later transaction. Most severe first.
 */
export async function budgetAlertsSince(
  db: SQLiteDatabase,
  before: Map<string, BudgetHealth>
): Promise<BudgetAlert[]> {
  const weekStartsOn = await getWeekStart(db);
  const statuses = await listBudgetStatuses(db, { weekStartsOn });
  return statuses
    .filter((status) => RANK[status.health] > RANK[before.get(status.id) ?? 'ok'])
    .sort((a, b) => RANK[b.health] - RANK[a.health])
    .map((status) => ({
      budgetId: status.id,
      label: budgetLabel(status),
      period: status.period,
      health: status.health as Exclude<BudgetHealth, 'ok'>,
      spent: status.spent,
      amount: status.amount,
      remaining: status.remaining,
      progress: status.progress,
      daysLeft: status.daysLeft,
    }));
}
