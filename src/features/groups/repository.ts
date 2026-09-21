import type { SQLiteDatabase } from 'expo-sqlite';
import { z } from 'zod';

import { assertUniqueName, DomainError } from '@/db/client';
import type { Group, GroupTotals } from '@/db/types';
import { nowTimestamp } from '@/lib/date';
import { newId } from '@/lib/id';

export const groupInputSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(60, 'Keep the name under 60 characters'),
  note: z.string().trim().max(500, 'Keep the note under 500 characters').nullable(),
  icon: z.string().min(1, 'Choose an icon'),
  color: z.string().regex(/^#[0-9a-f]{6}$/i, 'Choose a color'),
});

export type GroupInput = z.infer<typeof groupInputSchema>;

/** Totals are all-time so a group reads the same wherever it is shown. */
const SELECT_COLUMNS = `
  g.id, g.name, g.note, g.icon, g.color, g.is_archived AS isArchived,
  g.created_at AS createdAt, g.updated_at AS updatedAt,
  COALESCE(SUM(CASE WHEN t.kind = 'income' THEN t.amount END), 0) AS income,
  COALESCE(SUM(CASE WHEN t.kind = 'expense' THEN t.amount END), 0) AS expense,
  COALESCE(SUM(CASE WHEN t.kind = 'income' THEN t.amount ELSE -t.amount END), 0) AS net,
  COUNT(t.id) AS transactionCount,
  MIN(t.date) AS firstDate,
  MAX(t.date) AS lastDate`;

type GroupRow = Omit<Group, 'isArchived'> & { isArchived: number };

const toGroup = (row: GroupRow): Group => ({ ...row, isArchived: row.isArchived === 1 });

export async function listGroups(
  db: SQLiteDatabase,
  { includeArchived = true }: { includeArchived?: boolean } = {}
): Promise<Group[]> {
  const rows = await db.getAllAsync<GroupRow>(
    `SELECT ${SELECT_COLUMNS}
     FROM groups g
     LEFT JOIN transactions t ON t.group_id = g.id
     ${includeArchived ? '' : 'WHERE g.is_archived = 0'}
     GROUP BY g.id
     ORDER BY g.is_archived, g.name COLLATE NOCASE`
  );
  return rows.map(toGroup);
}

export async function getGroup(db: SQLiteDatabase, id: string): Promise<Group | null> {
  const row = await db.getFirstAsync<GroupRow>(
    `SELECT ${SELECT_COLUMNS}
     FROM groups g
     LEFT JOIN transactions t ON t.group_id = g.id
     WHERE g.id = ?
     GROUP BY g.id`,
    [id]
  );
  return row ? toGroup(row) : null;
}

/**
 * Group-wise totals for a period. Groups with no activity in the range are left out,
 * and entries without a group are reported together under a null id.
 */
export async function groupTotals(
  db: SQLiteDatabase,
  { from, to }: { from?: string; to?: string } = {}
): Promise<GroupTotals[]> {
  return db.getAllAsync<GroupTotals>(
    `SELECT
       COALESCE(g.id, '') AS id,
       COALESCE(g.name, 'Ungrouped') AS name,
       COALESCE(g.icon, 'ellipsis-horizontal') AS icon,
       COALESCE(g.color, '#94A3B8') AS color,
       COALESCE(SUM(CASE WHEN t.kind = 'income' THEN t.amount END), 0) AS income,
       COALESCE(SUM(CASE WHEN t.kind = 'expense' THEN t.amount END), 0) AS expense,
       COALESCE(SUM(CASE WHEN t.kind = 'income' THEN t.amount ELSE -t.amount END), 0) AS net,
       COUNT(t.id) AS count
     FROM transactions t
     LEFT JOIN groups g ON g.id = t.group_id
     WHERE ($from IS NULL OR t.date >= $from) AND ($to IS NULL OR t.date <= $to)
     GROUP BY g.id
     HAVING count > 0
     ORDER BY expense DESC, income DESC`,
    { $from: from ?? null, $to: to ?? null }
  );
}

export async function createGroup(db: SQLiteDatabase, input: GroupInput): Promise<string> {
  const data = groupInputSchema.parse(input);
  await assertUniqueName(db, 'groups', data.name);
  const id = newId();
  const now = nowTimestamp();
  await db.runAsync(
    `INSERT INTO groups (id, name, note, icon, color, is_archived, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
    [id, data.name, data.note, data.icon, data.color, now, now]
  );
  return id;
}

export async function updateGroup(
  db: SQLiteDatabase,
  id: string,
  input: GroupInput
): Promise<void> {
  const data = groupInputSchema.parse(input);
  await assertUniqueName(db, 'groups', data.name, { excludeId: id });
  const result = await db.runAsync(
    `UPDATE groups SET name = ?, note = ?, icon = ?, color = ?, updated_at = ? WHERE id = ?`,
    [data.name, data.note, data.icon, data.color, nowTimestamp(), id]
  );
  if (result.changes === 0) throw new DomainError('This group no longer exists.');
}

/** Archiving hides a finished group from pickers without touching its entries. */
export async function setGroupArchived(
  db: SQLiteDatabase,
  id: string,
  isArchived: boolean
): Promise<void> {
  await db.runAsync('UPDATE groups SET is_archived = ?, updated_at = ? WHERE id = ?', [
    isArchived ? 1 : 0,
    nowTimestamp(),
    id,
  ]);
}

/** Entries stay; their link is cleared by ON DELETE SET NULL. */
export async function deleteGroup(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM groups WHERE id = ?', [id]);
}
