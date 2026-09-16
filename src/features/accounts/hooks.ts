import { useDbMutation, useDbQuery } from '@/db/hooks';

import {
  createAccount,
  createAccountType,
  deleteAccount,
  deleteAccountType,
  getAccount,
  getAccountType,
  listAccounts,
  listAccountTypes,
  setAccountArchived,
  updateAccount,
  updateAccountType,
  type AccountInput,
  type AccountTypeInput,
} from './repository';

export function useAccounts({ includeArchived = true }: { includeArchived?: boolean } = {}) {
  return useDbQuery(['accounts', 'list', includeArchived], (db) =>
    listAccounts(db, { includeArchived })
  );
}

export function useAccount(id: string | undefined) {
  return useDbQuery(['accounts', 'item', id], (db) => getAccount(db, id!), { enabled: !!id });
}

export function useSaveAccount() {
  return useDbMutation((db, { id, input }: { id?: string; input: AccountInput }) =>
    id ? updateAccount(db, id, input).then(() => id) : createAccount(db, input)
  );
}

export function useArchiveAccount() {
  return useDbMutation((db, { id, archived }: { id: string; archived: boolean }) =>
    setAccountArchived(db, id, archived)
  );
}

export function useDeleteAccount() {
  return useDbMutation((db, id: string) => deleteAccount(db, id));
}

export function useAccountTypes() {
  return useDbQuery(['account-types', 'list'], listAccountTypes);
}

export function useAccountType(id: string | undefined) {
  return useDbQuery(['account-types', 'item', id], (db) => getAccountType(db, id!), {
    enabled: !!id,
  });
}

export function useSaveAccountType() {
  return useDbMutation((db, { id, input }: { id?: string; input: AccountTypeInput }) =>
    id ? updateAccountType(db, id, input).then(() => id) : createAccountType(db, input)
  );
}

export function useDeleteAccountType() {
  return useDbMutation((db, id: string) => deleteAccountType(db, id));
}
