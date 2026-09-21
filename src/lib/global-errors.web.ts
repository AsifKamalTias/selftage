import { logger, toError } from './logger';

const log = logger('app');

let installed = false;

/** The browser equivalent: window-level error and unhandled rejection events. */
export function installGlobalErrorHandlers(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('error', (event) => {
    log.error('Uncaught error', event.error ?? event.message, {
      source: event.filename,
      line: event.lineno,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    log.error('Unhandled promise rejection', toError(event.reason));
  });
}
