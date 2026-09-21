import { getCalendars, getLocales } from 'expo-localization';

import {
  DATE_FORMATS,
  DEFAULT_WEEK_START,
  WEEK_STARTS,
  type DateFormat,
  type WeekStart,
} from '@/lib/date';

import { FALLBACK_CURRENCY_CODE, isSupportedCurrency } from './currencies';

export type ThemeMode = 'system' | 'light' | 'dark';

export interface AppSettings {
  currency: string;
  themeMode: ThemeMode;
  dateFormat: DateFormat;
  defaultAccountId: string | null;
  /** Used for the dashboard greeting. */
  displayName: string;
  /** First day of the week (0 = Sunday), used by weekly budgets and "this week". */
  weekStartsOn: WeekStart;
  /** Master switch for every reminder. */
  notificationsEnabled: boolean;
  /** Reminders for recurring entries waiting to be marked paid. */
  notifyRecurring: boolean;
  /** Reminders for payables and receivables reaching their due date. */
  notifyOutstanding: boolean;
  /** Time of day reminders fire, as 24-hour "HH:MM". */
  notificationTime: string;
}

/** Matches a 24-hour "HH:MM". */
export function isReminderTime(value: unknown): value is string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export const DEFAULT_NOTIFICATION_TIME = '09:00';

export type SettingKey = keyof AppSettings;

export function deviceCurrency(): string {
  const code = getLocales()[0]?.currencyCode;
  return isSupportedCurrency(code) ? code : FALLBACK_CURRENCY_CODE;
}

/** The device's first day of week; `firstWeekday` is 1 = Sunday, ours is 0 = Sunday. */
export function deviceWeekStart(): WeekStart {
  const firstWeekday = getCalendars()[0]?.firstWeekday;
  if (firstWeekday == null) return DEFAULT_WEEK_START;
  const normalized = (firstWeekday - 1) as WeekStart;
  return WEEK_STARTS.includes(normalized) ? normalized : DEFAULT_WEEK_START;
}

export function defaultSettings(): AppSettings {
  return {
    currency: deviceCurrency(),
    themeMode: 'system',
    dateFormat: 'DD MMM YYYY',
    defaultAccountId: null,
    displayName: '',
    weekStartsOn: deviceWeekStart(),
    notificationsEnabled: false,
    notifyRecurring: true,
    notifyOutstanding: true,
    notificationTime: DEFAULT_NOTIFICATION_TIME,
  };
}

/** Validates values read from storage so a corrupted row never breaks the app. */
export function sanitizeSettings(raw: Partial<Record<SettingKey, unknown>>): AppSettings {
  const defaults = defaultSettings();
  const themeMode = raw.themeMode;
  const dateFormat = raw.dateFormat;
  return {
    currency:
      typeof raw.currency === 'string' && isSupportedCurrency(raw.currency)
        ? raw.currency
        : defaults.currency,
    themeMode:
      themeMode === 'light' || themeMode === 'dark' || themeMode === 'system'
        ? themeMode
        : defaults.themeMode,
    dateFormat: DATE_FORMATS.includes(dateFormat as DateFormat)
      ? (dateFormat as DateFormat)
      : defaults.dateFormat,
    defaultAccountId: typeof raw.defaultAccountId === 'string' ? raw.defaultAccountId : null,
    displayName: typeof raw.displayName === 'string' ? raw.displayName : '',
    weekStartsOn: WEEK_STARTS.includes(raw.weekStartsOn as WeekStart)
      ? (raw.weekStartsOn as WeekStart)
      : defaults.weekStartsOn,
    notificationsEnabled: raw.notificationsEnabled === true,
    notifyRecurring: raw.notifyRecurring !== false,
    notifyOutstanding: raw.notifyOutstanding !== false,
    notificationTime: isReminderTime(raw.notificationTime)
      ? raw.notificationTime
      : defaults.notificationTime,
  };
}
