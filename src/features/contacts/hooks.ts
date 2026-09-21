import { useDbMutation, useDbQuery } from '@/db/hooks';

import { getContact, listContacts } from './repository';
import { removeContact, saveContact, type ContactSaveInput } from './service';

export function useContacts({ search }: { search?: string } = {}) {
  return useDbQuery(['contacts', 'list', search ?? ''], (db) => listContacts(db, { search }));
}

export function useContact(id: string | undefined) {
  return useDbQuery(['contacts', 'item', id], (db) => getContact(db, id!), { enabled: !!id });
}

export function useSaveContact() {
  return useDbMutation((db, payload: { id?: string; input: ContactSaveInput }) =>
    saveContact(db, payload)
  );
}

export function useDeleteContact() {
  return useDbMutation((db, id: string) => removeContact(db, id));
}
