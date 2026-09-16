import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useSQLiteContext } from 'expo-sqlite';
import { createContext, use, useCallback, type ReactNode } from 'react';

import { dbKey } from '@/db/hooks';
import { formatDate as formatISODate } from '@/lib/date';
import { formatMoney, type FormatMoneyOptions } from '@/lib/money';

import { getCurrency, type Currency } from './currencies';
import { loadSettings, saveSettings } from './repository';
import type { AppSettings } from './settings';

interface SettingsContextValue {
  settings: AppSettings;
  currency: Currency;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  formatAmount: (minor: number, options?: FormatMoneyOptions) => string;
  formatDate: (iso: string) => string;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

const SETTINGS_KEY = dbKey('settings');

export function SettingsProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const queryClient = useQueryClient();
  const { data: settings } = useSuspenseQuery({
    queryKey: SETTINGS_KEY,
    queryFn: () => loadSettings(db),
  });

  const updateSettings = useCallback(
    async (patch: Partial<AppSettings>) => {
      const previous = queryClient.getQueryData<AppSettings>(SETTINGS_KEY);
      queryClient.setQueryData<AppSettings>(SETTINGS_KEY, (current) =>
        current ? { ...current, ...patch } : current
      );
      try {
        await saveSettings(db, patch);
      } catch (error) {
        queryClient.setQueryData(SETTINGS_KEY, previous);
        throw error;
      }
    },
    [db, queryClient]
  );

  const currency = getCurrency(settings.currency);
  const value: SettingsContextValue = {
    settings,
    currency,
    updateSettings,
    formatAmount: (minor, options) => formatMoney(minor, currency, options),
    formatDate: (iso) => formatISODate(iso, settings.dateFormat),
  };

  return <SettingsContext value={value}>{children}</SettingsContext>;
}

export function useSettings(): SettingsContextValue {
  const context = use(SettingsContext);
  if (!context) throw new Error('useSettings must be used inside <SettingsProvider>');
  return context;
}
