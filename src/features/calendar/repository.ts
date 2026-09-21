import type { SQLiteDatabase } from 'expo-sqlite';

import type {
  BudgetStatus,
  Installment,
  Obligation,
  ObligationDirection,
  RecurrenceMode,
  RecurringOccurrence,
  Transaction,
} from '@/db/types';
import { listBudgetStatuses } from '@/features/budgets/repository';
import { listInstallmentsDue, listObligationsDue } from '@/features/outstanding/repository';
import { listPendingOccurrences } from '@/features/recurring/occurrences';
import { listRecurringRules } from '@/features/recurring/repository';
import { occursOn } from '@/features/recurring/schedule';
import { listTransactions } from '@/features/transactions/repository';
import { parseISODate, type WeekStart } from '@/lib/date';

/** One cell of the month grid. */
export interface CalendarDay {
  date: string;
  income: number;
  expense: number;
  count: number;
}

export async function monthTotals(
  db: SQLiteDatabase,
  { from, to }: { from: string; to: string }
): Promise<CalendarDay[]> {
  return db.getAllAsync<CalendarDay>(
    `SELECT t.date,
       COALESCE(SUM(CASE WHEN t.kind = 'income' THEN t.amount END), 0) AS income,
       COALESCE(SUM(CASE WHEN t.kind = 'expense' THEN t.amount END), 0) AS expense,
       COUNT(*) AS count
     FROM transactions t
     WHERE t.date >= ? AND t.date <= ?
     GROUP BY t.date
     ORDER BY t.date`,
    [from, to]
  );
}

/** A rule that falls on the day but has not been posted or queued yet. */
export interface ScheduledEntry {
  ruleId: string;
  name: string;
  kind: Transaction['kind'];
  amount: number;
  mode: RecurrenceMode;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  accountName: string;
}

export interface DayReport {
  date: string;
  income: number;
  expense: number;
  net: number;
  count: number;
  transactions: Transaction[];
  /** Manual occurrences due that day, still waiting to be confirmed. */
  pending: RecurringOccurrence[];
  /** Rules that fall on the day with nothing recorded for it yet. */
  scheduled: ScheduledEntry[];
  /** Budgets whose window contains the day, resolved against that window's spending. */
  budgets: BudgetStatus[];
  /** Outstanding records whose own due date is this day and are not settled. */
  obligationsDue: Obligation[];
  /** Installments scheduled for this day, paid or not. */
  installmentsDue: (Installment & {
    title: string;
    contactName: string;
    direction: ObligationDirection;
  })[];
}

/** Everything that happened, is waiting, or is expected on one day. */
export async function getDayReport(
  db: SQLiteDatabase,
  date: string,
  weekStartsOn: WeekStart
): Promise<DayReport> {
  const [transactions, pendingAll, rules, budgets, obligationsDue, installmentsDue] =
    await Promise.all([
      listTransactions(db, { from: date, to: date, sort: 'newest' }, { limit: 200 }),
      listPendingOccurrences(db),
      listRecurringRules(db, { includeInactive: false }),
      listBudgetStatuses(db, { weekStartsOn, now: parseISODate(date) }),
      listObligationsDue(db, date),
      listInstallmentsDue(db, date),
    ]);

  const income = transactions
    .filter((t) => t.kind === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  const expense = transactions
    .filter((t) => t.kind === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const pending = pendingAll.filter((occurrence) => occurrence.dueDate === date);
  const alreadyPosted = new Set(
    transactions.map((t) => t.recurringId).filter((id): id is string => !!id)
  );
  const waiting = new Set(pending.map((occurrence) => occurrence.ruleId));

  const scheduled: ScheduledEntry[] = rules
    .filter((rule) => !alreadyPosted.has(rule.id) && !waiting.has(rule.id) && occursOn(rule, date))
    .map((rule) => ({
      ruleId: rule.id,
      name: rule.name,
      kind: rule.kind,
      amount: rule.amount,
      mode: rule.mode,
      categoryName: rule.categoryName,
      categoryIcon: rule.categoryIcon,
      categoryColor: rule.categoryColor,
      accountName: rule.accountName,
    }));

  return {
    date,
    income,
    expense,
    net: income - expense,
    count: transactions.length,
    transactions,
    pending,
    scheduled,
    budgets,
    obligationsDue,
    installmentsDue,
  };
}
