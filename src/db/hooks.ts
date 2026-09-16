import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';

import { toFriendlyError } from './client';

/**
 * Every database-backed query key starts with this root. Mutations invalidate the
 * whole root: the data is local, so refetching active queries is cheap and it keeps
 * dashboards, ledgers and balances consistent without tracking dependencies.
 */
export const DB_QUERY_ROOT = 'db';

export function dbKey(...parts: unknown[]): QueryKey {
  return [DB_QUERY_ROOT, ...parts];
}

export function useDbQuery<T>(
  key: readonly unknown[],
  fetcher: (db: SQLiteDatabase) => Promise<T>,
  options: { enabled?: boolean; keepPrevious?: boolean } = {}
) {
  const db = useSQLiteContext();
  return useQuery({
    queryKey: dbKey(...key),
    queryFn: () => fetcher(db),
    enabled: options.enabled,
    placeholderData: options.keepPrevious ? keepPreviousData : undefined,
  });
}

export function useInfiniteDbQuery<T>(
  key: readonly unknown[],
  fetchPage: (db: SQLiteDatabase, page: { limit: number; offset: number }) => Promise<T[]>,
  pageSize = 30
) {
  const db = useSQLiteContext();
  return useInfiniteQuery({
    queryKey: dbKey(...key),
    queryFn: ({ pageParam }) => fetchPage(db, { limit: pageSize, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) =>
      lastPage.length < pageSize ? undefined : pages.length * pageSize,
    placeholderData: keepPreviousData,
  });
}

export function useDbMutation<TVariables = void, TResult = void>(
  mutate: (db: SQLiteDatabase, variables: TVariables) => Promise<TResult>
) {
  const db = useSQLiteContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (variables: TVariables) => {
      try {
        return await mutate(db, variables);
      } catch (error) {
        throw toFriendlyError(error);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [DB_QUERY_ROOT] }),
  });
}
