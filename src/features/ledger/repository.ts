import type { SQLiteDatabase } from 'expo-sqlite';

import { likePattern } from '@/db/client';
import type { LedgerEntry, LedgerEntryType } from '@/db/types';

export interface LedgerFilters {
  /** Omit for a combined ledger across all accounts. */
  accountId?: string;
  from?: string;
  to?: string;
  search?: string;
  entryType?: LedgerEntryType;
}

export interface LedgerSummary {
  /** Balance brought forward from before `from` (0 when no lower bound). */
  openingBalance: number;
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
  entryCount: number;
}

/**
 * Opening-balance entries always sort before regular entries, regardless of date,
 * so an account's opening balance is the first line of its ledger.
 */
const SEQUENCE = `CASE l.entry_type WHEN 'opening' THEN 0 ELSE 1 END, l.date, l.created_at, l.id`;

/** True when a row falls inside the requested date range. Openings count as "before" any range start. */
const IN_RANGE = `($from IS NULL OR (o.entryType != 'opening' AND o.date >= $from))
  AND ($to IS NULL OR o.entryType = 'opening' OR o.date <= $to)`;

function scopeParams(filters: LedgerFilters) {
  return {
    $accountId: filters.accountId ?? null,
    $from: filters.from ?? null,
    $to: filters.to ?? null,
  };
}

/**
 * Returns ledger lines with a running balance. The balance is computed over the
 * whole account scope first, so it stays correct when date/search filters or
 * pagination hide earlier rows.
 */
export async function listLedgerEntries(
  db: SQLiteDatabase,
  filters: LedgerFilters,
  {
    limit = -1,
    offset = 0,
    order = 'desc',
  }: { limit?: number; offset?: number; order?: 'asc' | 'desc' } = {}
): Promise<LedgerEntry[]> {
  const term = filters.search?.trim();
  const direction = order === 'asc' ? 'ASC' : 'DESC';
  return db.getAllAsync<LedgerEntry>(
    `WITH ordered AS (
       SELECT l.id, l.account_id AS accountId, l.transaction_id AS transactionId,
         l.entry_type AS entryType, l.date, l.description, l.debit, l.credit,
         l.created_at AS createdAt,
         SUM(l.debit - l.credit) OVER (ORDER BY ${SEQUENCE} ROWS UNBOUNDED PRECEDING) AS balance,
         ROW_NUMBER() OVER (ORDER BY ${SEQUENCE}) AS seq
       FROM ledger_entries l
       WHERE ($accountId IS NULL OR l.account_id = $accountId)
     )
     SELECT o.id, o.accountId, a.name AS accountName, o.transactionId, o.entryType, o.date,
       o.description, c.name AS categoryName, s.name AS sourceName,
       o.debit, o.credit, o.balance, o.createdAt
     FROM ordered o
     JOIN accounts a ON a.id = o.accountId
     LEFT JOIN transactions t ON t.id = o.transactionId
     LEFT JOIN categories c ON c.id = t.category_id
     LEFT JOIN sources s ON s.id = t.source_id
     WHERE ${IN_RANGE}
       AND ($entryType IS NULL OR o.entryType = $entryType)
       AND ($search IS NULL
         OR o.description LIKE $search ESCAPE '\\'
         OR t.note LIKE $search ESCAPE '\\'
         OR c.name LIKE $search ESCAPE '\\'
         OR s.name LIKE $search ESCAPE '\\'
         OR a.name LIKE $search ESCAPE '\\')
     ORDER BY o.seq ${direction}
     LIMIT $limit OFFSET $offset`,
    {
      ...scopeParams(filters),
      $entryType: filters.entryType ?? null,
      $search: term ? likePattern(term) : null,
      $limit: limit,
      $offset: offset,
    }
  );
}

/** Totals for the account scope and date range. Search/type filters are intentionally ignored. */
export async function getLedgerSummary(
  db: SQLiteDatabase,
  filters: LedgerFilters
): Promise<LedgerSummary> {
  const row = await db.getFirstAsync<Omit<LedgerSummary, 'closingBalance'>>(
    `WITH o AS (
       SELECT l.entry_type AS entryType, l.date, l.debit, l.credit
       FROM ledger_entries l
       WHERE ($accountId IS NULL OR l.account_id = $accountId)
     )
     SELECT
       COALESCE(SUM(CASE WHEN $from IS NOT NULL AND (o.entryType = 'opening' OR o.date < $from)
         THEN o.debit - o.credit END), 0) AS openingBalance,
       COALESCE(SUM(CASE WHEN ${IN_RANGE} THEN o.debit END), 0) AS totalDebit,
       COALESCE(SUM(CASE WHEN ${IN_RANGE} THEN o.credit END), 0) AS totalCredit,
       COALESCE(SUM(CASE WHEN ${IN_RANGE} THEN 1 END), 0) AS entryCount
     FROM o`,
    scopeParams(filters)
  );
  const summary = row ?? { openingBalance: 0, totalDebit: 0, totalCredit: 0, entryCount: 0 };
  return {
    ...summary,
    closingBalance: summary.openingBalance + summary.totalDebit - summary.totalCredit,
  };
}

export interface LedgerStatement {
  accountId: string | null;
  accountName: string;
  summary: LedgerSummary;
  entries: LedgerEntry[];
}

/** Statement per account (or combined) for the ledger report, oldest entry first. */
export async function getLedgerStatements(
  db: SQLiteDatabase,
  { from, to, accountIds }: { from?: string; to?: string; accountIds: string[] | null }
): Promise<LedgerStatement[]> {
  if (accountIds === null) {
    const filters = { from, to };
    const [summary, entries] = await Promise.all([
      getLedgerSummary(db, filters),
      listLedgerEntries(db, filters, { order: 'asc' }),
    ]);
    return [{ accountId: null, accountName: 'All accounts', summary, entries }];
  }

  const accounts = await db.getAllAsync<{ id: string; name: string }>(
    `SELECT id, name FROM accounts WHERE id IN (${accountIds.map(() => '?').join(', ')})
     ORDER BY created_at`,
    accountIds
  );
  const statements: LedgerStatement[] = [];
  for (const account of accounts) {
    const filters = { accountId: account.id, from, to };
    const [summary, entries] = await Promise.all([
      getLedgerSummary(db, filters),
      listLedgerEntries(db, filters, { order: 'asc' }),
    ]);
    statements.push({ accountId: account.id, accountName: account.name, summary, entries });
  }
  return statements;
}
