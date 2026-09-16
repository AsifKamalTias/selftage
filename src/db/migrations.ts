import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

import { runInTransaction } from './client';
import { seedDefaults } from './seed';

interface Migration {
  version: number;
  up: (tx: SQLiteDatabase) => Promise<void>;
}

const SCHEMA_V1 = `
CREATE TABLE settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

CREATE TABLE categories (
  id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('income', 'expense')),
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_categories_kind_name ON categories (kind, name COLLATE NOCASE);

CREATE TABLE sources (
  id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('income', 'expense')),
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_sources_kind_name ON sources (kind, name COLLATE NOCASE);

CREATE TABLE account_types (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_account_types_name ON account_types (name COLLATE NOCASE);

CREATE TABLE accounts (
  id TEXT PRIMARY KEY NOT NULL,
  account_type_id TEXT NOT NULL REFERENCES account_types (id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  account_number TEXT,
  note TEXT,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  opening_balance INTEGER NOT NULL DEFAULT 0,
  is_archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_accounts_name ON accounts (name COLLATE NOCASE);
CREATE INDEX idx_accounts_type ON accounts (account_type_id);

CREATE TABLE transactions (
  id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('income', 'expense')),
  amount INTEGER NOT NULL CHECK (amount > 0),
  category_id TEXT NOT NULL REFERENCES categories (id) ON DELETE RESTRICT,
  source_id TEXT REFERENCES sources (id) ON DELETE RESTRICT,
  account_id TEXT NOT NULL REFERENCES accounts (id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  note TEXT,
  date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_transactions_date ON transactions (date, created_at);
CREATE INDEX idx_transactions_kind_date ON transactions (kind, date);
CREATE INDEX idx_transactions_account_date ON transactions (account_id, date);
CREATE INDEX idx_transactions_category ON transactions (category_id);
CREATE INDEX idx_transactions_source ON transactions (source_id);

CREATE TABLE attachments (
  id TEXT PRIMARY KEY NOT NULL,
  transaction_id TEXT NOT NULL REFERENCES transactions (id) ON DELETE CASCADE,
  uri TEXT NOT NULL,
  name TEXT NOT NULL,
  mime_type TEXT,
  size INTEGER,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_attachments_transaction ON attachments (transaction_id);

-- Every transaction posts exactly one entry to its account's ledger (debit = money in,
-- credit = money out). Accounts with an opening balance get an 'opening' entry.
CREATE TABLE ledger_entries (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  transaction_id TEXT UNIQUE REFERENCES transactions (id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('opening', 'income', 'expense')),
  date TEXT NOT NULL,
  description TEXT NOT NULL,
  debit INTEGER NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit INTEGER NOT NULL DEFAULT 0 CHECK (credit >= 0),
  created_at TEXT NOT NULL
);
CREATE INDEX idx_ledger_account_date ON ledger_entries (account_id, date, created_at);
CREATE INDEX idx_ledger_date ON ledger_entries (date, created_at);
`;

/**
 * Append-only list. Never edit a shipped migration; add a new version instead.
 * Each migration runs in its own transaction together with the version bump.
 */
const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    up: async (tx) => {
      await tx.execAsync(SCHEMA_V1);
      await seedDefaults(tx);
    },
  },
];

export const LATEST_SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

/** `SQLiteProvider` `onInit` handler: configures the connection and applies pending migrations. */
export async function migrateDatabase(db: SQLiteDatabase): Promise<void> {
  if (Platform.OS !== 'web') {
    await db.execAsync('PRAGMA journal_mode = WAL;');
  }
  // Must be set per connection and outside a transaction.
  await db.execAsync('PRAGMA foreign_keys = ON;');

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = row?.user_version ?? 0;

  for (const migration of MIGRATIONS) {
    if (migration.version <= currentVersion) continue;
    await runInTransaction(db, async (tx) => {
      await migration.up(tx);
      await tx.execAsync(`PRAGMA user_version = ${migration.version}`);
    });
  }
}
