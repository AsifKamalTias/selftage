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

const SCHEMA_V2 = `
-- Spending limits. A NULL category_id is the overall budget for that period.
CREATE TABLE budgets (
  id TEXT PRIMARY KEY NOT NULL,
  category_id TEXT REFERENCES categories (id) ON DELETE CASCADE,
  period TEXT NOT NULL CHECK (period IN ('daily', 'weekly', 'monthly')),
  amount INTEGER NOT NULL CHECK (amount > 0),
  -- Percentage of the limit at which the "close to limit" warning starts.
  warn_at INTEGER NOT NULL DEFAULT 80 CHECK (warn_at BETWEEN 1 AND 100),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
-- One budget per period per scope; '*' stands in for the overall budget.
CREATE UNIQUE INDEX idx_budgets_scope ON budgets (period, IFNULL(category_id, '*'));
CREATE INDEX idx_budgets_category ON budgets (category_id);
`;

const SCHEMA_V3 = `
-- Templates that post transactions on a schedule. next_date is the next occurrence
-- that has not been posted yet; it advances as entries are created.
CREATE TABLE recurring_rules (
  id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('income', 'expense')),
  name TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  category_id TEXT NOT NULL REFERENCES categories (id) ON DELETE RESTRICT,
  source_id TEXT REFERENCES sources (id) ON DELETE RESTRICT,
  account_id TEXT NOT NULL REFERENCES accounts (id) ON DELETE RESTRICT,
  note TEXT,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
  interval_count INTEGER NOT NULL DEFAULT 1 CHECK (interval_count BETWEEN 1 AND 99),
  start_date TEXT NOT NULL,
  next_date TEXT NOT NULL,
  last_run_date TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_recurring_due ON recurring_rules (is_active, next_date);

-- Posted entries remember their rule; deleting a rule keeps its history.
ALTER TABLE transactions ADD COLUMN recurring_id TEXT REFERENCES recurring_rules (id) ON DELETE SET NULL;
CREATE INDEX idx_transactions_recurring ON transactions (recurring_id);
`;

const SCHEMA_V4 = `
-- Savings goals. Money is reserved from an account (the ledger is untouched) until the
-- goal is completed, at which point the reserve is spent as a real expense.
CREATE TABLE goals (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  target_amount INTEGER NOT NULL CHECK (target_amount > 0),
  target_date TEXT,
  note TEXT,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_goals_name ON goals (name COLLATE NOCASE);
CREATE INDEX idx_goals_status ON goals (status, target_date);

-- Positive amounts reserve money, negative amounts release it back to the account.
CREATE TABLE goal_contributions (
  id TEXT PRIMARY KEY NOT NULL,
  goal_id TEXT NOT NULL REFERENCES goals (id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES accounts (id) ON DELETE RESTRICT,
  amount INTEGER NOT NULL CHECK (amount != 0),
  date TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_goal_contributions_goal ON goal_contributions (goal_id, date);
CREATE INDEX idx_goal_contributions_account ON goal_contributions (account_id);

-- Spends posted when a goal is completed keep a link to it.
ALTER TABLE transactions ADD COLUMN goal_id TEXT REFERENCES goals (id) ON DELETE SET NULL;
CREATE INDEX idx_transactions_goal ON transactions (goal_id);
`;

const SCHEMA_V5 = `
-- Groups tie entries that belong together (a trip, a project, an event) across types,
-- sources and accounts, so they can be reported on as one.
CREATE TABLE groups (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  note TEXT,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  is_archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_groups_name ON groups (name COLLATE NOCASE);

-- Deleting a group keeps its entries; they simply stop belonging to one.
ALTER TABLE transactions ADD COLUMN group_id TEXT REFERENCES groups (id) ON DELETE SET NULL;
CREATE INDEX idx_transactions_group ON transactions (group_id);

ALTER TABLE recurring_rules ADD COLUMN group_id TEXT REFERENCES groups (id) ON DELETE SET NULL;
`;

const SCHEMA_V6 = `
-- Automatic rules post by themselves; manual rules queue an occurrence the user
-- marks paid (or skips) once the money has actually moved.
ALTER TABLE recurring_rules ADD COLUMN mode TEXT NOT NULL DEFAULT 'auto'
  CHECK (mode IN ('auto', 'manual'));

CREATE TABLE recurring_occurrences (
  id TEXT PRIMARY KEY NOT NULL,
  rule_id TEXT NOT NULL REFERENCES recurring_rules (id) ON DELETE CASCADE,
  due_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'skipped')),
  -- Set when marking paid; cleared if that entry is later deleted.
  transaction_id TEXT REFERENCES transactions (id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  resolved_at TEXT
);
-- One row per rule per due date, so a repeated catch-up cannot queue duplicates.
CREATE UNIQUE INDEX idx_recurring_occurrences_due ON recurring_occurrences (rule_id, due_date);
CREATE INDEX idx_recurring_occurrences_pending ON recurring_occurrences (status, due_date);
`;

const SCHEMA_V7 = `
-- People money is owed to or by.
CREATE TABLE contacts (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  photo_uri TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_contacts_name ON contacts (name COLLATE NOCASE);

-- A receivable is owed to the user, a payable is owed by them. What is still
-- outstanding is derived from the settlements, never stored.
CREATE TABLE obligations (
  id TEXT PRIMARY KEY NOT NULL,
  contact_id TEXT NOT NULL REFERENCES contacts (id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('receivable', 'payable')),
  title TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  date TEXT NOT NULL,
  due_date TEXT,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_obligations_contact ON obligations (contact_id);
CREATE INDEX idx_obligations_due ON obligations (due_date);

-- An optional schedule. An installment is paid when a transaction points at it.
CREATE TABLE obligation_installments (
  id TEXT PRIMARY KEY NOT NULL,
  obligation_id TEXT NOT NULL REFERENCES obligations (id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL,
  due_date TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_installments_sequence ON obligation_installments (obligation_id, sequence);
CREATE INDEX idx_installments_due ON obligation_installments (due_date);

-- Settlements are ordinary transactions, so they post to the ledger and show up in
-- history and the calendar like anything else. Deleting one un-settles that much.
ALTER TABLE transactions ADD COLUMN obligation_id TEXT REFERENCES obligations (id) ON DELETE SET NULL;
ALTER TABLE transactions ADD COLUMN installment_id TEXT
  REFERENCES obligation_installments (id) ON DELETE SET NULL;
CREATE INDEX idx_transactions_obligation ON transactions (obligation_id);
CREATE UNIQUE INDEX idx_transactions_installment ON transactions (installment_id)
  WHERE installment_id IS NOT NULL;
`;

const SCHEMA_V8 = `
-- The type a record settles under, so recording a payment does not ask twice.
ALTER TABLE obligations ADD COLUMN category_id TEXT REFERENCES categories (id) ON DELETE SET NULL;
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
  {
    version: 2,
    up: async (tx) => {
      await tx.execAsync(SCHEMA_V2);
    },
  },
  {
    version: 3,
    up: async (tx) => {
      await tx.execAsync(SCHEMA_V3);
    },
  },
  {
    version: 4,
    up: async (tx) => {
      await tx.execAsync(SCHEMA_V4);
    },
  },
  {
    version: 5,
    up: async (tx) => {
      await tx.execAsync(SCHEMA_V5);
    },
  },
  {
    version: 6,
    up: async (tx) => {
      await tx.execAsync(SCHEMA_V6);
    },
  },
  {
    version: 7,
    up: async (tx) => {
      await tx.execAsync(SCHEMA_V7);
    },
  },
  {
    version: 8,
    up: async (tx) => {
      await tx.execAsync(SCHEMA_V8);
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
