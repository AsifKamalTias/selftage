import type { LogEntry } from './logger';

/** Kept small: this is read at startup, before anything else can go wrong. */
export const PERSISTED_LOG_LIMIT = 100;

const KEY = 'selftage.log';

/** localStorage, not the OPFS database — a database that will not open is the story. */
export async function readStoredLogs(): Promise<LogEntry[]> {
  if (typeof localStorage === 'undefined') return [];
  const raw = localStorage.getItem(KEY);
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  return Array.isArray(parsed) ? (parsed as LogEntry[]) : [];
}

export async function writeStoredLogs(entries: LogEntry[]): Promise<void> {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(entries.slice(-PERSISTED_LOG_LIMIT)));
}

export async function clearStoredLogs(): Promise<void> {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(KEY);
}
