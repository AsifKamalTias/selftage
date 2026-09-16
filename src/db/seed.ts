import type { SQLiteDatabase } from 'expo-sqlite';

import { defaultSettings } from '@/features/settings/settings';
import { nowTimestamp } from '@/lib/date';
import { newId } from '@/lib/id';

import type { EntryKind } from './types';

type NamedItem = readonly [name: string, icon: string, color: string];

export const DEFAULT_CATEGORIES: Record<EntryKind, readonly NamedItem[]> = {
  expense: [
    ['Food & Dining', 'restaurant', '#F97316'],
    ['Groceries', 'cart', '#22C55E'],
    ['Transport', 'car', '#3B82F6'],
    ['Shopping', 'bag-handle', '#EC4899'],
    ['Bills & Utilities', 'flash', '#EAB308'],
    ['Rent & Housing', 'home', '#8B5CF6'],
    ['Health', 'medkit', '#EF4444'],
    ['Education', 'school', '#0EA5E9'],
    ['Entertainment', 'film', '#A855F7'],
    ['Travel', 'airplane', '#14B8A6'],
    ['Mobile & Internet', 'wifi', '#6366F1'],
    ['Personal Care', 'sparkles', '#F472B6'],
    ['Gifts & Donations', 'gift', '#F43F5E'],
    ['Other Expense', 'ellipsis-horizontal-circle', '#64748B'],
  ],
  income: [
    ['Salary', 'briefcase', '#10B981'],
    ['Business', 'storefront', '#0EA5E9'],
    ['Freelance', 'laptop', '#8B5CF6'],
    ['Investment', 'trending-up', '#22C55E'],
    ['Rental Income', 'key', '#F59E0B'],
    ['Gift', 'gift', '#EC4899'],
    ['Refund', 'return-down-back', '#06B6D4'],
    ['Other Income', 'ellipsis-horizontal-circle', '#64748B'],
  ],
};

export const DEFAULT_SOURCES: Record<EntryKind, readonly NamedItem[]> = {
  expense: [
    ['Supermarket', 'cart', '#22C55E'],
    ['Restaurant & Cafe', 'cafe', '#F97316'],
    ['Online Store', 'globe', '#3B82F6'],
    ['Utility Provider', 'flash', '#EAB308'],
    ['Landlord', 'home', '#8B5CF6'],
    ['Pharmacy & Hospital', 'medical', '#EF4444'],
    ['Transport Service', 'bus', '#0EA5E9'],
    ['Other', 'ellipsis-horizontal-circle', '#64748B'],
  ],
  income: [
    ['Employer', 'business', '#10B981'],
    ['Clients', 'people', '#8B5CF6'],
    ['Own Business', 'storefront', '#0EA5E9'],
    ['Bank', 'library', '#3B82F6'],
    ['Family & Friends', 'heart', '#EC4899'],
    ['Other', 'ellipsis-horizontal-circle', '#64748B'],
  ],
};

export const DEFAULT_ACCOUNT_TYPES: readonly NamedItem[] = [
  ['Cash', 'cash', '#22C55E'],
  ['Bank', 'library', '#3B82F6'],
  ['Mobile Banking', 'phone-portrait', '#EC4899'],
  ['Cheque', 'document-text', '#F59E0B'],
  ['Card', 'card', '#8B5CF6'],
  ['Other', 'wallet', '#64748B'],
];

async function insertNamed(
  tx: SQLiteDatabase,
  table: 'categories' | 'sources',
  kind: EntryKind,
  items: readonly NamedItem[],
  now: string
) {
  for (const [name, icon, color] of items) {
    await tx.runAsync(
      `INSERT INTO ${table} (id, kind, name, icon, color, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [newId(), kind, name, icon, color, now, now]
    );
  }
}

/** Populates a freshly created database. Runs inside the v1 migration transaction. */
export async function seedDefaults(tx: SQLiteDatabase): Promise<void> {
  const now = nowTimestamp();

  for (const kind of ['expense', 'income'] as const) {
    await insertNamed(tx, 'categories', kind, DEFAULT_CATEGORIES[kind], now);
    await insertNamed(tx, 'sources', kind, DEFAULT_SOURCES[kind], now);
  }

  let cashTypeId = '';
  for (const [name, icon, color] of DEFAULT_ACCOUNT_TYPES) {
    const id = newId();
    if (name === 'Cash') cashTypeId = id;
    await tx.runAsync(
      `INSERT INTO account_types (id, name, icon, color, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, name, icon, color, now, now]
    );
  }

  const cashAccountId = newId();
  await tx.runAsync(
    `INSERT INTO accounts (id, account_type_id, name, icon, color, opening_balance, created_at, updated_at)
     VALUES (?, ?, 'Cash', 'cash', '#22C55E', 0, ?, ?)`,
    [cashAccountId, cashTypeId, now, now]
  );

  const settings = { ...defaultSettings(), defaultAccountId: cashAccountId };
  for (const [key, value] of Object.entries(settings)) {
    await tx.runAsync('INSERT INTO settings (key, value) VALUES (?, ?)', [
      key,
      JSON.stringify(value),
    ]);
  }
}
