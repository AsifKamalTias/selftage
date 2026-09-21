import { isRunningInExpoGo } from 'expo';
import type * as NotificationsModule from 'expo-notifications';
import { Platform } from 'react-native';

import type { PlannedReminder } from './reminders';

/**
 * Expo Go dropped Android push support in SDK 53 and throws the moment
 * `expo-notifications` is imported, so the module is never loaded there — hence the
 * dynamic import below rather than a top-level one.
 */
export const remindersAvailable = !isRunningInExpoGo();

export const remindersUnavailableReason = isRunningInExpoGo()
  ? 'Expo Go cannot schedule reminders — use a development build'
  : null;

let pending: Promise<typeof NotificationsModule> | null = null;

async function notifications(): Promise<typeof NotificationsModule | null> {
  if (!remindersAvailable) return null;
  pending ??= import('expo-notifications');
  try {
    return await pending;
  } catch (error) {
    console.warn('Notifications are unavailable', error);
    pending = null;
    return null;
  }
}

/** Android needs a channel before anything can be shown. */
async function ensureChannel(Notifications: typeof NotificationsModule) {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('reminders', {
    name: 'Reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
  });
}

/** Asks once; a refusal is remembered by the OS, so this is cheap to call again. */
export async function requestReminderPermission(): Promise<boolean> {
  const Notifications = await notifications();
  if (!Notifications) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

export async function hasReminderPermission(): Promise<boolean> {
  const Notifications = await notifications();
  if (!Notifications) return false;
  return (await Notifications.getPermissionsAsync()).granted;
}

/**
 * Replaces every reminder we own with the current plan. Rescheduling wholesale keeps
 * the queue honest when records are settled, edited or deleted between runs.
 */
export async function applyReminders(reminders: PlannedReminder[]): Promise<number> {
  const Notifications = await notifications();
  if (!Notifications) return 0;

  await Notifications.cancelAllScheduledNotificationsAsync();
  if (reminders.length === 0) return 0;

  await ensureChannel(Notifications);
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
  const Notifications = await notifications();
  await Notifications?.cancelAllScheduledNotificationsAsync();
}
