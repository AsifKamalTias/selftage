import { useDbMutation, useDbQuery } from '@/db/hooks';

import {
  createRecurringRule,
  deleteRecurringRule,
  getRecurringRule,
  listRecurringRules,
  setRecurringActive,
  updateRecurringRule,
  type RecurringInput,
} from './repository';

export function useRecurringRules({ includeInactive = true }: { includeInactive?: boolean } = {}) {
  return useDbQuery(['recurring', 'list', includeInactive], (db) =>
    listRecurringRules(db, { includeInactive })
  );
}

export function useRecurringRule(id: string | undefined) {
  return useDbQuery(['recurring', 'item', id], (db) => getRecurringRule(db, id!), {
    enabled: !!id,
  });
}

export function useSaveRecurringRule() {
  return useDbMutation((db, { id, input }: { id?: string; input: RecurringInput }) =>
    id ? updateRecurringRule(db, id, input).then(() => id) : createRecurringRule(db, input)
  );
}

export function useToggleRecurringRule() {
  return useDbMutation((db, { id, isActive }: { id: string; isActive: boolean }) =>
    setRecurringActive(db, id, isActive)
  );
}

export function useDeleteRecurringRule() {
  return useDbMutation((db, id: string) => deleteRecurringRule(db, id));
}
