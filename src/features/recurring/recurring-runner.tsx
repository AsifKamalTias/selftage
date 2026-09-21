import { useQueryClient } from '@tanstack/react-query';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { useToast } from '@/components/ui/toast';
import { DB_QUERY_ROOT } from '@/db/hooks';
import { useBudgetAlertPresenter } from '@/features/budgets/use-budget-alerts';
import { useSettings } from '@/features/settings/settings-provider';
import { todayISO } from '@/lib/date';

import { runDueRecurring } from './runner';
import { logger } from '@/lib/logger';

const log = logger('recurring');

/**
 * Posts whatever recurring entries are due and reports the result. Safe to call at any
 * time — rules only advance past occurrences they actually posted.
 */
export function useRecurringRun() {
  const db = useSQLiteContext();
  const queryClient = useQueryClient();
  const toast = useToast();
  const presentBudgetAlerts = useBudgetAlertPresenter();
  const { formatAmount } = useSettings();
  // Foreground events can arrive in bursts; never let two runs overlap.
  const running = useRef(false);

  return useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      const result = await runDueRecurring(db);
      if (result.created.length > 0) {
        await queryClient.invalidateQueries({ queryKey: [DB_QUERY_ROOT] });
        const [first] = result.created;
        toast.success(
          result.created.length > 1
            ? `${result.created.length} recurring added`
            : `${first.name} added · ${formatAmount(first.amount)}`
        );
        presentBudgetAlerts(result.budgetAlerts);
      }
      if (result.queued.length > 0) {
        await queryClient.invalidateQueries({ queryKey: [DB_QUERY_ROOT] });
        const [first] = result.queued;
        toast.show(
          result.queued.length > 1
            ? `${result.queued.length} recurring are waiting to be marked paid`
            : `${first.name} is waiting to be marked paid`,
          'info'
        );
      }
      if (result.paused.length > 0) {
        await queryClient.invalidateQueries({ queryKey: [DB_QUERY_ROOT] });
        toast.error(`${result.paused[0].name} was paused: ${result.paused[0].reason}`);
      }
    } catch (error) {
      log.error('Recurring run failed', error);
    } finally {
      running.current = false;
    }
  }, [db, queryClient, toast, presentBudgetAlerts, formatAmount]);
}

/** Runs due entries on launch and whenever the app returns to the foreground. */
export function RecurringRunner() {
  const run = useRecurringRun();
  const runRef = useRef(run);
  const lastRunDay = useRef<string | null>(null);

  useEffect(() => {
    runRef.current = run;
  }, [run]);

  useEffect(() => {
    const tick = () => {
      const today = todayISO();
      if (lastRunDay.current === today) return;
      lastRunDay.current = today;
      runRef.current();
    };

    tick();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') tick();
    });
    return () => subscription.remove();
  }, []);

  return null;
}
