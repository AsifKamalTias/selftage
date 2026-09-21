import { useDbQuery } from '@/db/hooks';
import { useSettings } from '@/features/settings/settings-provider';

import { getDayReport, monthTotals } from './repository';

export function useMonthTotals(range: { from: string; to: string }) {
  return useDbQuery(['calendar', 'month', range.from, range.to], (db) => monthTotals(db, range));
}

export function useDayReport(date: string) {
  const { settings } = useSettings();
  return useDbQuery(['calendar', 'day', date, settings.weekStartsOn], (db) =>
    getDayReport(db, date, settings.weekStartsOn)
  );
}
