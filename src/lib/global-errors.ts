import { logger, toError } from './logger';

const log = logger('app');

let installed = false;

/**
 * Catches what no local `try` did: uncaught JS exceptions and rejected promises that
 * nobody handled. The previous handler is kept so React Native still shows its red box
 * in development and still ends a fatal session in production.
 */
export function installGlobalErrorHandlers(): void {
  if (installed) return;
  installed = true;

  const errorUtils = (globalThis as { ErrorUtils?: typeof ErrorUtils }).ErrorUtils;
  if (errorUtils) {
    const previous = errorUtils.getGlobalHandler();
    errorUtils.setGlobalHandler((error, isFatal) => {
      log.error(isFatal ? 'Uncaught fatal error' : 'Uncaught error', error, { isFatal: !!isFatal });
      previous?.(error, isFatal);
    });
  }

  // Hermes reports unhandled rejections through this hook when it is enabled.
  const tracking = (
    globalThis as {
      HermesInternal?: { enablePromiseRejectionTracker?: (options: unknown) => void };
    }
  ).HermesInternal;
  tracking?.enablePromiseRejectionTracker?.({
    allRejections: true,
    onUnhandled: (id: number, rejection: unknown) => {
      log.error('Unhandled promise rejection', toError(rejection), { id });
    },
  });
}
