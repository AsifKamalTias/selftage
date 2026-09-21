import type { PlannedReminder } from './reminders';

/**
 * The web build has no scheduled local notifications: a browser tab cannot wake itself
 * up. Reminders are simply a no-op here, and the settings screen says so.
 */
export const remindersAvailable = false;

export const remindersUnavailableReason = 'Reminders need the iOS or Android app';

export async function requestReminderPermission(): Promise<boolean> {
  return false;
}

export async function hasReminderPermission(): Promise<boolean> {
  return false;
}

export async function applyReminders(_reminders: PlannedReminder[]): Promise<number> {
  return 0;
}

export async function clearReminders(): Promise<void> {}
