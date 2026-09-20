import { useDbMutation, useDbQuery } from '@/db/hooks';
import type { BudgetPeriod } from '@/db/types';
import { useSettings } from '@/features/settings/settings-provider';
import { todayISO } from '@/lib/date';

import {
  createBudget,
  deleteBudget,
  getBudget,
  getScopeSpending,
  listBudgetStatuses,
  setBudgetActive,
  updateBudget,
  type BudgetInput,
} from './repository';

/** Budgets with the spending of their current period. */
export function useBudgetStatuses({ includeInactive = false }: { includeInactive?: boolean } = {}) {
  const { settings } = useSettings();
  // The date is part of the key so periods roll over when the app stays open past midnight.
  const today = todayISO();
  return useDbQuery(
    ['budgets', 'statuses', settings.weekStartsOn, includeInactive, today],
    (db) => listBudgetStatuses(db, { weekStartsOn: settings.weekStartsOn, includeInactive }),
    { keepPrevious: true }
  );
}

/** Spending so far in the current window for a scope, shown while choosing a limit. */
export function useScopeSpending(categoryId: string | null, period: BudgetPeriod) {
  const { settings } = useSettings();
  const today = todayISO();
  return useDbQuery(
    ['budgets', 'scope-spending', categoryId, period, settings.weekStartsOn, today],
    (db) => getScopeSpending(db, { categoryId, period, weekStartsOn: settings.weekStartsOn }),
    { keepPrevious: true }
  );
}

export function useBudget(id: string | undefined) {
  return useDbQuery(['budgets', 'item', id], (db) => getBudget(db, id!), { enabled: !!id });
}

export function useSaveBudget() {
  return useDbMutation((db, { id, input }: { id?: string; input: BudgetInput }) =>
    id ? updateBudget(db, id, input).then(() => id) : createBudget(db, input)
  );
}

export function useToggleBudget() {
  return useDbMutation((db, { id, isActive }: { id: string; isActive: boolean }) =>
    setBudgetActive(db, id, isActive)
  );
}

export function useDeleteBudget() {
  return useDbMutation((db, id: string) => deleteBudget(db, id));
}
