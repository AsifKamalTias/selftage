/**
 * A small structured logger. There is no crash-reporting backend — the app is offline
 * and private — so entries are kept in a bounded in-memory buffer that Settings can show
 * and export. Logging must never be the thing that breaks a screen, so every path here
 * is defensive and side-effect free beyond the buffer and the console.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  id: number;
  at: string;
  level: LogLevel;
  /** Feature or module the entry came from, e.g. "recurring". */
  scope: string;
  message: string;
  /** Small, non-sensitive details: ids, counts, flags. Never record contents. */
  context?: Record<string, unknown>;
  error?: { name: string; message: string; stack?: string };
}

/** Enough to explain a session without letting memory grow unbounded. */
export const LOG_BUFFER_SIZE = 200;

const LEVEL_RANK: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

/** Anything can be thrown in JavaScript; this is what the rest of the app assumes. */
export function toError(value: unknown): Error {
  if (value instanceof Error) return value;
  if (typeof value === 'string') return new Error(value);
  let described: string | undefined;
  try {
    // Returns undefined for undefined, functions and symbols, hence the fallbacks.
    described = JSON.stringify(value) ?? undefined;
  } catch {
    described = undefined;
  }
  return new Error(described || String(value));
}

function describe(error: Error): NonNullable<LogEntry['error']> {
  return {
    name: error.name || 'Error',
    message: error.message,
    stack:
      typeof error.stack === 'string' ? error.stack.split('\n').slice(0, 12).join('\n') : undefined,
  };
}

type Listener = (entry: LogEntry) => void;

const buffer: LogEntry[] = [];
const listeners = new Set<Listener>();
let nextId = 1;
let minLevel: LogLevel = __DEV__ ? 'debug' : 'info';

function emit(
  level: LogLevel,
  scope: string,
  message: string,
  extra?: unknown,
  context?: Record<string, unknown>
) {
  if (LEVEL_RANK[level] < LEVEL_RANK[minLevel]) return;

  const error = extra === undefined ? undefined : describe(toError(extra));
  const entry: LogEntry = {
    id: nextId++,
    at: new Date().toISOString(),
    level,
    scope,
    message,
    context: context && Object.keys(context).length > 0 ? context : undefined,
    error,
  };

  buffer.push(entry);
  if (buffer.length > LOG_BUFFER_SIZE) buffer.splice(0, buffer.length - LOG_BUFFER_SIZE);

  for (const listener of listeners) {
    try {
      listener(entry);
    } catch {
      // A broken listener must not take down whatever was being logged.
    }
  }

  // Errors always reach the console so a device log or dev tools still shows them.
  if (__DEV__ || level === 'error') {
    const line = `[${scope}] ${message}`;
    const rest = [context, error?.stack ?? error?.message].filter(Boolean);
    if (level === 'error') console.error(line, ...rest);
    else if (level === 'warn') console.warn(line, ...rest);
    else console.log(line, ...rest);
  }
}

export interface ScopedLogger {
  debug: (message: string, context?: Record<string, unknown>) => void;
  info: (message: string, context?: Record<string, unknown>) => void;
  warn: (message: string, error?: unknown, context?: Record<string, unknown>) => void;
  error: (message: string, error?: unknown, context?: Record<string, unknown>) => void;
}

/** `const log = logger('recurring')` — every entry from that module is tagged with it. */
export function logger(scope: string): ScopedLogger {
  return {
    debug: (message, context) => emit('debug', scope, message, undefined, context),
    info: (message, context) => emit('info', scope, message, undefined, context),
    warn: (message, error, context) => emit('warn', scope, message, error, context),
    error: (message, error, context) => emit('error', scope, message, error, context),
  };
}

export function recentLogs(): LogEntry[] {
  return [...buffer];
}

/**
 * Puts entries kept from an earlier session in front of this one's, so a crash can be
 * read about after the restart it caused.
 */
export function restoreLogs(entries: LogEntry[]): void {
  if (entries.length === 0) return;
  buffer.unshift(...entries);
  if (buffer.length > LOG_BUFFER_SIZE) buffer.splice(0, buffer.length - LOG_BUFFER_SIZE);
  nextId = Math.max(nextId, ...entries.map((entry) => entry.id + 1));
}

export function clearLogs(): void {
  buffer.length = 0;
}

export function subscribeToLogs(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Tests and the diagnostics screen use this; production keeps the defaults. */
export function setMinLogLevel(level: LogLevel): void {
  minLevel = level;
}

/** One line per entry, oldest first — what "copy" and "export" hand over. */
export function formatLogs(entries: LogEntry[] = recentLogs()): string {
  return entries
    .map((entry) => {
      const parts = [`${entry.at} ${entry.level.toUpperCase()} [${entry.scope}] ${entry.message}`];
      if (entry.context) parts.push(`  context: ${safeJson(entry.context)}`);
      if (entry.error) {
        parts.push(`  ${entry.error.name}: ${entry.error.message}`);
        if (entry.error.stack) parts.push(entry.error.stack.replace(/^/gm, '  '));
      }
      return parts.join('\n');
    })
    .join('\n');
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
