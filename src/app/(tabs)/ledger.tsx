import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { HorizontalScroll } from '@/components/ui/horizontal-scroll';
import { ListSkeleton, Loader, Skeleton } from '@/components/ui/loader';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SearchBar } from '@/components/ui/search-bar';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Text } from '@/components/ui/text';
import type { LedgerEntryType } from '@/db/types';
import { useAccounts } from '@/features/accounts/hooks';
import { PeriodSelector } from '@/features/dashboard/components/period-selector';
import { LedgerRow } from '@/features/ledger/components/ledger-row';
import { LedgerSummaryCard } from '@/features/ledger/components/ledger-summary-card';
import { useLedgerEntries, useLedgerSummary } from '@/features/ledger/hooks';
import type { LedgerFilters } from '@/features/ledger/repository';
import { useSettings } from '@/features/settings/settings-provider';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { formatRange, rangeForPreset, type PeriodPreset } from '@/lib/date';
import { useTheme } from '@/theme/theme-provider';
import { maxContentWidth, spacing } from '@/theme/tokens';

type EntryFilter = 'all' | 'debit' | 'credit';

const ENTRY_TYPE: Record<EntryFilter, LedgerEntryType | undefined> = {
  all: undefined,
  debit: 'income',
  credit: 'expense',
};

export default function LedgerScreen() {
  const params = useLocalSearchParams<{ accountId?: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { settings } = useSettings();
  const [accountId, setAccountId] = useState<string | undefined>(params.accountId);
  const [lastParam, setLastParam] = useState(params.accountId);
  const [preset, setPreset] = useState<PeriodPreset>('all');
  const [entryFilter, setEntryFilter] = useState<EntryFilter>('all');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);

  // Follow navigation requests such as "open this account's ledger".
  if (params.accountId !== lastParam) {
    setLastParam(params.accountId);
    if (params.accountId) setAccountId(params.accountId);
  }

  const accounts = useAccounts();
  const range = rangeForPreset(preset);
  const filters: LedgerFilters = {
    accountId,
    from: range.from,
    to: range.to,
    search: debouncedSearch.trim() || undefined,
    entryType: ENTRY_TYPE[entryFilter],
  };
  const entries = useLedgerEntries(filters);
  const summary = useLedgerSummary(filters);
  const rows = entries.data?.pages.flat() ?? [];
  const isFiltered = !!filters.search || entryFilter !== 'all';

  const header = (
    <View style={styles.headerBlock}>
      <ScreenHeader
        title="Ledger"
        subtitle="Every posting with running balance"
        right={
          <Button
            title="Report"
            icon="document-text-outline"
            size="sm"
            variant="secondary"
            onPress={() =>
              router.push({
                pathname: '/reports/ledger',
                params: { accountId: accountId ?? '', preset },
              })
            }
          />
        }
      />
      <HorizontalScroll>
        <Chip
          label="All accounts"
          icon="layers-outline"
          selected={!accountId}
          onPress={() => setAccountId(undefined)}
        />
        {(accounts.data ?? []).map((account) => (
          <Chip
            key={account.id}
            label={account.isArchived ? `${account.name} (archived)` : account.name}
            icon={account.icon}
            color={account.color}
            selected={accountId === account.id}
            onPress={() => setAccountId(account.id)}
          />
        ))}
      </HorizontalScroll>
      <PeriodSelector value={preset} onChange={setPreset} />
      <Text variant="caption" color="textMuted">
        {formatRange(range, settings.dateFormat)}
      </Text>
      {summary.data ? (
        <LedgerSummaryCard summary={summary.data} showOpening={!!range.from} />
      ) : (
        <Skeleton height={118} radius={20} />
      )}
      <View style={styles.searchRow}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search ledger" />
      </View>
      <SegmentedControl
        size="sm"
        value={entryFilter}
        onChange={setEntryFilter}
        options={[
          { value: 'all', label: 'All entries' },
          { value: 'debit', label: 'Debit (in)', activeColor: colors.income },
          { value: 'credit', label: 'Credit (out)', activeColor: colors.expense },
        ]}
      />
    </View>
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <FlatList
        data={rows}
        keyExtractor={(entry) => entry.id}
        ListHeaderComponent={header}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (entries.hasNextPage && !entries.isFetchingNextPage) entries.fetchNextPage();
        }}
        refreshControl={
          <RefreshControl
            refreshing={entries.isRefetching && !entries.isFetchingNextPage}
            onRefresh={() => {
              entries.refetch();
              summary.refetch();
            }}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        renderItem={({ item }) => <LedgerRow entry={item} showAccount={!accountId} />}
        ListEmptyComponent={
          entries.isPending ? (
            <ListSkeleton />
          ) : (
            <EmptyState
              icon={isFiltered ? 'search-outline' : 'book-outline'}
              title={isFiltered ? 'No matching entries' : 'No ledger entries'}
              message={
                isFiltered
                  ? 'Try another search or entry type.'
                  : 'Transactions you record are posted here automatically.'
              }
            />
          )
        }
        ListFooterComponent={
          entries.isFetchingNextPage ? (
            <View style={styles.footerLoader}>
              <Loader size={28} />
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  listContent: {
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  headerBlock: {
    gap: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  searchRow: {
    flexDirection: 'row',
  },
  footerLoader: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
});
