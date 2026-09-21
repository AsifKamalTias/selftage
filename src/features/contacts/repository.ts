import type { SQLiteDatabase } from 'expo-sqlite';
import { z } from 'zod';

import { assertUniqueName, DomainError, likePattern } from '@/db/client';
import type { Contact } from '@/db/types';
import { nowTimestamp } from '@/lib/date';
import { newId } from '@/lib/id';

export const contactInputSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80, 'Keep the name under 80 characters'),
  photoUri: z.string().min(1).nullable(),
  phone: z.string().trim().max(40, 'Keep the phone under 40 characters').nullable(),
  email: z.string().trim().max(120, 'Keep the email under 120 characters').nullable(),
  address: z.string().trim().max(200, 'Keep the address under 200 characters').nullable(),
  note: z.string().trim().max(500, 'Keep the note under 500 characters').nullable(),
});

export type ContactInput = z.infer<typeof contactInputSchema>;

/**
 * Outstanding totals come from the obligations and the transactions that settle
 * them, so they can never drift from the ledger.
 */
const OUTSTANDING = `
  SELECT o.contact_id AS contactId,
    SUM(CASE WHEN o.direction = 'receivable' THEN MAX(0, o.amount - o.settled) ELSE 0 END) AS receivable,
    SUM(CASE WHEN o.direction = 'payable' THEN MAX(0, o.amount - o.settled) ELSE 0 END) AS payable,
    COUNT(*) AS obligationCount,
    SUM(CASE WHEN o.amount > o.settled THEN 1 ELSE 0 END) AS openCount
  FROM (
    SELECT b.id, b.contact_id, b.direction, b.amount,
      COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.obligation_id = b.id), 0) AS settled
    FROM obligations b
  ) o
  GROUP BY o.contact_id`;

const SELECT_COLUMNS = `
  c.id, c.name, c.photo_uri AS photoUri, c.phone, c.email, c.address, c.note,
  c.created_at AS createdAt, c.updated_at AS updatedAt,
  COALESCE(s.receivable, 0) AS receivable,
  COALESCE(s.payable, 0) AS payable,
  COALESCE(s.receivable, 0) - COALESCE(s.payable, 0) AS net,
  COALESCE(s.obligationCount, 0) AS obligationCount,
  COALESCE(s.openCount, 0) AS openCount`;

const FROM_JOINS = `FROM contacts c LEFT JOIN (${OUTSTANDING}) s ON s.contactId = c.id`;

export async function listContacts(
  db: SQLiteDatabase,
  { search }: { search?: string } = {}
): Promise<Contact[]> {
  const term = search?.trim();
  const where = term ? "WHERE c.name LIKE ? ESCAPE '\\' OR c.phone LIKE ? ESCAPE '\\'" : '';
  const params = term ? [likePattern(term), likePattern(term)] : [];
  return db.getAllAsync<Contact>(
    `SELECT ${SELECT_COLUMNS} ${FROM_JOINS} ${where}
     ORDER BY (COALESCE(s.openCount, 0) = 0), c.name COLLATE NOCASE`,
    params
  );
}

export async function getContact(db: SQLiteDatabase, id: string): Promise<Contact | null> {
  return db.getFirstAsync<Contact>(`SELECT ${SELECT_COLUMNS} ${FROM_JOINS} WHERE c.id = ?`, [id]);
}

export async function createContact(db: SQLiteDatabase, input: ContactInput): Promise<string> {
  const data = contactInputSchema.parse(input);
  await assertUniqueName(db, 'contacts', data.name);
  const id = newId();
  const now = nowTimestamp();
  await db.runAsync(
    `INSERT INTO contacts (id, name, photo_uri, phone, email, address, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.name, data.photoUri, data.phone, data.email, data.address, data.note, now, now]
  );
  return id;
}

export async function updateContact(
  db: SQLiteDatabase,
  id: string,
  input: ContactInput
): Promise<void> {
  const data = contactInputSchema.parse(input);
  await assertUniqueName(db, 'contacts', data.name, { excludeId: id });
  const result = await db.runAsync(
    `UPDATE contacts SET name = ?, photo_uri = ?, phone = ?, email = ?, address = ?, note = ?,
       updated_at = ?
     WHERE id = ?`,
    [data.name, data.photoUri, data.phone, data.email, data.address, data.note, nowTimestamp(), id]
  );
  if (result.changes === 0) throw new DomainError('This contact no longer exists.');
}

/** Removes the contact and its obligations; settled entries stay in the ledger. */
export async function deleteContact(db: SQLiteDatabase, id: string): Promise<string | null> {
  const contact = await db.getFirstAsync<{ photoUri: string | null }>(
    'SELECT photo_uri AS photoUri FROM contacts WHERE id = ?',
    [id]
  );
  await db.runAsync('DELETE FROM contacts WHERE id = ?', [id]);
  return contact?.photoUri ?? null;
}
