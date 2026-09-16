import type { SQLiteDatabase } from 'expo-sqlite';
import { z } from 'zod';

import { DomainError } from '@/db/client';
import type { Category, EntryKind, Source } from '@/db/types';
import { nowTimestamp } from '@/lib/date';
import { newId } from '@/lib/id';

/**
 * "Catalog" covers the two user-managed classification lists that share a shape:
 * income/expense types (`categories` table) and sources (`sources` table).
 */
export type CatalogTable = 'categories' | 'sources';
export type CatalogItem = Category | Source;

export const CATALOG_LABELS: Record<CatalogTable, { singular: string; plural: string }> = {
  categories: { singular: 'type', plural: 'types' },
  sources: { singular: 'source', plural: 'sources' },
};

const REFERENCE_COLUMN: Record<CatalogTable, string> = {
  categories: 'category_id',
  sources: 'source_id',
};

export const catalogInputSchema = z.object({
  kind: z.enum(['income', 'expense']),
  name: z.string().trim().min(1, 'Name is required').max(40, 'Keep the name under 40 characters'),
  icon: z.string().min(1, 'Choose an icon'),
  color: z.string().regex(/^#[0-9a-f]{6}$/i, 'Choose a color'),
});

export type CatalogInput = z.infer<typeof catalogInputSchema>;

const SELECT_COLUMNS = `n.id, n.kind, n.name, n.icon, n.color,
  n.created_at AS createdAt, n.updated_at AS updatedAt`;

export async function listCatalog(
  db: SQLiteDatabase,
  table: CatalogTable,
  kind?: EntryKind
): Promise<CatalogItem[]> {
  const column = REFERENCE_COLUMN[table];
  return db.getAllAsync<CatalogItem>(
    `SELECT ${SELECT_COLUMNS},
       (SELECT COUNT(*) FROM transactions t WHERE t.${column} = n.id) AS usageCount
     FROM ${table} n
     WHERE ($kind IS NULL OR n.kind = $kind)
     ORDER BY n.name COLLATE NOCASE`,
    { $kind: kind ?? null }
  );
}

export async function getCatalogItem(
  db: SQLiteDatabase,
  table: CatalogTable,
  id: string
): Promise<CatalogItem | null> {
  return db.getFirstAsync<CatalogItem>(`SELECT ${SELECT_COLUMNS} FROM ${table} n WHERE n.id = ?`, [
    id,
  ]);
}

export async function createCatalogItem(
  db: SQLiteDatabase,
  table: CatalogTable,
  input: CatalogInput
): Promise<string> {
  const data = catalogInputSchema.parse(input);
  const id = newId();
  const now = nowTimestamp();
  await db.runAsync(
    `INSERT INTO ${table} (id, kind, name, icon, color, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, data.kind, data.name, data.icon, data.color, now, now]
  );
  return id;
}

/** The kind is fixed after creation because existing transactions depend on it. */
export async function updateCatalogItem(
  db: SQLiteDatabase,
  table: CatalogTable,
  id: string,
  input: Omit<CatalogInput, 'kind'>
): Promise<void> {
  const data = catalogInputSchema.omit({ kind: true }).parse(input);
  await db.runAsync(
    `UPDATE ${table} SET name = ?, icon = ?, color = ?, updated_at = ? WHERE id = ?`,
    [data.name, data.icon, data.color, nowTimestamp(), id]
  );
}

export async function deleteCatalogItem(
  db: SQLiteDatabase,
  table: CatalogTable,
  id: string
): Promise<void> {
  const column = REFERENCE_COLUMN[table];
  const usage = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM transactions WHERE ${column} = ?`,
    [id]
  );
  if (usage && usage.count > 0) {
    const noun = CATALOG_LABELS[table].singular;
    throw new DomainError(
      `This ${noun} is used by ${usage.count} transaction${usage.count === 1 ? '' : 's'}. ` +
        `Reassign or delete those transactions first.`
    );
  }
  await db.runAsync(`DELETE FROM ${table} WHERE id = ?`, [id]);
}
