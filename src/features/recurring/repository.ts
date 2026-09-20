import type { SQLiteDatabase } from 'expo-sqlite';
import { z } from 'zod';

import { DomainError } from '@/db/client';
import type { RecurringRule } from '@/db/types';
import { isISODate, nowTimestamp, todayISO } from '@/lib/date';
import { newId } from '@/lib/id';

import { firstOccurrenceOnOrAfter, MAX_INTERVAL, nextOccurrenceAfter } from './schedule';

export const recurringInputSchema = z.object({
  kind: z.enum(['income', 'expense']),
  name: z.string().trim().min(1, 'Name is required').max(60, 'Keep the name under 60 characters'),
  amount: z.number().int().positive('Enter an amount greater than zero'),
  categoryId: z.string().min(1, 'Choose a type'),
  sourceId: z.string().min(1).nullable(),
  /** Account the money is taken from (expense) or added to (income). */
  accountId: z.string().min(1, 'Choose an account'),
  note: z.string().trim().max(500, 'Keep the note under 500 characters').nullable(),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  intervalCount: z.number().int().min(1, 'Repeat at least every 1').max(MAX_INTERVAL),
  startDate: z.string().refine(isISODate, 'Choose a valid start date'),
});

export type RecurringInput = z.infer<typeof recurringInputSchema>;

const SELECT_COLUMNS = `
  r.id, r.kind, r.name, r.amount, r.note,
  r.category_id AS categoryId, c.name AS categoryName, c.icon AS categoryIcon,
  c.color AS categoryColor,
  r.source_id AS sourceId, s.name AS sourceName,
  r.account_id AS accountId, a.name AS accountName,
  r.frequency, r.interval_count AS intervalCount, r.start_date AS startDate,
  r.next_date AS nextDate, r.last_run_date AS lastRunDate, r.is_active AS isActive,
  r.created_at AS createdAt, r.updated_at AS updatedAt`;

const FROM_JOINS = `
  FROM recurring_rules r
  JOIN categories c ON c.id = r.category_id
  LEFT JOIN sources s ON s.id = r.source_id
  JOIN accounts a ON a.id = r.account_id`;

type RecurringRow = Omit<RecurringRule, 'isActive'> & { isActive: number };

const toRule = (row: RecurringRow): RecurringRule => ({ ...row, isActive: row.isActive === 1 });

export async function listRecurringRules(
  db: SQLiteDatabase,
  { includeInactive = true }: { includeInactive?: boolean } = {}
): Promise<RecurringRule[]> {
  const rows = await db.getAllAsync<RecurringRow>(
    `SELECT ${SELECT_COLUMNS},
       (SELECT COUNT(*) FROM transactions t WHERE t.recurring_id = r.id) AS postedCount
     ${FROM_JOINS}
     ${includeInactive ? '' : 'WHERE r.is_active = 1'}
     ORDER BY r.is_active DESC, r.next_date, r.name COLLATE NOCASE`
  );
  return rows.map(toRule);
}

export async function getRecurringRule(
  db: SQLiteDatabase,
  id: string
): Promise<RecurringRule | null> {
  const row = await db.getFirstAsync<RecurringRow>(
    `SELECT ${SELECT_COLUMNS},
       (SELECT COUNT(*) FROM transactions t WHERE t.recurring_id = r.id) AS postedCount
     ${FROM_JOINS} WHERE r.id = ?`,
    [id]
  );
  return row ? toRule(row) : null;
}

/** Active rules with an occurrence due on or before `today`. */
export async function listDueRules(db: SQLiteDatabase, today: string): Promise<RecurringRule[]> {
  const rows = await db.getAllAsync<RecurringRow>(
    `SELECT ${SELECT_COLUMNS} ${FROM_JOINS}
     WHERE r.is_active = 1 AND r.next_date <= ?
     ORDER BY r.next_date, r.created_at`,
    [today]
  );
  return rows.map(toRule);
}

/** Rejects references that do not exist or belong to the other kind. */
async function assertReferences(db: SQLiteDatabase, input: RecurringInput): Promise<void> {
  const category = await db.getFirstAsync<{ kind: string }>(
    'SELECT kind FROM categories WHERE id = ?',
    [input.categoryId]
  );
  if (!category) throw new DomainError('The selected type no longer exists.');
  if (category.kind !== input.kind) throw new DomainError(`Choose an ${input.kind} type.`);

  if (input.sourceId) {
    const source = await db.getFirstAsync<{ kind: string }>(
      'SELECT kind FROM sources WHERE id = ?',
      [input.sourceId]
    );
    if (!source) throw new DomainError('The selected source no longer exists.');
    if (source.kind !== input.kind) throw new DomainError(`Choose an ${input.kind} source.`);
  }

  const account = await db.getFirstAsync<{ isArchived: number }>(
    'SELECT is_archived AS isArchived FROM accounts WHERE id = ?',
    [input.accountId]
  );
  if (!account) throw new DomainError('The selected account no longer exists.');
  if (account.isArchived) throw new DomainError('The selected account is archived.');
}

export async function createRecurringRule(
  db: SQLiteDatabase,
  input: RecurringInput
): Promise<string> {
  const data = recurringInputSchema.parse(input);
  await assertReferences(db, data);
  const id = newId();
  const now = nowTimestamp();
  await db.runAsync(
    `INSERT INTO recurring_rules
       (id, kind, name, amount, category_id, source_id, account_id, note, frequency,
        interval_count, start_date, next_date, last_run_date, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1, ?, ?)`,
    [
      id,
      data.kind,
      data.name,
      data.amount,
      data.categoryId,
      data.sourceId,
      data.accountId,
      data.note,
      data.frequency,
      data.intervalCount,
      data.startDate,
      data.startDate,
      now,
      now,
    ]
  );
  return id;
}

/**
 * Edits apply to future occurrences: entries already posted stay as they are, and the next
 * run is recomputed from the new schedule after the last posted date.
 */
export async function updateRecurringRule(
  db: SQLiteDatabase,
  id: string,
  input: RecurringInput
): Promise<void> {
  const data = recurringInputSchema.parse(input);
  await assertReferences(db, data);
  const existing = await getRecurringRule(db, id);
  if (!existing) throw new DomainError('This recurring entry no longer exists.');

  const nextDate = existing.lastRunDate
    ? nextOccurrenceAfter(
        { ...data, startDate: data.startDate },
        existing.lastRunDate < data.startDate ? data.startDate : existing.lastRunDate
      )
    : firstOccurrenceOnOrAfter(data.startDate, data.frequency, data.intervalCount, data.startDate);

  await db.runAsync(
    `UPDATE recurring_rules
       SET kind = ?, name = ?, amount = ?, category_id = ?, source_id = ?, account_id = ?,
           note = ?, frequency = ?, interval_count = ?, start_date = ?, next_date = ?,
           updated_at = ?
     WHERE id = ?`,
    [
      data.kind,
      data.name,
      data.amount,
      data.categoryId,
      data.sourceId,
      data.accountId,
      data.note,
      data.frequency,
      data.intervalCount,
      data.startDate,
      nextDate,
      nowTimestamp(),
      id,
    ]
  );
}

/**
 * Pausing stops future postings; resuming skips whatever fell due while paused and
 * continues from the next occurrence on or after today.
 */
export async function setRecurringActive(
  db: SQLiteDatabase,
  id: string,
  isActive: boolean,
  today = todayISO()
): Promise<void> {
  const rule = await getRecurringRule(db, id);
  if (!rule) throw new DomainError('This recurring entry no longer exists.');
  const nextDate = isActive
    ? firstOccurrenceOnOrAfter(
        rule.startDate,
        rule.frequency,
        rule.intervalCount,
        rule.nextDate > today ? rule.nextDate : today
      )
    : rule.nextDate;

  await db.runAsync(
    'UPDATE recurring_rules SET is_active = ?, next_date = ?, updated_at = ? WHERE id = ?',
    [isActive ? 1 : 0, nextDate, nowTimestamp(), id]
  );
}

/** Posted transactions keep their history; their link is cleared by ON DELETE SET NULL. */
export async function deleteRecurringRule(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM recurring_rules WHERE id = ?', [id]);
}

/** Moves the schedule forward after occurrences have been posted. */
export async function markRecurringRun(
  db: SQLiteDatabase,
  id: string,
  lastRunDate: string,
  nextDate: string
): Promise<void> {
  await db.runAsync(
    'UPDATE recurring_rules SET last_run_date = ?, next_date = ?, updated_at = ? WHERE id = ?',
    [lastRunDate, nextDate, nowTimestamp(), id]
  );
}
