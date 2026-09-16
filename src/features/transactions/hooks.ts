import { useDbMutation, useDbQuery, useInfiniteDbQuery } from '@/db/hooks';
import type { PickedFile } from '@/features/attachments/types';

import {
  getTransaction,
  listTransactions,
  summarizeTransactions,
  type TransactionFilters,
  type TransactionInput,
} from './repository';
import { createTransaction, deleteTransaction, updateTransaction } from './service';

export function useTransactionList(filters: TransactionFilters) {
  return useInfiniteDbQuery(['transactions', 'list', filters], (db, page) =>
    listTransactions(db, filters, page)
  );
}

export function useTransactionSummary(filters: TransactionFilters) {
  return useDbQuery(['transactions', 'summary', filters], (db) =>
    summarizeTransactions(db, filters)
  );
}

export function useTransaction(id: string | undefined) {
  return useDbQuery(['transactions', 'item', id], (db) => getTransaction(db, id!), {
    enabled: !!id,
  });
}

export function useCreateTransaction() {
  return useDbMutation((db, { input, files }: { input: TransactionInput; files: PickedFile[] }) =>
    createTransaction(db, input, files)
  );
}

export function useUpdateTransaction() {
  return useDbMutation(
    (
      db,
      {
        id,
        input,
        added,
        removedIds,
      }: { id: string; input: TransactionInput; added: PickedFile[]; removedIds: string[] }
    ) => updateTransaction(db, id, input, { added, removedIds })
  );
}

export function useDeleteTransaction() {
  return useDbMutation((db, id: string) => deleteTransaction(db, id));
}
