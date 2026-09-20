import { useDbMutation, useDbQuery } from '@/db/hooks';

import {
  completeGoal,
  createGoal,
  deleteGoal,
  getAccountAvailability,
  getGoal,
  listGoalContributions,
  listGoals,
  releaseFromGoal,
  reserveForGoal,
  updateGoal,
  type CompleteGoalInput,
  type ContributionInput,
  type GoalInput,
} from './repository';

export function useGoals({ includeCompleted = true }: { includeCompleted?: boolean } = {}) {
  return useDbQuery(['goals', 'list', includeCompleted], (db) =>
    listGoals(db, { includeCompleted })
  );
}

export function useGoal(id: string | undefined) {
  return useDbQuery(['goals', 'item', id], (db) => getGoal(db, id!), { enabled: !!id });
}

export function useGoalContributions(goalId: string | undefined) {
  return useDbQuery(
    ['goals', 'contributions', goalId],
    (db) => listGoalContributions(db, goalId!),
    {
      enabled: !!goalId,
    }
  );
}

/** Balance minus what active goals hold, so the form can cap a reservation. */
export function useAccountAvailability(accountId: string | null) {
  return useDbQuery(
    ['goals', 'availability', accountId],
    (db) => getAccountAvailability(db, accountId!),
    { enabled: !!accountId, keepPrevious: true }
  );
}

export function useSaveGoal() {
  return useDbMutation((db, { id, input }: { id?: string; input: GoalInput }) =>
    id ? updateGoal(db, id, input).then(() => id) : createGoal(db, input)
  );
}

export function useReserveForGoal() {
  return useDbMutation((db, input: ContributionInput) => reserveForGoal(db, input));
}

export function useReleaseFromGoal() {
  return useDbMutation((db, input: ContributionInput) => releaseFromGoal(db, input));
}

export function useCompleteGoal() {
  return useDbMutation((db, input: CompleteGoalInput) => completeGoal(db, input));
}

export function useDeleteGoal() {
  return useDbMutation((db, id: string) => deleteGoal(db, id));
}
