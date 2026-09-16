import type { SQLiteDatabase } from 'expo-sqlite';
import { z } from 'zod';

import { DomainError, runInTransaction } from '@/db/client';
import type { AccountType, AccountWithBalance } from '@/db/types';
import { nowTimestamp, toISODate } from '@/lib/date';
import { newId } from '@/lib/id';

/* ------------------------------ Account types ----------------------------- */

export const accountTypeInputSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(40, 'Keep the name under 40 characters'),
  icon: z.string().min(1, 'Choose an icon'),
  color: z.string().regex(/^#[0-9a-f]{6}$/i, 'Choose a color'),
});

export type AccountTypeInput = z.infer<typeof accountTypeInputSchema>;

export async function listAccountTypes(db: SQLiteDatabase): Promise<AccountType[]> {
  return db.getAllAsync<AccountType>(
    `SELECT t.id, t.name, t.icon, t.color, t.created_at AS createdAt, t.updated_at AS updatedAt,
       (SELECT COUNT(*) FROM accounts a WHERE a.account_type_id = t.id) AS accountCount
     FROM account_types t
     ORDER BY t.created_at, t.name COLLATE NOCASE`
  );
}

export async function getAccountType(db: SQLiteDatabase, id: string): Promise<AccountType | null> {
  return db.getFirstAsync<AccountType>(
    `SELECT id, name, icon, color, created_at AS createdAt, updated_at AS updatedAt
     FROM account_types WHERE id = ?`,
    [id]
  );
}

export async function createAccountType(
  db: SQLiteDatabase,
  input: AccountTypeInput
): Promise<string> {
  const data = accountTypeInputSchema.parse(input);
  const id = newId();
  const now = nowTimestamp();
  await db.runAsync(
    `INSERT INTO account_types (id, name, icon, color, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, data.name, data.icon, data.color, now, now]
  );
  return id;
}

export async function updateAccountType(
  db: SQLiteDatabase,
  id: string,
  input: AccountTypeInput
): Promise<void> {
  const data = accountTypeInputSchema.parse(input);
  await db.runAsync(
    'UPDATE account_types SET name = ?, icon = ?, color = ?, updated_at = ? WHERE id = ?',
    [data.name, data.icon, data.color, nowTimestamp(), id]
  );
}

export async function deleteAccountType(db: SQLiteDatabase, id: string): Promise<void> {
  const usage = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM accounts WHERE account_type_id = ?',
    [id]
  );
  if (usage && usage.count > 0) {
    throw new DomainError(
      `${usage.count} account${usage.count === 1 ? ' uses' : 's use'} this type. ` +
        'Change or delete those accounts first.'
    );
  }
  await db.runAsync('DELETE FROM account_types WHERE id = ?', [id]);
}

/* -------------------------------- Accounts -------------------------------- */

export const accountInputSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(40, 'Keep the name under 40 characters'),
  accountTypeId: z.string().min(1, 'Choose an account type'),
  accountNumber: z.string().trim().max(40).nullable(),
  note: z.string().trim().max(200).nullable(),
  icon: z.string().min(1, 'Choose an icon'),
  color: z.string().regex(/^#[0-9a-f]{6}$/i, 'Choose a color'),
  /** May be negative, e.g. a card that already carries debt. */
  openingBalance: z.number().int().refine(Number.isSafeInteger, 'Amount is too large'),
});

export type AccountInput = z.infer<typeof accountInputSchema>;

type AccountRow = Omit<AccountWithBalance, 'isArchived'> & { isArchived: number };

const ACCOUNT_SELECT = `
  SELECT a.id, a.account_type_id AS accountTypeId, t.name AS accountTypeName, a.name,
    a.account_number AS accountNumber, a.note, a.icon, a.color,
    a.opening_balance AS openingBalance, a.is_archived AS isArchived,
    a.created_at AS createdAt, a.updated_at AS updatedAt,
    COALESCE((SELECT SUM(l.debit - l.credit) FROM ledger_entries l WHERE l.account_id = a.id), 0) AS balance,
    COALESCE((SELECT SUM(x.amount) FROM transactions x WHERE x.account_id = a.id AND x.kind = 'income'), 0) AS totalIncome,
    COALESCE((SELECT SUM(x.amount) FROM transactions x WHERE x.account_id = a.id AND x.kind = 'expense'), 0) AS totalExpense,
    (SELECT COUNT(*) FROM transactions x WHERE x.account_id = a.id) AS transactionCount
  FROM accounts a
  JOIN account_types t ON t.id = a.account_type_id`;

const toAccount = (row: AccountRow): AccountWithBalance => ({
  ...row,
  isArchived: row.isArchived === 1,
});

export async function listAccounts(
  db: SQLiteDatabase,
  { includeArchived = true }: { includeArchived?: boolean } = {}
): Promise<AccountWithBalance[]> {
  const rows = await db.getAllAsync<AccountRow>(
    `${ACCOUNT_SELECT}
     ${includeArchived ? '' : 'WHERE a.is_archived = 0'}
     ORDER BY a.is_archived, a.created_at`
  );
  return rows.map(toAccount);
}

export async function getAccount(
  db: SQLiteDatabase,
  id: string
): Promise<AccountWithBalance | null> {
  const row = await db.getFirstAsync<AccountRow>(`${ACCOUNT_SELECT} WHERE a.id = ?`, [id]);
  return row ? toAccount(row) : null;
}

async function writeOpeningEntry(
  tx: SQLiteDatabase,
  accountId: string,
  openingBalance: number,
  createdAt: string
) {
  await tx.runAsync("DELETE FROM ledger_entries WHERE account_id = ? AND entry_type = 'opening'", [
    accountId,
  ]);
  if (openingBalance === 0) return;
  await tx.runAsync(
    `INSERT INTO ledger_entries
       (id, account_id, transaction_id, entry_type, date, description, debit, credit, created_at)
     VALUES (?, ?, NULL, 'opening', ?, 'Opening balance', ?, ?, ?)`,
    [
      newId(),
      accountId,
      toISODate(new Date(createdAt)),
      Math.max(openingBalance, 0),
      Math.max(-openingBalance, 0),
      createdAt,
    ]
  );
}

export async function createAccount(db: SQLiteDatabase, input: AccountInput): Promise<string> {
  const data = accountInputSchema.parse(input);
  const id = newId();
  const now = nowTimestamp();
  await runInTransaction(db, async (tx) => {
    await tx.runAsync(
      `INSERT INTO accounts
         (id, account_type_id, name, account_number, note, icon, color, opening_balance, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.accountTypeId,
        data.name,
        data.accountNumber || null,
        data.note || null,
        data.icon,
        data.color,
        data.openingBalance,
        now,
        now,
      ]
    );
    await writeOpeningEntry(tx, id, data.openingBalance, now);
  });
  return id;
}

export async function updateAccount(
  db: SQLiteDatabase,
  id: string,
  input: AccountInput
): Promise<void> {
  const data = accountInputSchema.parse(input);
  await runInTransaction(db, async (tx) => {
    const existing = await tx.getFirstAsync<{ createdAt: string }>(
      'SELECT created_at AS createdAt FROM accounts WHERE id = ?',
      [id]
    );
    if (!existing) throw new DomainError('Account not found.');
    await tx.runAsync(
      `UPDATE accounts SET account_type_id = ?, name = ?, account_number = ?, note = ?, icon = ?,
         color = ?, opening_balance = ?, updated_at = ?
       WHERE id = ?`,
      [
        data.accountTypeId,
        data.name,
        data.accountNumber || null,
        data.note || null,
        data.icon,
        data.color,
        data.openingBalance,
        nowTimestamp(),
        id,
      ]
    );
    await writeOpeningEntry(tx, id, data.openingBalance, existing.createdAt);
  });
}

export async function setAccountArchived(
  db: SQLiteDatabase,
  id: string,
  archived: boolean
): Promise<void> {
  if (archived) {
    const active = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM accounts WHERE is_archived = 0 AND id != ?',
      [id]
    );
    if (!active?.count) throw new DomainError('You need at least one active account.');
  }
  await db.runAsync('UPDATE accounts SET is_archived = ?, updated_at = ? WHERE id = ?', [
    archived ? 1 : 0,
    nowTimestamp(),
    id,
  ]);
}

export async function deleteAccount(db: SQLiteDatabase, id: string): Promise<void> {
  const usage = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM transactions WHERE account_id = ?',
    [id]
  );
  if (usage && usage.count > 0) {
    throw new DomainError(
      `This account has ${usage.count} transaction${usage.count === 1 ? '' : 's'}. ` +
        'Archive it instead to keep your history.'
    );
  }
  const others = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM accounts WHERE is_archived = 0 AND id != ?',
    [id]
  );
  if (!others?.count) throw new DomainError('You need at least one active account.');
  // The opening ledger entry is removed by ON DELETE CASCADE.
  await db.runAsync('DELETE FROM accounts WHERE id = ?', [id]);
}
