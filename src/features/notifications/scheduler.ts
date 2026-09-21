import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { PlannedReminder } from './reminders';

/** Android needs a channel before anything can be shown. */
async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('reminders', {
    name: 'Reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
  });
}

/** Asks once; a refusal is remembered by the OS, so this is cheap to call again. */
export async function requestReminderPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

export async function hasReminderPermission(): Promise<boolean> {
  return (await Notifications.getPermissionsAsync()).granted;
}

/**
 * Replaces every reminder we own with the current plan. Rescheduling wholesale keeps
 * the queue honest when records are settled, edited or deleted between runs.
 */
export async function applyReminders(reminders: PlannedReminder[]): Promise<number> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (reminders.length === 0) return 0;

  await ensureChannel();
  let scheduled = 0;
  for (const reminder of reminders) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: reminder.title,
          body: reminder.body,
          data: { route: reminder.route, kind: reminder.kind },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: reminder.at,
          ...(Platform.OS === 'android' ? { channelId: 'reminders' } : {}),
        },
      });
      scheduled += 1;
    } catch (error) {
      console.warn('Could not schedule a reminder', reminder.key, error);
    }
  }
  return scheduled;
}

export async function clearReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
