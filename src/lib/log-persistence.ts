import { clearStoredLogs, readStoredLogs, writeStoredLogs } from './log-store';
import { logger, recentLogs, restoreLogs, subscribeToLogs, type LogEntry } from './logger';

const log = logger('app');

/** Only what is worth reading later; debug chatter stays in memory. */
const KEEP = new Set(['warn', 'error']);
const FLUSH_DELAY_MS = 1_000;

let started = false;
let timer: ReturnType<typeof setTimeout> | null = null;

function worthKeeping(entries: LogEntry[]): LogEntry[] {
  return entries.filter((entry) => KEEP.has(entry.level));
}

function scheduleFlush() {
  if (timer) return;
  // Batched: a burst of failures should not mean a burst of writes.
  timer = setTimeout(() => {
    timer = null;
    void writeStoredLogs(worthKeeping(recentLogs())).catch(() => {
      // Nothing useful to do — reporting a logging failure through the log would loop.
    });
  }, FLUSH_DELAY_MS);
}

/**
 * Loads what the previous session recorded and keeps the file in step from here on.
 * Failures are swallowed by design: diagnostics must never be the reason a launch fails.
 */
export async function startLogPersistence(): Promise<void> {
  if (started) return;
  started = true;

  try {
    restoreLogs(await readStoredLogs());
  } catch (error) {
    log.warn('Could not read the stored log', error);
  }

  subscribeToLogs((entry) => {
    if (KEEP.has(entry.level)) scheduleFlush();
  });
}

/** Clears both what is in memory and what was written to disk. */
export async function clearPersistedLogs(): Promise<void> {
  try {
    await clearStoredLogs();
  } catch (error) {
    log.warn('Could not clear the stored log', error);
  }
}
