import { useDbMutation, useDbQuery } from '@/db/hooks';

import {
  createGroup,
  deleteGroup,
  getGroup,
  groupTotals,
  listGroups,
  setGroupArchived,
  updateGroup,
  type GroupInput,
} from './repository';

export function useGroups({ includeArchived = true }: { includeArchived?: boolean } = {}) {
  return useDbQuery(['groups', 'list', includeArchived], (db) =>
    listGroups(db, { includeArchived })
  );
}

export function useGroup(id: string | undefined) {
  return useDbQuery(['groups', 'item', id], (db) => getGroup(db, id!), { enabled: !!id });
}

export function useGroupTotals(range: { from?: string; to?: string }) {
  return useDbQuery(['groups', 'totals', range.from ?? 'all', range.to ?? 'all'], (db) =>
    groupTotals(db, range)
  );
}

export function useSaveGroup() {
  return useDbMutation((db, { id, input }: { id?: string; input: GroupInput }) =>
    id ? updateGroup(db, id, input).then(() => id) : createGroup(db, input)
  );
}

export function useSetGroupArchived() {
  return useDbMutation((db, { id, isArchived }: { id: string; isArchived: boolean }) =>
    setGroupArchived(db, id, isArchived)
  );
}

export function useDeleteGroup() {
  return useDbMutation((db, id: string) => deleteGroup(db, id));
}
