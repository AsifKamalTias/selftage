import { useQueryClient } from '@tanstack/react-query';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { DB_QUERY_ROOT } from '@/db/hooks';
import { useSettings } from '@/features/settings/settings-provider';

import { collectReminders, planReminders } from './reminders';
import { applyReminders, clearReminders } from './scheduler';

/**
 * Rebuilds the whole reminder queue from what is currently due. Cheap enough to run on
 * every foreground, and rescheduling wholesale means a settled record stops nagging.
 */
export function useReminderSync() {
  const db = useSQLiteContext();
  const { settings } = useSettings();
  const { notificationsEnabled, notifyRecurring, notifyOutstanding, notificationTime } = settings;

  return useCallback(async () => {
    try {
      if (!notificationsEnabled) {
        await clearReminders();
        return 0;
      }
      const events = await collectReminders(db, {
        recurring: notifyRecurring,
        outstanding: notifyOutstanding,
      });
      return await applyReminders(planReminders(events, { time: notificationTime }));
    } catch (error) {
      console.warn('Could not refresh reminders', error);
      return 0;
    }
  }, [db, notificationsEnabled, notifyRecurring, notifyOutstanding, notificationTime]);
}

/** Keeps the scheduled reminders in step with the data and the settings. */
export function ReminderRunner() {
  const sync = useReminderSync();
  const queryClient = useQueryClient();
  const syncRef = useRef(sync);

  useEffect(() => {
    syncRef.current = sync;
    sync();
  }, [sync]);

  useEffect(() => {
    // Any write invalidates the database root; reminders follow the same signal.
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== 'updated' || event.action.type !== 'invalidate') return;
      if (event.query.queryKey[0] !== DB_QUERY_ROOT) return;
      syncRef.current();
    });
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') syncRef.current();
    });
    return () => {
      unsubscribe();
      subscription.remove();
    };
  }, [queryClient]);

  return null;
}
