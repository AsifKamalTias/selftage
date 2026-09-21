/**
 * Domain models. SQL queries alias snake_case columns to these camelCase names,
 * so rows can be returned without a mapping step. Amounts are integer minor units
 * (see `src/lib/money.ts`), dates are local `YYYY-MM-DD` strings.
 */

export type EntryKind = 'income' | 'expense';

export const ENTRY_KINDS: readonly EntryKind[] = ['expense', 'income'];

/** An income or expense "type" in the UI (e.g. Salary, Groceries). */
export interface Category {
  id: string;
  kind: EntryKind;
  name: string;
  icon: string;
  color: string;
  createdAt: string;
  updatedAt: string;
  /** Number of transactions referencing this row (list queries only). */
  usageCount?: number;
}

/** Who money came from or went to (e.g. Employer, Supermarket). */
export interface Source {
  id: string;
  kind: EntryKind;
  name: string;
  icon: string;
  color: string;
  createdAt: string;
  updatedAt: string;
  usageCount?: number;
}

export interface AccountType {
  id: string;
  name: string;
  icon: string;
  color: string;
  createdAt: string;
  updatedAt: string;
  accountCount?: number;
}

export interface Account {
  id: string;
  accountTypeId: string;
  accountTypeName: string;
  name: string;
  accountNumber: string | null;
  note: string | null;
  icon: string;
  color: string;
  openingBalance: number;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AccountWithBalance extends Account {
  balance: number;
  totalIncome: number;
  totalExpense: number;
  transactionCount: number;
  /** Held by active goals. */
  reserved: number;
  /** Balance minus what goals are holding. */
  available: number;
}

export interface Attachment {
  id: string;
  transactionId: string;
  uri: string;
  name: string;
  mimeType: string | null;
  size: number | null;
  createdAt: string;
}

export interface Transaction {
  id: string;
  kind: EntryKind;
  amount: number;
  title: string;
  note: string | null;
  date: string;
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  sourceId: string | null;
  sourceName: string | null;
  accountId: string;
  accountName: string;
  attachmentCount: number;
  /** Set when the entry was posted by a recurring rule. */
  recurringId: string | null;
  recurringName: string | null;
  /** Set when the entry is the spend that completed a goal. */
  goalId: string | null;
  goalName: string | null;
  /** Optional grouping across types, sources and accounts (a trip, a project). */
  groupId: string | null;
  groupName: string | null;
  groupIcon: string | null;
  groupColor: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionDetail extends Transaction {
  attachments: Attachment[];
}

export type LedgerEntryType = 'opening' | EntryKind;

export interface LedgerEntry {
  id: string;
  accountId: string;
  accountName: string;
  transactionId: string | null;
  entryType: LedgerEntryType;
  date: string;
  description: string;
  categoryName: string | null;
  sourceName: string | null;
  /** Money in. */
  debit: number;
  /** Money out. */
  credit: number;
  /** Running balance after this entry within the current ledger view. */
  balance: number;
  createdAt: string;
}

/** A user-defined bundle of entries that belong together, reported on as one. */
export interface Group {
  id: string;
  name: string;
  note: string | null;
  icon: string;
  color: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  /** Totals across every entry in the group, all time. */
  income: number;
  expense: number;
  /** income − expense. */
  net: number;
  transactionCount: number;
  firstDate: string | null;
  lastDate: string | null;
}

/** One row of the group-wise report, scoped to the report's period. */
export interface GroupTotals {
  id: string;
  name: string;
  icon: string;
  color: string;
  income: number;
  expense: number;
  net: number;
  count: number;
}

export type GoalStatus = 'active' | 'completed';

/** A savings target. Money is reserved from accounts until the goal is completed. */
export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  targetDate: string | null;
  note: string | null;
  icon: string;
  color: string;
  status: GoalStatus;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Net of all contributions (reserved while active, spent once completed). */
  saved: number;
  contributionCount: number;
}

export interface GoalContribution {
  id: string;
  goalId: string;
  accountId: string;
  accountName: string;
  accountIcon: string;
  accountColor: string;
  /** Positive reserves money, negative releases it. */
  amount: number;
  date: string;
  note: string | null;
  createdAt: string;
}

/** Money reserved per account, so a goal cannot hold more than the account has. */
export interface AccountAvailability {
  accountId: string;
  reserved: number;
  available: number;
}

export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export const RECURRENCE_FREQUENCIES: readonly RecurrenceFrequency[] = [
  'daily',
  'weekly',
  'monthly',
  'yearly',
];

/** Automatic rules post by themselves; manual ones wait to be marked paid. */
export type RecurrenceMode = 'auto' | 'manual';

/** A template that posts a transaction every `intervalCount` × `frequency`. */
export interface RecurringRule {
  id: string;
  kind: EntryKind;
  name: string;
  amount: number;
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  sourceId: string | null;
  sourceName: string | null;
  accountId: string;
  accountName: string;
  note: string | null;
  mode: RecurrenceMode;
  /** Optional grouping applied to every entry this rule posts. */
  groupId: string | null;
  groupName: string | null;
  frequency: RecurrenceFrequency;
  /** Every N periods; 1 = every period. */
  intervalCount: number;
  startDate: string;
  /** Next occurrence not yet posted. */
  nextDate: string;
  lastRunDate: string | null;
  isActive: boolean;
  /** Transactions posted by this rule so far (list queries only). */
  postedCount?: number;
  /** Manual occurrences still waiting to be marked paid (list queries only). */
  pendingCount?: number;
  createdAt: string;
  updatedAt: string;
}

export type OccurrenceStatus = 'pending' | 'paid' | 'skipped';

/** One dated instance of a manual rule, waiting for the user to confirm it was paid. */
export interface RecurringOccurrence {
  id: string;
  ruleId: string;
  dueDate: string;
  status: OccurrenceStatus;
  transactionId: string | null;
  createdAt: string;
  resolvedAt: string | null;
  /** Denormalised rule details, so a due list needs one query. */
  name: string;
  kind: EntryKind;
  amount: number;
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  sourceId: string | null;
  accountId: string;
  accountName: string;
  groupId: string | null;
  note: string | null;
}

export type BudgetPeriod = 'daily' | 'weekly' | 'monthly';

export const BUDGET_PERIODS: readonly BudgetPeriod[] = ['daily', 'weekly', 'monthly'];

/** A spending limit. `categoryId === null` is the overall limit for that period. */
export interface Budget {
  id: string;
  categoryId: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
  categoryColor: string | null;
  period: BudgetPeriod;
  amount: number;
  /** Percentage of `amount` at which the warning starts. */
  warnAt: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type BudgetHealth = 'ok' | 'warning' | 'exceeded';

/** A budget resolved against the spending in its current period. */
export interface BudgetStatus extends Budget {
  /** Start of the current period (inclusive). */
  from: string;
  /** End of the current period (inclusive). */
  to: string;
  spent: number;
  /** Negative once the limit is passed. */
  remaining: number;
  /** Share of the limit used, where 1 is exactly at the limit. */
  progress: number;
  health: BudgetHealth;
  /** Days left in the period, including today. */
  daysLeft: number;
}
