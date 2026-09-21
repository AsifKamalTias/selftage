import { useDbMutation, useDbQuery } from '@/db/hooks';
import { todayISO } from '@/lib/date';

import {
  createObligation,
  deleteObligation,
  getObligation,
  getOutstandingSummary,
  listInstallments,
  listObligations,
  setInstallmentPlan,
  settleObligation,
  updateObligation,
  type InstallmentPlan,
  type ObligationFilters,
  type ObligationInput,
  type SettleInput,
} from './repository';

export function useObligations(filters: ObligationFilters = {}) {
  return useDbQuery(
    ['outstanding', 'list', filters.contactId ?? '', filters.direction ?? '', filters.status ?? ''],
    (db) => listObligations(db, filters)
  );
}

export function useObligation(id: string | undefined) {
  return useDbQuery(['outstanding', 'item', id], (db) => getObligation(db, id!), {
    enabled: !!id,
  });
}

export function useOutstandingSummary() {
  return useDbQuery(['outstanding', 'summary'], (db) => getOutstandingSummary(db, todayISO()));
}

export function useInstallments(obligationId: string | undefined) {
  return useDbQuery(
    ['outstanding', 'installments', obligationId],
    (db) => listInstallments(db, obligationId!),
    { enabled: !!obligationId }
  );
}

export function useSaveObligation() {
  return useDbMutation(
    (
      db,
      { id, input, plan }: { id?: string; input: ObligationInput; plan?: InstallmentPlan | null }
    ) =>
      id
        ? updateObligation(db, id, input).then(() => id)
        : createObligation(db, input, plan ?? null)
  );
}

export function useSetInstallmentPlan() {
  return useDbMutation(
    (db, { obligationId, plan }: { obligationId: string; plan: InstallmentPlan | null }) =>
      setInstallmentPlan(db, obligationId, plan)
  );
}

export function useSettleObligation() {
  return useDbMutation((db, input: SettleInput) => settleObligation(db, input));
}

export function useDeleteObligation() {
  return useDbMutation((db, id: string) => deleteObligation(db, id));
}
