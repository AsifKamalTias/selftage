import { useDbQuery } from '@/db/hooks';
import { rangeForPreset, todayISO, type PeriodPreset } from '@/lib/date';

import { getDashboardData } from './repository';

export function useDashboard(preset: PeriodPreset) {
  // Including today's date keeps "this month" correct when the app stays open past midnight.
  const today = todayISO();
  return useDbQuery(
    ['dashboard', preset, today],
    (db) => getDashboardData(db, rangeForPreset(preset)),
    { keepPrevious: true }
  );
}
