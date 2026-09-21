import { useDbMutation, useDbQuery } from '@/db/hooks';

import {
  countPendingOccurrences,
  listPendingOccurrences,
  markOccurrencePaid,
  restoreOccurrence,
  skipOccurrence,
  type MarkPaidInput,
} from './occurrences';
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

export function usePendingOccurrences({ ruleId }: { ruleId?: string } = {}) {
  return useDbQuery(['recurring', 'pending', ruleId ?? 'all'], (db) =>
    listPendingOccurrences(db, { ruleId })
  );
}

export function usePendingOccurrenceCount() {
  return useDbQuery(['recurring', 'pending-count'], countPendingOccurrences);
}

export function useMarkOccurrencePaid() {
  return useDbMutation((db, input: MarkPaidInput) => markOccurrencePaid(db, input));
}

export function useSkipOccurrence() {
  return useDbMutation((db, id: string) => skipOccurrence(db, id));
}

export function useRestoreOccurrence() {
  return useDbMutation((db, id: string) => restoreOccurrence(db, id));
}
