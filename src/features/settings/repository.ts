import type { SQLiteDatabase } from 'expo-sqlite';

import { runInTransaction } from '@/db/client';
import { seedDefaults } from '@/db/seed';

import { DEFAULT_WEEK_START, WEEK_STARTS, type WeekStart } from '@/lib/date';

import { sanitizeSettings, type AppSettings, type SettingKey } from './settings';

/** Single-value read for code outside React (services that need the week start). */
export async function getWeekStart(db: SQLiteDatabase): Promise<WeekStart> {
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM settings WHERE key = 'weekStartsOn'"
  );
  if (!row) return DEFAULT_WEEK_START;
  try {
    const parsed = JSON.parse(row.value);
    return WEEK_STARTS.includes(parsed as WeekStart) ? (parsed as WeekStart) : DEFAULT_WEEK_START;
  } catch {
    return DEFAULT_WEEK_START;
  }
}

export async function loadSettings(db: SQLiteDatabase): Promise<AppSettings> {
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    'SELECT key, value FROM settings'
  );
  const raw: Partial<Record<SettingKey, unknown>> = {};
  for (const row of rows) {
    try {
      raw[row.key as SettingKey] = JSON.parse(row.value);
    } catch {
      // Ignore malformed values; sanitizeSettings falls back to defaults.
    }
  }
  const settings = sanitizeSettings(raw);

  // Keep the default account pointing at an active account.
  const account = settings.defaultAccountId
    ? await db.getFirstAsync<{ id: string }>(
        'SELECT id FROM accounts WHERE id = ? AND is_archived = 0',
        [settings.defaultAccountId]
      )
    : null;
  if (!account) {
    const fallback = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM accounts WHERE is_archived = 0 ORDER BY created_at LIMIT 1'
    );
    settings.defaultAccountId = fallback?.id ?? null;
  }
  return settings;
}

export async function saveSettings(db: SQLiteDatabase, patch: Partial<AppSettings>): Promise<void> {
  await runInTransaction(db, async (tx) => {
    for (const [key, value] of Object.entries(patch)) {
      await tx.runAsync(
        `INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
        [key, JSON.stringify(value ?? null)]
      );
    }
  });
}

/** Removes every user record and restores the initial seed data. */
export async function resetAllData(db: SQLiteDatabase): Promise<void> {
  await runInTransaction(db, async (tx) => {
    await tx.execAsync(`
      DELETE FROM attachments;
      DELETE FROM ledger_entries;
      DELETE FROM transactions;
      DELETE FROM accounts;
      DELETE FROM account_types;
      DELETE FROM sources;
      DELETE FROM categories;
      DELETE FROM settings;
    `);
    await seedDefaults(tx);
  });
}
