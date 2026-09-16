import { useDbMutation, useDbQuery } from '@/db/hooks';
import type { EntryKind } from '@/db/types';

import {
  createCatalogItem,
  deleteCatalogItem,
  getCatalogItem,
  listCatalog,
  updateCatalogItem,
  type CatalogInput,
  type CatalogTable,
} from './repository';

export function useCatalog(table: CatalogTable, kind?: EntryKind) {
  return useDbQuery([table, 'list', kind ?? 'all'], (db) => listCatalog(db, table, kind));
}

export function useCatalogItem(table: CatalogTable, id: string | undefined) {
  return useDbQuery([table, 'item', id], (db) => getCatalogItem(db, table, id!), {
    enabled: !!id,
  });
}

export function useSaveCatalogItem(table: CatalogTable) {
  return useDbMutation((db, { id, input }: { id?: string; input: CatalogInput }) =>
    id
      ? updateCatalogItem(db, table, id, input).then(() => id)
      : createCatalogItem(db, table, input)
  );
}

export function useDeleteCatalogItem(table: CatalogTable) {
  return useDbMutation((db, id: string) => deleteCatalogItem(db, table, id));
}
