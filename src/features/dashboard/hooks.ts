import { useDbQuery } from '@/db/hooks';
import { useSettings } from '@/features/settings/settings-provider';
import { rangeForPreset, todayISO, type PeriodPreset } from '@/lib/date';

import { getDashboardData } from './repository';

export function useDashboard(preset: PeriodPreset) {
  const { settings } = useSettings();
  const weekStartsOn = settings.weekStartsOn;
  // Including today's date keeps "this month" correct when the app stays open past midnight.
  const today = todayISO();
  return useDbQuery(
    ['dashboard', preset, weekStartsOn, today],
    (db) => getDashboardData(db, rangeForPreset(preset, { weekStartsOn }), weekStartsOn),
    { keepPrevious: true }
  );
}
