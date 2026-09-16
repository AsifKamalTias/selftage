import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

export const DATABASE_NAME = 'selftage.db';

/**
 * Runs `task` atomically. Exclusive transactions (which isolate the task from other
 * async queries) are native-only, so web falls back to a regular transaction.
 * Always issue queries through the `tx` argument.
 */
export async function runInTransaction(
  db: SQLiteDatabase,
  task: (tx: SQLiteDatabase) => Promise<void>
): Promise<void> {
  if (Platform.OS === 'web') {
    await db.withTransactionAsync(() => task(db));
  } else {
    await db.withExclusiveTransactionAsync((txn) => task(txn));
  }
}

/** Escapes `%`, `_` and `\` so user input is matched literally by `LIKE ... ESCAPE '\'`. */
export function likePattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
  }
}

/** Converts SQLite constraint failures into readable messages. */
export function toFriendlyError(error: unknown, fallback = 'Something went wrong'): Error {
  if (error instanceof DomainError) return error;
  const message = error instanceof Error ? error.message : String(error);
  if (/UNIQUE constraint failed/i.test(message)) {
    return new DomainError('An item with this name already exists.');
  }
  if (/FOREIGN KEY constraint failed/i.test(message)) {
    return new DomainError('This item is in use and cannot be removed.');
  }
  return new Error(message || fallback);
}
