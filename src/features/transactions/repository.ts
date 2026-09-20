import type { SQLiteBindValue, SQLiteDatabase } from 'expo-sqlite';
import { z } from 'zod';

import { DomainError, likePattern, runInTransaction } from '@/db/client';
import type { Attachment, EntryKind, Transaction, TransactionDetail } from '@/db/types';
import { isISODate, nowTimestamp } from '@/lib/date';
import { newId } from '@/lib/id';
import { parseAmountInput } from '@/lib/money';

export type TransactionSort = 'newest' | 'oldest' | 'highest' | 'lowest';

export const TRANSACTION_SORTS: readonly { value: TransactionSort; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'highest', label: 'Highest amount' },
  { value: 'lowest', label: 'Lowest amount' },
];

export interface TransactionFilters {
  kind?: EntryKind;
  search?: string;
  from?: string;
  to?: string;
  categoryIds?: string[];
  sourceIds?: string[];
  accountIds?: string[];
  /** Minor units, inclusive. */
  minAmount?: number;
  /** Minor units, inclusive. */
  maxAmount?: number;
  withAttachments?: boolean;
  sort?: TransactionSort;
}

export const transactionInputSchema = z.object({
  kind: z.enum(['income', 'expense']),
  amount: z
    .number({ error: 'Enter an amount' })
    .int()
    .positive('Enter an amount greater than zero')
    .max(Number.MAX_SAFE_INTEGER, 'Amount is too large'),
  categoryId: z.string().min(1, 'Choose a type'),
  sourceId: z.string().min(1).nullable(),
  accountId: z.string().min(1, 'Choose an account'),
  title: z.string().trim().max(80, 'Keep the title under 80 characters'),
  note: z.string().trim().max(500, 'Keep the note under 500 characters').nullable(),
  date: z.string().refine(isISODate, 'Choose a valid date'),
});

export type TransactionInput = z.infer<typeof transactionInputSchema>;

export interface NewAttachment {
  uri: string;
  name: string;
  mimeType: string | null;
  size: number | null;
}

const FROM_JOINS = `
  FROM transactions t
  JOIN categories c ON c.id = t.category_id
  LEFT JOIN sources s ON s.id = t.source_id
  JOIN accounts a ON a.id = t.account_id
  LEFT JOIN recurring_rules r ON r.id = t.recurring_id
  LEFT JOIN goals gl ON gl.id = t.goal_id`;

const SELECT_COLUMNS = `
  t.id, t.kind, t.amount, t.title, t.note, t.date,
  t.category_id AS categoryId, c.name AS categoryName, c.icon AS categoryIcon, c.color AS categoryColor,
  t.source_id AS sourceId, s.name AS sourceName,
  t.account_id AS accountId, a.name AS accountName,
  t.recurring_id AS recurringId, r.name AS recurringName,
  t.goal_id AS goalId, gl.name AS goalName,
  (SELECT COUNT(*) FROM attachments x WHERE x.transaction_id = t.id) AS attachmentCount,
  t.created_at AS createdAt, t.updated_at AS updatedAt`;

const ORDER_BY: Record<TransactionSort, string> = {
  newest: 't.date DESC, t.created_at DESC',
  oldest: 't.date ASC, t.created_at ASC',
  highest: 't.amount DESC, t.date DESC',
  lowest: 't.amount ASC, t.date DESC',
};

function inList(column: string, ids: string[], params: SQLiteBindValue[]): string {
  params.push(...ids);
  return `${column} IN (${ids.map(() => '?').join(', ')})`;
}

export function buildTransactionWhere(filters: TransactionFilters): {
  where: string;
  params: SQLiteBindValue[];
} {
  const clauses: string[] = [];
  const params: SQLiteBindValue[] = [];

  if (filters.kind) {
    clauses.push('t.kind = ?');
    params.push(filters.kind);
  }
  if (filters.from) {
    clauses.push('t.date >= ?');
    params.push(filters.from);
  }
  if (filters.to) {
    clauses.push('t.date <= ?');
    params.push(filters.to);
  }
  if (filters.categoryIds?.length)
    clauses.push(inList('t.category_id', filters.categoryIds, params));
  if (filters.sourceIds?.length) clauses.push(inList('t.source_id', filters.sourceIds, params));
  if (filters.accountIds?.length) clauses.push(inList('t.account_id', filters.accountIds, params));
  if (filters.minAmount != null) {
    clauses.push('t.amount >= ?');
    params.push(filters.minAmount);
  }
  if (filters.maxAmount != null) {
    clauses.push('t.amount <= ?');
    params.push(filters.maxAmount);
  }
  if (filters.withAttachments) {
    clauses.push('EXISTS (SELECT 1 FROM attachments x WHERE x.transaction_id = t.id)');
  }

  const term = filters.search?.trim();
  if (term) {
    const like = likePattern(term);
    const searchable = ['t.title', 't.note', 'c.name', 's.name', 'a.name'];
    const parts = searchable.map((col) => `${col} LIKE ? ESCAPE '\\'`);
    params.push(...searchable.map(() => like));
    const amount = parseAmountInput(term);
    if (amount != null && amount > 0) {
      parts.push('t.amount = ?');
      params.push(amount);
    }
    clauses.push(`(${parts.join(' OR ')})`);
  }

  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

export async function listTransactions(
  db: SQLiteDatabase,
  filters: TransactionFilters,
  { limit, offset = 0 }: { limit: number; offset?: number }
): Promise<Transaction[]> {
  const { where, params } = buildTransactionWhere(filters);
  return db.getAllAsync<Transaction>(
    `SELECT ${SELECT_COLUMNS} ${FROM_JOINS} ${where}
     ORDER BY ${ORDER_BY[filters.sort ?? 'newest']}
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
}

export interface TransactionSummary {
  income: number;
  expense: number;
  count: number;
}

export async function summarizeTransactions(
  db: SQLiteDatabase,
  filters: TransactionFilters
): Promise<TransactionSummary> {
  const { where, params } = buildTransactionWhere(filters);
  const row = await db.getFirstAsync<TransactionSummary>(
    `SELECT
       COALESCE(SUM(CASE WHEN t.kind = 'income' THEN t.amount END), 0) AS income,
       COALESCE(SUM(CASE WHEN t.kind = 'expense' THEN t.amount END), 0) AS expense,
       COUNT(*) AS count
     ${FROM_JOINS} ${where}`,
    params
  );
  return row ?? { income: 0, expense: 0, count: 0 };
}

export async function getTransaction(
  db: SQLiteDatabase,
  id: string
): Promise<TransactionDetail | null> {
  const row = await db.getFirstAsync<Transaction>(
    `SELECT ${SELECT_COLUMNS} ${FROM_JOINS} WHERE t.id = ?`,
    [id]
  );
  if (!row) return null;
  const attachments = await listAttachments(db, id);
  return { ...row, attachments };
}

export async function listAttachments(
  db: SQLiteDatabase,
  transactionId: string
): Promise<Attachment[]> {
  return db.getAllAsync<Attachment>(
    `SELECT id, transaction_id AS transactionId, uri, name, mime_type AS mimeType, size,
       created_at AS createdAt
     FROM attachments WHERE transaction_id = ? ORDER BY created_at`,
    [transactionId]
  );
}

/** Rejects references that do not exist or belong to the other kind. */
async function assertReferences(
  tx: SQLiteDatabase,
  input: TransactionInput,
  previousAccountId?: string
): Promise<void> {
  const category = await tx.getFirstAsync<{ kind: EntryKind }>(
    'SELECT kind FROM categories WHERE id = ?',
    [input.categoryId]
  );
  if (!category) throw new DomainError('The selected type no longer exists.');
  if (category.kind !== input.kind) throw new DomainError(`Choose an ${input.kind} type.`);

  if (input.sourceId) {
    const source = await tx.getFirstAsync<{ kind: EntryKind }>(
      'SELECT kind FROM sources WHERE id = ?',
      [input.sourceId]
    );
    if (!source) throw new DomainError('The selected source no longer exists.');
    if (source.kind !== input.kind) throw new DomainError(`Choose an ${input.kind} source.`);
  }

  const account = await tx.getFirstAsync<{ isArchived: number }>(
    'SELECT is_archived AS isArchived FROM accounts WHERE id = ?',
    [input.accountId]
  );
  if (!account) throw new DomainError('The selected account no longer exists.');
  if (account.isArchived && input.accountId !== previousAccountId) {
    throw new DomainError('The selected account is archived.');
  }
}

async function insertAttachments(
  tx: SQLiteDatabase,
  transactionId: string,
  files: NewAttachment[]
) {
  const now = nowTimestamp();
  for (const file of files) {
    await tx.runAsync(
      `INSERT INTO attachments (id, transaction_id, uri, name, mime_type, size, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [newId(), transactionId, file.uri, file.name, file.mimeType, file.size, now]
    );
  }
}

function ledgerAmounts(input: TransactionInput): [debit: number, credit: number] {
  return input.kind === 'income' ? [input.amount, 0] : [0, input.amount];
}

/** Inserts the transaction, its ledger posting and attachment rows atomically. */
export interface TransactionOrigin {
  /** Set when a recurring rule posted this entry. */
  recurringId?: string;
  /** Set when this entry is the spend that completed a goal. */
  goalId?: string;
}

/**
 * Writes the transaction, its ledger posting and attachments using an existing
 * transaction handle. Callers that already opened one (e.g. completing a goal) use this;
 * everyone else uses `insertTransaction`, which opens one for them.
 */
export async function writeTransaction(
  tx: SQLiteDatabase,
  id: string,
  input: TransactionInput,
  attachments: NewAttachment[],
  { recurringId, goalId }: TransactionOrigin = {}
): Promise<void> {
  const now = nowTimestamp();
  const [debit, credit] = ledgerAmounts(input);
  {
    await assertReferences(tx, input);
    await tx.runAsync(
      `INSERT INTO transactions
         (id, kind, amount, category_id, source_id, account_id, title, note, date, recurring_id,
          goal_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.kind,
        input.amount,
        input.categoryId,
        input.sourceId,
        input.accountId,
        input.title,
        input.note,
        input.date,
        recurringId ?? null,
        goalId ?? null,
        now,
        now,
      ]
    );
    await tx.runAsync(
      `INSERT INTO ledger_entries
         (id, account_id, transaction_id, entry_type, date, description, debit, credit, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [newId(), input.accountId, id, input.kind, input.date, input.title, debit, credit, now]
    );
    await insertAttachments(tx, id, attachments);
  }
}

/** Inserts a transaction in its own database transaction. */
export async function insertTransaction(
  db: SQLiteDatabase,
  id: string,
  input: TransactionInput,
  attachments: NewAttachment[],
  origin: TransactionOrigin = {}
): Promise<void> {
  await runInTransaction(db, (tx) => writeTransaction(tx, id, input, attachments, origin));
}

/**
 * Updates the transaction and re-posts its ledger entry. Returns the removed
 * attachment rows so the caller can delete their files.
 */
export async function modifyTransaction(
  db: SQLiteDatabase,
  id: string,
  input: TransactionInput,
  changes: { added: NewAttachment[]; removedIds: string[] }
): Promise<Attachment[]> {
  const [debit, credit] = ledgerAmounts(input);
  let removed: Attachment[] = [];
  await runInTransaction(db, async (tx) => {
    const existing = await tx.getFirstAsync<{ accountId: string }>(
      'SELECT account_id AS accountId FROM transactions WHERE id = ?',
      [id]
    );
    if (!existing) throw new DomainError('This transaction no longer exists.');
    await assertReferences(tx, input, existing.accountId);

    const now = nowTimestamp();
    await tx.runAsync(
      `UPDATE transactions SET kind = ?, amount = ?, category_id = ?, source_id = ?, account_id = ?,
         title = ?, note = ?, date = ?, updated_at = ?
       WHERE id = ?`,
      [
        input.kind,
        input.amount,
        input.categoryId,
        input.sourceId,
        input.accountId,
        input.title,
        input.note,
        input.date,
        now,
        id,
      ]
    );
    await tx.runAsync(
      `UPDATE ledger_entries SET account_id = ?, entry_type = ?, date = ?, description = ?,
         debit = ?, credit = ?
       WHERE transaction_id = ?`,
      [input.accountId, input.kind, input.date, input.title, debit, credit, id]
    );

    if (changes.removedIds.length) {
      const placeholders = changes.removedIds.map(() => '?').join(', ');
      removed = await tx.getAllAsync<Attachment>(
        `SELECT id, transaction_id AS transactionId, uri, name, mime_type AS mimeType, size,
           created_at AS createdAt
         FROM attachments WHERE transaction_id = ? AND id IN (${placeholders})`,
        [id, ...changes.removedIds]
      );
      await tx.runAsync(
        `DELETE FROM attachments WHERE transaction_id = ? AND id IN (${placeholders})`,
        [id, ...changes.removedIds]
      );
    }
    await insertAttachments(tx, id, changes.added);
  });
  return removed;
}

/** Deletes the transaction (ledger entry and attachment rows cascade). Returns removed attachments. */
export async function removeTransaction(db: SQLiteDatabase, id: string): Promise<Attachment[]> {
  const attachments = await listAttachments(db, id);
  await db.runAsync('DELETE FROM transactions WHERE id = ?', [id]);
  return attachments;
}
