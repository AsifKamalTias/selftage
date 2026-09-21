import type { SQLiteDatabase } from 'expo-sqlite';

import { DomainError, runInTransaction } from '@/db/client';
import type { RecurringOccurrence } from '@/db/types';
import { writeTransaction } from '@/features/transactions/repository';
import { isISODate, nowTimestamp } from '@/lib/date';
import { newId } from '@/lib/id';

const SELECT_COLUMNS = `
  o.id, o.rule_id AS ruleId, o.due_date AS dueDate, o.status,
  o.transaction_id AS transactionId, o.created_at AS createdAt, o.resolved_at AS resolvedAt,
  r.name, r.kind, r.amount, r.note,
  r.category_id AS categoryId, c.name AS categoryName, c.icon AS categoryIcon,
  c.color AS categoryColor,
  r.source_id AS sourceId,
  r.account_id AS accountId, a.name AS accountName,
  r.group_id AS groupId`;

const FROM_JOINS = `
  FROM recurring_occurrences o
  JOIN recurring_rules r ON r.id = o.rule_id
  JOIN categories c ON c.id = r.category_id
  JOIN accounts a ON a.id = r.account_id`;

/**
 * Queues a due date for a manual rule. The unique index makes a repeated catch-up a
 * no-op, so this is safe to call for every date a rule has fallen due on.
 */
export async function queueOccurrence(
  db: SQLiteDatabase,
  ruleId: string,
  dueDate: string
): Promise<void> {
  await db.runAsync(
    `INSERT OR IGNORE INTO recurring_occurrences (id, rule_id, due_date, status, created_at)
     VALUES (?, ?, ?, 'pending', ?)`,
    [newId(), ruleId, dueDate, nowTimestamp()]
  );
}

/** Everything still waiting to be marked paid, oldest first. */
export async function listPendingOccurrences(
  db: SQLiteDatabase,
  { ruleId }: { ruleId?: string } = {}
): Promise<RecurringOccurrence[]> {
  return db.getAllAsync<RecurringOccurrence>(
    `SELECT ${SELECT_COLUMNS} ${FROM_JOINS}
     WHERE o.status = 'pending' AND ($ruleId IS NULL OR o.rule_id = $ruleId)
     ORDER BY o.due_date, r.name COLLATE NOCASE`,
    { $ruleId: ruleId ?? null }
  );
}

export async function getOccurrence(
  db: SQLiteDatabase,
  id: string
): Promise<RecurringOccurrence | null> {
  return db.getFirstAsync<RecurringOccurrence>(
    `SELECT ${SELECT_COLUMNS} ${FROM_JOINS} WHERE o.id = ?`,
    [id]
  );
}

export interface MarkPaidInput {
  occurrenceId: string;
  /** Defaults to the due date; can be any day the money actually moved. */
  date?: string;
  /** Defaults to the rule's amount, for bills that vary. */
  amount?: number;
  accountId?: string;
  note?: string | null;
}

/**
 * Posts the entry this occurrence stands for and closes it, both in one database
 * transaction so a pending row can never be left pointing at a missing entry.
 */
export async function markOccurrencePaid(
  db: SQLiteDatabase,
  input: MarkPaidInput
): Promise<{ transactionId: string; name: string; amount: number }> {
  const occurrence = await getOccurrence(db, input.occurrenceId);
  if (!occurrence) throw new DomainError('This entry is no longer waiting to be paid.');
  if (occurrence.status !== 'pending') {
    throw new DomainError(`This entry was already marked ${occurrence.status}.`);
  }

  const date = input.date ?? occurrence.dueDate;
  if (!isISODate(date)) throw new DomainError('Choose a valid date.');
  const amount = input.amount ?? occurrence.amount;
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new DomainError('Enter an amount greater than zero.');
  }

  const transactionId = newId();
  await runInTransaction(db, async (tx) => {
    await writeTransaction(
      tx,
      transactionId,
      {
        kind: occurrence.kind,
        amount,
        categoryId: occurrence.categoryId,
        sourceId: occurrence.sourceId,
        accountId: input.accountId ?? occurrence.accountId,
        title: occurrence.name,
        note: input.note !== undefined ? input.note : occurrence.note,
        date,
        groupId: occurrence.groupId,
      },
      [],
      { recurringId: occurrence.ruleId }
    );
    await tx.runAsync(
      `UPDATE recurring_occurrences
         SET status = 'paid', transaction_id = ?, resolved_at = ?
       WHERE id = ?`,
      [transactionId, nowTimestamp(), input.occurrenceId]
    );
  });

  return { transactionId, name: occurrence.name, amount };
}

/** Closes an occurrence without posting anything — the bill simply was not paid. */
export async function skipOccurrence(db: SQLiteDatabase, id: string): Promise<void> {
  const result = await db.runAsync(
    `UPDATE recurring_occurrences SET status = 'skipped', resolved_at = ?
     WHERE id = ? AND status = 'pending'`,
    [nowTimestamp(), id]
  );
  if (result.changes === 0) throw new DomainError('This entry is no longer waiting.');
}

/** Puts a skipped occurrence back on the due list. */
export async function restoreOccurrence(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync(
    `UPDATE recurring_occurrences SET status = 'pending', resolved_at = NULL
     WHERE id = ? AND status = 'skipped'`,
    [id]
  );
}

export async function countPendingOccurrences(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ total: number }>(
    "SELECT COUNT(*) AS total FROM recurring_occurrences WHERE status = 'pending'"
  );
  return row?.total ?? 0;
}
