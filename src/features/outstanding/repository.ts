import type { SQLiteDatabase } from 'expo-sqlite';
import { z } from 'zod';

import { DomainError, runInTransaction } from '@/db/client';
import type { Installment, Obligation, ObligationDirection } from '@/db/types';
import { writeTransaction } from '@/features/transactions/repository';
import { occurrenceAt } from '@/features/recurring/schedule';
import { isISODate, nowTimestamp } from '@/lib/date';
import { newId } from '@/lib/id';

export const obligationInputSchema = z.object({
  contactId: z.string().min(1, 'Choose a contact'),
  direction: z.enum(['receivable', 'payable']),
  title: z
    .string()
    .trim()
    .min(1, 'Add a short title')
    .max(80, 'Keep the title under 80 characters'),
  amount: z.number().int().positive('Enter an amount greater than zero'),
  date: z.string().refine(isISODate, 'Choose a valid date'),
  dueDate: z.string().refine(isISODate, 'Choose a valid due date').nullable(),
  note: z.string().trim().max(500, 'Keep the note under 500 characters').nullable(),
});

export type ObligationInput = z.infer<typeof obligationInputSchema>;

export type InstallmentFrequency = 'weekly' | 'fortnightly' | 'monthly';

export const INSTALLMENT_FREQUENCIES: readonly {
  value: InstallmentFrequency;
  label: string;
}[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'fortnightly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Monthly' },
];

export interface InstallmentPlan {
  count: number;
  frequency: InstallmentFrequency;
  startDate: string;
}

/**
 * Splits an amount into `count` equal installments, giving the remainder to the last
 * one so the parts always add back up to the whole.
 */
export function planInstallments(
  amount: number,
  { count, frequency, startDate }: InstallmentPlan
): { sequence: number; dueDate: string; amount: number }[] {
  const safeCount = Math.max(1, Math.floor(count));
  const base = Math.floor(amount / safeCount);

  return Array.from({ length: safeCount }, (_, index) => ({
    sequence: index + 1,
    // Reuses the recurrence maths, so a plan starting on the 31st clamps to short months.
    dueDate:
      frequency === 'monthly'
        ? occurrenceAt(startDate, 'monthly', 1, index)
        : occurrenceAt(startDate, 'weekly', frequency === 'weekly' ? 1 : 2, index),
    amount: index === safeCount - 1 ? amount - base * (safeCount - 1) : base,
  }));
}

const SETTLED = `
  COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.obligation_id = b.id), 0)`;

const SELECT_COLUMNS = `
  b.id, b.contact_id AS contactId, c.name AS contactName, c.photo_uri AS contactPhotoUri,
  b.direction, b.title, b.amount, b.date, b.due_date AS dueDate, b.note,
  b.created_at AS createdAt, b.updated_at AS updatedAt,
  ${SETTLED} AS settled,
  MAX(0, b.amount - ${SETTLED}) AS remaining,
  (${SETTLED} >= b.amount) AS isSettled,
  (SELECT MAX(t.date) FROM transactions t WHERE t.obligation_id = b.id) AS lastPaymentDate,
  (SELECT COUNT(*) FROM transactions t WHERE t.obligation_id = b.id) AS paymentCount,
  (SELECT COUNT(*) FROM obligation_installments i WHERE i.obligation_id = b.id) AS installmentCount,
  (SELECT COUNT(*) FROM obligation_installments i
     JOIN transactions t ON t.installment_id = i.id
   WHERE i.obligation_id = b.id) AS paidInstallments`;

const FROM_JOINS = `FROM obligations b JOIN contacts c ON c.id = b.contact_id`;

type ObligationRow = Omit<Obligation, 'isSettled'> & { isSettled: number };

const toObligation = (row: ObligationRow): Obligation => ({
  ...row,
  isSettled: row.isSettled === 1,
});

export interface ObligationFilters {
  contactId?: string;
  direction?: ObligationDirection;
  /** 'open' hides anything fully settled. */
  status?: 'open' | 'settled' | 'all';
}

export async function listObligations(
  db: SQLiteDatabase,
  { contactId, direction, status = 'all' }: ObligationFilters = {}
): Promise<Obligation[]> {
  const clauses: string[] = [];
  if (contactId) clauses.push('b.contact_id = $contactId');
  if (direction) clauses.push('b.direction = $direction');
  if (status === 'open') clauses.push(`${SETTLED} < b.amount`);
  if (status === 'settled') clauses.push(`${SETTLED} >= b.amount`);

  const rows = await db.getAllAsync<ObligationRow>(
    `SELECT ${SELECT_COLUMNS} ${FROM_JOINS}
     ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
     ORDER BY isSettled, b.due_date IS NULL, b.due_date, b.date DESC`,
    { $contactId: contactId ?? null, $direction: direction ?? null }
  );
  return rows.map(toObligation);
}

export async function getObligation(db: SQLiteDatabase, id: string): Promise<Obligation | null> {
  const row = await db.getFirstAsync<ObligationRow>(
    `SELECT ${SELECT_COLUMNS} ${FROM_JOINS} WHERE b.id = ?`,
    [id]
  );
  return row ? toObligation(row) : null;
}

export interface OutstandingSummary {
  receivable: number;
  payable: number;
  net: number;
  openCount: number;
  overdueCount: number;
}

export async function getOutstandingSummary(
  db: SQLiteDatabase,
  today: string
): Promise<OutstandingSummary> {
  const row = await db.getFirstAsync<OutstandingSummary>(
    `SELECT
       COALESCE(SUM(CASE WHEN direction = 'receivable' THEN remaining END), 0) AS receivable,
       COALESCE(SUM(CASE WHEN direction = 'payable' THEN remaining END), 0) AS payable,
       COALESCE(SUM(CASE WHEN direction = 'receivable' THEN remaining ELSE -remaining END), 0) AS net,
       COUNT(*) AS openCount,
       COALESCE(SUM(CASE WHEN dueDate IS NOT NULL AND dueDate < ? THEN 1 ELSE 0 END), 0) AS overdueCount
     FROM (
       SELECT b.direction, b.due_date AS dueDate, MAX(0, b.amount - ${SETTLED}) AS remaining
       FROM obligations b
       WHERE ${SETTLED} < b.amount
     )`,
    [today]
  );
  return row ?? { receivable: 0, payable: 0, net: 0, openCount: 0, overdueCount: 0 };
}

export async function listInstallments(
  db: SQLiteDatabase,
  obligationId: string
): Promise<Installment[]> {
  return db.getAllAsync<Installment>(
    `SELECT i.id, i.obligation_id AS obligationId, i.sequence, i.due_date AS dueDate, i.amount,
       i.created_at AS createdAt,
       t.id AS transactionId, t.amount AS paidAmount, t.date AS paidDate
     FROM obligation_installments i
     LEFT JOIN transactions t ON t.installment_id = i.id
     WHERE i.obligation_id = ?
     ORDER BY i.sequence`,
    [obligationId]
  );
}

/** Installments due on a date, with their obligation, for the calendar. */
export async function listInstallmentsDue(
  db: SQLiteDatabase,
  date: string
): Promise<
  (Installment & { title: string; contactName: string; direction: ObligationDirection })[]
> {
  return db.getAllAsync(
    `SELECT i.id, i.obligation_id AS obligationId, i.sequence, i.due_date AS dueDate, i.amount,
       i.created_at AS createdAt,
       t.id AS transactionId, t.amount AS paidAmount, t.date AS paidDate,
       b.title, b.direction, c.name AS contactName
     FROM obligation_installments i
     JOIN obligations b ON b.id = i.obligation_id
     JOIN contacts c ON c.id = b.contact_id
     LEFT JOIN transactions t ON t.installment_id = i.id
     WHERE i.due_date = ?
     ORDER BY b.direction, i.sequence`,
    [date]
  );
}

/** Obligations whose own due date falls on a date and are not settled, for the calendar. */
export async function listObligationsDue(db: SQLiteDatabase, date: string): Promise<Obligation[]> {
  const rows = await db.getAllAsync<ObligationRow>(
    `SELECT ${SELECT_COLUMNS} ${FROM_JOINS}
     WHERE b.due_date = ? AND ${SETTLED} < b.amount
     ORDER BY b.direction, b.amount DESC`,
    [date]
  );
  return rows.map(toObligation);
}

export async function createObligation(
  db: SQLiteDatabase,
  input: ObligationInput,
  plan: InstallmentPlan | null
): Promise<string> {
  const data = obligationInputSchema.parse(input);
  const contact = await db.getFirstAsync<{ id: string }>('SELECT id FROM contacts WHERE id = ?', [
    data.contactId,
  ]);
  if (!contact) throw new DomainError('The selected contact no longer exists.');

  const id = newId();
  const now = nowTimestamp();
  await runInTransaction(db, async (tx) => {
    await tx.runAsync(
      `INSERT INTO obligations
         (id, contact_id, direction, title, amount, date, due_date, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.contactId,
        data.direction,
        data.title,
        data.amount,
        data.date,
        data.dueDate,
        data.note,
        now,
        now,
      ]
    );
    if (plan) await writeInstallments(tx, id, data.amount, plan, now);
  });
  return id;
}

async function writeInstallments(
  tx: SQLiteDatabase,
  obligationId: string,
  amount: number,
  plan: InstallmentPlan,
  now: string
): Promise<void> {
  for (const part of planInstallments(amount, plan)) {
    await tx.runAsync(
      `INSERT INTO obligation_installments
         (id, obligation_id, sequence, due_date, amount, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [newId(), obligationId, part.sequence, part.dueDate, part.amount, now]
    );
  }
}

export async function updateObligation(
  db: SQLiteDatabase,
  id: string,
  input: ObligationInput
): Promise<void> {
  const data = obligationInputSchema.parse(input);
  const existing = await getObligation(db, id);
  if (!existing) throw new DomainError('This record no longer exists.');
  if (data.amount < existing.settled) {
    throw new DomainError('The amount cannot be less than what has already been settled.');
  }
  await db.runAsync(
    `UPDATE obligations SET contact_id = ?, direction = ?, title = ?, amount = ?, date = ?,
       due_date = ?, note = ?, updated_at = ?
     WHERE id = ?`,
    [
      data.contactId,
      data.direction,
      data.title,
      data.amount,
      data.date,
      data.dueDate,
      data.note,
      nowTimestamp(),
      id,
    ]
  );
}

/** Replaces the schedule. Installments already paid are kept as they are. */
export async function setInstallmentPlan(
  db: SQLiteDatabase,
  obligationId: string,
  plan: InstallmentPlan | null
): Promise<void> {
  const obligation = await getObligation(db, obligationId);
  if (!obligation) throw new DomainError('This record no longer exists.');

  await runInTransaction(db, async (tx) => {
    await tx.runAsync(
      `DELETE FROM obligation_installments
       WHERE obligation_id = ?
         AND id NOT IN (SELECT installment_id FROM transactions WHERE installment_id IS NOT NULL)`,
      [obligationId]
    );
    if (!plan) return;
    const paid = await tx.getFirstAsync<{ total: number; count: number }>(
      `SELECT COALESCE(SUM(i.amount), 0) AS total, COUNT(*) AS count
       FROM obligation_installments i WHERE i.obligation_id = ?`,
      [obligationId]
    );
    const remaining = obligation.amount - (paid?.total ?? 0);
    if (remaining <= 0) return;
    const offset = paid?.count ?? 0;
    const parts = planInstallments(remaining, plan);
    const now = nowTimestamp();
    for (const part of parts) {
      await tx.runAsync(
        `INSERT INTO obligation_installments
           (id, obligation_id, sequence, due_date, amount, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [newId(), obligationId, offset + part.sequence, part.dueDate, part.amount, now]
      );
    }
  });
}

export interface SettleInput {
  obligationId: string;
  /** Settles this installment; otherwise the payment is a free amount. */
  installmentId?: string | null;
  amount: number;
  date: string;
  accountId: string;
  categoryId: string;
  sourceId?: string | null;
  note?: string | null;
}

/**
 * Records money actually changing hands. A receivable settles with income, a payable
 * with an expense, so the ledger, history and calendar all pick it up.
 */
export async function settleObligation(
  db: SQLiteDatabase,
  input: SettleInput
): Promise<{ transactionId: string; remaining: number }> {
  const obligation = await getObligation(db, input.obligationId);
  if (!obligation) throw new DomainError('This record no longer exists.');
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new DomainError('Enter an amount greater than zero.');
  }
  if (!isISODate(input.date)) throw new DomainError('Choose a valid date.');
  if (input.amount > obligation.remaining) {
    throw new DomainError('That is more than the amount still outstanding.');
  }
  if (input.installmentId) {
    const taken = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM transactions WHERE installment_id = ?',
      [input.installmentId]
    );
    if (taken) throw new DomainError('That installment is already settled.');
  }

  const transactionId = newId();
  await runInTransaction(db, (tx) =>
    writeTransaction(
      tx,
      transactionId,
      {
        kind: obligation.direction === 'receivable' ? 'income' : 'expense',
        amount: input.amount,
        categoryId: input.categoryId,
        sourceId: input.sourceId ?? null,
        accountId: input.accountId,
        title: obligation.title,
        note: input.note ?? null,
        date: input.date,
        groupId: null,
      },
      [],
      { obligationId: obligation.id, installmentId: input.installmentId ?? undefined }
    )
  );

  return { transactionId, remaining: Math.max(0, obligation.remaining - input.amount) };
}

/** Settlements stay in the ledger; only the record of what was owed is removed. */
export async function deleteObligation(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM obligations WHERE id = ?', [id]);
}
