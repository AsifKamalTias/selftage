import type { SQLiteDatabase } from 'expo-sqlite';
import { z } from 'zod';

import { DomainError } from '@/db/client';
import type { Budget, BudgetHealth, BudgetPeriod, BudgetStatus } from '@/db/types';
import { nowTimestamp } from '@/lib/date';
import type { WeekStart } from '@/lib/date';
import { newId } from '@/lib/id';

import { budgetWindow } from './period';

export const DEFAULT_WARN_AT = 80;

export const budgetInputSchema = z.object({
  /** null is the overall budget for the period. */
  categoryId: z.string().min(1).nullable(),
  period: z.enum(['daily', 'weekly', 'monthly']),
  amount: z.number().int().positive('Enter a limit greater than zero'),
  warnAt: z
    .number()
    .int()
    .min(1, 'Warn at 1% or more')
    .max(100, 'Warn at 100% or less')
    .default(DEFAULT_WARN_AT),
});

export type BudgetInput = z.infer<typeof budgetInputSchema>;

const SELECT_COLUMNS = `
  b.id, b.category_id AS categoryId, c.name AS categoryName, c.icon AS categoryIcon,
  c.color AS categoryColor, b.period, b.amount, b.warn_at AS warnAt, b.is_active AS isActive,
  b.created_at AS createdAt, b.updated_at AS updatedAt`;

type BudgetRow = Omit<Budget, 'isActive'> & { isActive: number };

const PERIOD_ORDER = "CASE b.period WHEN 'daily' THEN 0 WHEN 'weekly' THEN 1 ELSE 2 END";

const toBudget = (row: BudgetRow): Budget => ({ ...row, isActive: row.isActive === 1 });

export async function listBudgets(
  db: SQLiteDatabase,
  { activeOnly = false }: { activeOnly?: boolean } = {}
): Promise<Budget[]> {
  const rows = await db.getAllAsync<BudgetRow>(
    `SELECT ${SELECT_COLUMNS}
     FROM budgets b
     LEFT JOIN categories c ON c.id = b.category_id
     ${activeOnly ? 'WHERE b.is_active = 1' : ''}
     ORDER BY ${PERIOD_ORDER}, b.category_id IS NOT NULL, c.name COLLATE NOCASE`
  );
  return rows.map(toBudget);
}

export async function getBudget(db: SQLiteDatabase, id: string): Promise<Budget | null> {
  const row = await db.getFirstAsync<BudgetRow>(
    `SELECT ${SELECT_COLUMNS}
     FROM budgets b
     LEFT JOIN categories c ON c.id = b.category_id
     WHERE b.id = ?`,
    [id]
  );
  return row ? toBudget(row) : null;
}

/**
 * One budget per scope and period. Checked in code because SQLite on web reports
 * UNIQUE violations only as a generic failure.
 */
async function assertScopeFree(
  db: SQLiteDatabase,
  { categoryId, period }: Pick<BudgetInput, 'categoryId' | 'period'>,
  excludeId?: string
): Promise<void> {
  const existing = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM budgets
     WHERE period = ? AND IFNULL(category_id, '*') = ? AND (? IS NULL OR id != ?)
     LIMIT 1`,
    [period, categoryId ?? '*', excludeId ?? null, excludeId ?? null]
  );
  if (existing) {
    throw new DomainError(
      categoryId
        ? 'This type already has a budget for that period. Edit it instead.'
        : 'An overall budget already exists for that period. Edit it instead.'
    );
  }
}

async function assertExpenseCategory(db: SQLiteDatabase, categoryId: string): Promise<void> {
  const category = await db.getFirstAsync<{ kind: string }>(
    'SELECT kind FROM categories WHERE id = ?',
    [categoryId]
  );
  if (!category) throw new DomainError('The selected type no longer exists.');
  if (category.kind !== 'expense') throw new DomainError('Budgets apply to expense types only.');
}

export async function createBudget(db: SQLiteDatabase, input: BudgetInput): Promise<string> {
  const data = budgetInputSchema.parse(input);
  if (data.categoryId) await assertExpenseCategory(db, data.categoryId);
  await assertScopeFree(db, data);
  const id = newId();
  const now = nowTimestamp();
  await db.runAsync(
    `INSERT INTO budgets (id, category_id, period, amount, warn_at, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
    [id, data.categoryId, data.period, data.amount, data.warnAt, now, now]
  );
  return id;
}

export async function updateBudget(
  db: SQLiteDatabase,
  id: string,
  input: BudgetInput
): Promise<void> {
  const data = budgetInputSchema.parse(input);
  if (data.categoryId) await assertExpenseCategory(db, data.categoryId);
  await assertScopeFree(db, data, id);
  await db.runAsync(
    `UPDATE budgets SET category_id = ?, period = ?, amount = ?, warn_at = ?, updated_at = ?
     WHERE id = ?`,
    [data.categoryId, data.period, data.amount, data.warnAt, nowTimestamp(), id]
  );
}

export async function setBudgetActive(
  db: SQLiteDatabase,
  id: string,
  isActive: boolean
): Promise<void> {
  await db.runAsync('UPDATE budgets SET is_active = ?, updated_at = ? WHERE id = ?', [
    isActive ? 1 : 0,
    nowTimestamp(),
    id,
  ]);
}

export async function deleteBudget(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM budgets WHERE id = ?', [id]);
}

/** Single source of truth for the three budget states. */
export function budgetHealth(spent: number, amount: number, warnAt: number): BudgetHealth {
  if (amount <= 0) return 'ok';
  if (spent >= amount) return 'exceeded';
  return (spent / amount) * 100 >= warnAt ? 'warning' : 'ok';
}

export interface BudgetStatusOptions {
  weekStartsOn: WeekStart;
  now?: Date;
  /** Include paused budgets (the management screen shows them). */
  includeInactive?: boolean;
}

/** Expense totals for one window: per category plus the overall total. */
async function spendingInWindow(db: SQLiteDatabase, from: string, to: string) {
  const rows = await db.getAllAsync<{ categoryId: string; spent: number }>(
    `SELECT category_id AS categoryId, SUM(amount) AS spent
     FROM transactions
     WHERE kind = 'expense' AND date >= ? AND date <= ?
     GROUP BY category_id`,
    [from, to]
  );
  const byCategory = new Map(rows.map((row) => [row.categoryId, row.spent]));
  const total = rows.reduce((sum, row) => sum + row.spent, 0);
  return { byCategory, total };
}

/** Budgets resolved against the spending in their current period. */
export async function listBudgetStatuses(
  db: SQLiteDatabase,
  { weekStartsOn, now = new Date(), includeInactive = false }: BudgetStatusOptions
): Promise<BudgetStatus[]> {
  const budgets = await listBudgets(db, { activeOnly: !includeInactive });
  if (budgets.length === 0) return [];

  const periods = [...new Set(budgets.map((b) => b.period))] as BudgetPeriod[];
  const windows = new Map(
    periods.map((period) => [period, budgetWindow(period, { weekStartsOn, now })])
  );
  const spending = new Map(
    await Promise.all(
      periods.map(async (period) => {
        const window = windows.get(period)!;
        return [period, await spendingInWindow(db, window.from, window.to)] as const;
      })
    )
  );

  return budgets.map((budget) => {
    const window = windows.get(budget.period)!;
    const totals = spending.get(budget.period)!;
    const spent = budget.categoryId
      ? (totals.byCategory.get(budget.categoryId) ?? 0)
      : totals.total;
    return {
      ...budget,
      from: window.from,
      to: window.to,
      daysLeft: window.daysLeft,
      spent,
      remaining: budget.amount - spent,
      progress: spent / budget.amount,
      health: budgetHealth(spent, budget.amount, budget.warnAt),
    };
  });
}

/** Spending so far in the current window for a scope, to help pick a sensible limit. */
export async function getScopeSpending(
  db: SQLiteDatabase,
  {
    categoryId,
    period,
    weekStartsOn,
    now = new Date(),
  }: { categoryId: string | null; period: BudgetPeriod; weekStartsOn: WeekStart; now?: Date }
): Promise<{ spent: number; from: string; to: string }> {
  const window = budgetWindow(period, { weekStartsOn, now });
  const row = await db.getFirstAsync<{ spent: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS spent
     FROM transactions
     WHERE kind = 'expense' AND date >= $from AND date <= $to
       AND ($categoryId IS NULL OR category_id = $categoryId)`,
    { $from: window.from, $to: window.to, $categoryId: categoryId }
  );
  return { spent: row?.spent ?? 0, from: window.from, to: window.to };
}

export async function getBudgetSummary(
  db: SQLiteDatabase,
  options: BudgetStatusOptions
): Promise<{ statuses: BudgetStatus[]; warning: number; exceeded: number }> {
  const statuses = await listBudgetStatuses(db, options);
  return {
    statuses,
    warning: statuses.filter((s) => s.health === 'warning').length,
    exceeded: statuses.filter((s) => s.health === 'exceeded').length,
  };
}
