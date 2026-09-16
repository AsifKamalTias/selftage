import { getLocales } from 'expo-localization';

import { DATE_FORMATS, type DateFormat } from '@/lib/date';

import { FALLBACK_CURRENCY_CODE, isSupportedCurrency } from './currencies';

export type ThemeMode = 'system' | 'light' | 'dark';

export interface AppSettings {
  currency: string;
  themeMode: ThemeMode;
  dateFormat: DateFormat;
  defaultAccountId: string | null;
  /** Used for the dashboard greeting. */
  displayName: string;
}

export type SettingKey = keyof AppSettings;

export function deviceCurrency(): string {
  const code = getLocales()[0]?.currencyCode;
  return isSupportedCurrency(code) ? code : FALLBACK_CURRENCY_CODE;
}

export function defaultSettings(): AppSettings {
  return {
    currency: deviceCurrency(),
    themeMode: 'system',
    dateFormat: 'DD MMM YYYY',
    defaultAccountId: null,
    displayName: '',
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
  };
}
