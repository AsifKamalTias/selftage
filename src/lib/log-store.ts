import { Directory, File, Paths } from 'expo-file-system';

import type { LogEntry } from './logger';

/** Kept small: this file is read at startup, before anything else can go wrong. */
export const PERSISTED_LOG_LIMIT = 100;

const FILE_NAME = 'app-log.json';

function logFile(): File {
  const dir = new Directory(Paths.document, 'logs');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return new File(dir, FILE_NAME);
}

/**
 * Stored outside SQLite on purpose: a database that will not open is precisely the
 * failure worth reading about afterwards.
 */
export async function readStoredLogs(): Promise<LogEntry[]> {
  const file = logFile();
  if (!file.exists) return [];
  const parsed: unknown = JSON.parse(file.textSync());
  return Array.isArray(parsed) ? (parsed as LogEntry[]) : [];
}

export async function writeStoredLogs(entries: LogEntry[]): Promise<void> {
  const file = logFile();
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify(entries.slice(-PERSISTED_LOG_LIMIT)));
}

export async function clearStoredLogs(): Promise<void> {
  const file = logFile();
  if (file.exists) file.delete();
}
