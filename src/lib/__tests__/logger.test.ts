import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import {
  clearLogs,
  formatLogs,
  LOG_BUFFER_SIZE,
  logger,
  recentLogs,
  setMinLogLevel,
  subscribeToLogs,
  toError,
} from '../logger';

const log = logger('test');

beforeEach(() => {
  clearLogs();
  setMinLogLevel('debug');
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

describe('toError', () => {
  it('passes an Error through untouched', () => {
    const error = new Error('boom');
    expect(toError(error)).toBe(error);
  });

  it('wraps a string', () => {
    expect(toError('boom').message).toBe('boom');
  });

  it('wraps anything else without throwing', () => {
    expect(toError({ code: 42 }).message).toBe('{"code":42}');
    expect(toError(undefined).message).toBe('undefined');
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => toError(circular)).not.toThrow();
  });
});

describe('logger', () => {
  it('records the scope, level and message', () => {
    log.warn('something odd');
    const [entry] = recentLogs();
    expect(entry).toMatchObject({ scope: 'test', level: 'warn', message: 'something odd' });
  });

  it('captures the error name, message and a trimmed stack', () => {
    log.error('failed to save', new TypeError('bad input'));
    const [entry] = recentLogs();
    expect(entry.error?.name).toBe('TypeError');
    expect(entry.error?.message).toBe('bad input');
    expect((entry.error?.stack ?? '').split('\n').length).toBeLessThanOrEqual(12);
  });

  it('keeps context only when there is some', () => {
    log.info('with', { id: 'abc' });
    log.info('without', {});
    const [withContext, withoutContext] = recentLogs();
    expect(withContext.context).toEqual({ id: 'abc' });
    expect(withoutContext.context).toBeUndefined();
  });

  it('honours the minimum level', () => {
    setMinLogLevel('warn');
    log.debug('quiet');
    log.info('quiet');
    log.warn('loud');
    expect(recentLogs().map((e) => e.message)).toEqual(['loud']);
  });

  it('keeps the buffer bounded, dropping the oldest', () => {
    for (let i = 0; i < LOG_BUFFER_SIZE + 25; i += 1) log.info(`entry ${i}`);
    const entries = recentLogs();
    expect(entries).toHaveLength(LOG_BUFFER_SIZE);
    expect(entries[0].message).toBe('entry 25');
  });

  it('notifies subscribers and stops after unsubscribing', () => {
    const seen: string[] = [];
    const unsubscribe = subscribeToLogs((entry) => seen.push(entry.message));
    log.info('first');
    unsubscribe();
    log.info('second');
    expect(seen).toEqual(['first']);
  });

  it('survives a subscriber that throws', () => {
    subscribeToLogs(() => {
      throw new Error('listener is broken');
    });
    expect(() => log.info('still fine')).not.toThrow();
    expect(recentLogs()).toHaveLength(1);
  });
});

describe('formatLogs', () => {
  it('writes one readable block per entry', () => {
    log.error('save failed', new Error('disk full'), { table: 'transactions' });
    const text = formatLogs();
    expect(text).toContain('ERROR [test] save failed');
    expect(text).toContain('context: {"table":"transactions"}');
    expect(text).toContain('Error: disk full');
  });

  it('is empty when nothing was recorded', () => {
    expect(formatLogs()).toBe('');
  });
});
