import { useDbQuery, useInfiniteDbQuery } from '@/db/hooks';

import {
  getLedgerStatements,
  getLedgerSummary,
  listLedgerEntries,
  type LedgerFilters,
} from './repository';

export function useLedgerEntries(filters: LedgerFilters) {
  return useInfiniteDbQuery(['ledger', 'entries', filters], (db, page) =>
    listLedgerEntries(db, filters, page)
  );
}

export function useLedgerSummary(filters: LedgerFilters) {
  const { accountId, from, to } = filters;
  return useDbQuery(
    ['ledger', 'summary', { accountId, from, to }],
    (db) => getLedgerSummary(db, { accountId, from, to }),
    { keepPrevious: true }
  );
}

export function useLedgerStatements(params: {
  from?: string;
  to?: string;
  accountIds: string[] | null;
}) {
  return useDbQuery(['ledger', 'statements', params], (db) => getLedgerStatements(db, params), {
    keepPrevious: true,
  });
}
