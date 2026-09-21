import type { SQLiteDatabase } from 'expo-sqlite';

import type { EntryKind, GroupTotals, Transaction } from '@/db/types';
import { groupTotals } from '@/features/groups/repository';
import {
  listTransactions,
  summarizeTransactions,
  type TransactionSummary,
} from '@/features/transactions/repository';
import {
  daysBetween,
  endOfMonth,
  previousRange,
  startOfMonth,
  toISODate,
  todayISO,
  type DateRange,
  type WeekStart,
} from '@/lib/date';

import {
  bucketize,
  cumulative,
  pickGranularity,
  type BoundedRange,
  type Bucket,
  type CumulativePoint,
  type DailyTotal,
  type Granularity,
} from './buckets';

export interface BreakdownItem {
  id: string | null;
  name: string;
  icon: string;
  color: string;
  total: number;
  count: number;
}

export interface AccountActivity {
  id: string;
  name: string;
  icon: string;
  color: string;
  accountTypeName: string;
  income: number;
  expense: number;
  balance: number;
}

export interface DashboardData {
  range: BoundedRange;
  totals: TransactionSummary;
  previousTotals: TransactionSummary | null;
  totalBalance: number;
  granularity: Granularity;
  buckets: Bucket[];
  cumulative: CumulativePoint[];
  expenseByCategory: BreakdownItem[];
  incomeByCategory: BreakdownItem[];
  expenseBySource: BreakdownItem[];
  incomeBySource: BreakdownItem[];
  accounts: AccountActivity[];
  /** Group-wise totals for the period; entries without a group are reported together. */
  groups: GroupTotals[];
  recent: Transaction[];
  largestExpenses: Transaction[];
  averageDailyExpense: number;
}

const RANGE_WHERE = '($from IS NULL OR t.date >= $from) AND ($to IS NULL OR t.date <= $to)';

async function getDailyTotals(db: SQLiteDatabase, range: DateRange): Promise<DailyTotal[]> {
  return db.getAllAsync<DailyTotal>(
    `SELECT t.date,
       COALESCE(SUM(CASE WHEN t.kind = 'income' THEN t.amount END), 0) AS income,
       COALESCE(SUM(CASE WHEN t.kind = 'expense' THEN t.amount END), 0) AS expense
     FROM transactions t
     WHERE ${RANGE_WHERE}
     GROUP BY t.date
     ORDER BY t.date`,
    { $from: range.from ?? null, $to: range.to ?? null }
  );
}

async function getBreakdown(
  db: SQLiteDatabase,
  dimension: 'category' | 'source',
  kind: EntryKind,
  range: DateRange
): Promise<BreakdownItem[]> {
  const join =
    dimension === 'category'
      ? 'JOIN categories d ON d.id = t.category_id'
      : 'LEFT JOIN sources d ON d.id = t.source_id';
  return db.getAllAsync<BreakdownItem>(
    `SELECT d.id AS id,
       COALESCE(d.name, 'No source') AS name,
       COALESCE(d.icon, 'help-circle') AS icon,
       COALESCE(d.color, '#94A3B8') AS color,
       SUM(t.amount) AS total,
       COUNT(*) AS count
     FROM transactions t
     ${join}
     WHERE t.kind = $kind AND ${RANGE_WHERE}
     GROUP BY d.id
     ORDER BY total DESC`,
    { $kind: kind, $from: range.from ?? null, $to: range.to ?? null }
  );
}

async function getAccountActivity(
  db: SQLiteDatabase,
  range: DateRange
): Promise<AccountActivity[]> {
  return db.getAllAsync<AccountActivity>(
    `SELECT a.id, a.name, a.icon, a.color, at.name AS accountTypeName,
       COALESCE(SUM(CASE WHEN t.kind = 'income' THEN t.amount END), 0) AS income,
       COALESCE(SUM(CASE WHEN t.kind = 'expense' THEN t.amount END), 0) AS expense,
       (SELECT COALESCE(SUM(l.debit - l.credit), 0) FROM ledger_entries l WHERE l.account_id = a.id) AS balance
     FROM accounts a
     JOIN account_types at ON at.id = a.account_type_id
     LEFT JOIN transactions t ON t.account_id = a.id AND ${RANGE_WHERE}
     GROUP BY a.id
     HAVING a.is_archived = 0 OR COUNT(t.id) > 0
     ORDER BY balance DESC`,
    { $from: range.from ?? null, $to: range.to ?? null }
  );
}

async function getTotalBalance(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ total: number }>(
    'SELECT COALESCE(SUM(debit - credit), 0) AS total FROM ledger_entries'
  );
  return row?.total ?? 0;
}

/** Turns an open-ended range ("all time") into concrete bounds based on the stored data. */
async function boundRange(db: SQLiteDatabase, range: DateRange): Promise<BoundedRange> {
  if (range.from && range.to) return { from: range.from, to: range.to };
  const bounds = await db.getFirstAsync<{ first: string | null; last: string | null }>(
    'SELECT MIN(date) AS first, MAX(date) AS last FROM transactions'
  );
  const today = todayISO();
  const now = new Date();
  const from = range.from ?? bounds?.first ?? toISODate(startOfMonth(now));
  let to = range.to ?? (bounds?.last && bounds.last > today ? bounds.last : today);
  if (to < from) to = toISODate(endOfMonth(now));
  return { from, to };
}

export async function getDashboardData(
  db: SQLiteDatabase,
  requested: DateRange,
  weekStartsOn: WeekStart
): Promise<DashboardData> {
  const range = await boundRange(db, requested);
  const previous = previousRange(requested);
  const filters = { from: requested.from, to: requested.to };

  const [
    totals,
    previousTotals,
    totalBalance,
    daily,
    expenseByCategory,
    incomeByCategory,
    expenseBySource,
    incomeBySource,
    accounts,
    groups,
    recent,
    largestExpenses,
  ] = await Promise.all([
    summarizeTransactions(db, filters),
    previous ? summarizeTransactions(db, previous) : Promise.resolve(null),
    getTotalBalance(db),
    getDailyTotals(db, requested),
    getBreakdown(db, 'category', 'expense', requested),
    getBreakdown(db, 'category', 'income', requested),
    getBreakdown(db, 'source', 'expense', requested),
    getBreakdown(db, 'source', 'income', requested),
    getAccountActivity(db, requested),
    groupTotals(db, requested),
    listTransactions(db, {}, { limit: 6 }),
    listTransactions(db, { ...filters, kind: 'expense', sort: 'highest' }, { limit: 5 }),
  ]);

  const granularity = pickGranularity(range);
  const buckets = bucketize(daily, range, granularity, weekStartsOn);
  // Average over elapsed days only, so a half-finished month is not diluted.
  const today = todayISO();
  const elapsedTo = range.to < today ? range.to : today;
  const elapsedDays = Math.max(1, daysBetween(range.from, elapsedTo) + 1);

  return {
    range,
    totals,
    previousTotals,
    totalBalance,
    granularity,
    buckets,
    cumulative: cumulative(buckets),
    expenseByCategory,
    incomeByCategory,
    expenseBySource,
    incomeBySource,
    accounts,
    groups,
    recent,
    largestExpenses,
    averageDailyExpense: Math.round(totals.expense / elapsedDays),
  };
}
