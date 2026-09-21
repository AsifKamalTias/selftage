import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Amount } from '@/components/ui/amount';
import { IconButton } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { HorizontalScroll } from '@/components/ui/horizontal-scroll';
import { ListSkeleton, Loader } from '@/components/ui/loader';
import { MenuButton } from '@/components/navigation/app-menu';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SearchBar } from '@/components/ui/search-bar';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Text } from '@/components/ui/text';
import type { EntryKind, Transaction } from '@/db/types';
import { useAccounts } from '@/features/accounts/hooks';
import { useCatalog } from '@/features/catalog/hooks';
import { useGroups } from '@/features/groups/hooks';
import { useSettings } from '@/features/settings/settings-provider';
import {
  activeFilterCount,
  EMPTY_FILTERS,
  FilterSheet,
  resolveRange,
  type HistoryFilters,
} from '@/features/transactions/components/filter-sheet';
import { TransactionRow } from '@/features/transactions/components/transaction-row';
import { useTransactionList, useTransactionSummary } from '@/features/transactions/hooks';
import { TRANSACTION_SORTS, type TransactionFilters } from '@/features/transactions/repository';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { formatDayHeading, formatRange, periodLabel } from '@/lib/date';
import { useTheme } from '@/theme/theme-provider';
import { maxContentWidth, radius, spacing } from '@/theme/tokens';

type KindFilter = 'all' | EntryKind;

type Row =
  | { type: 'header'; key: string; date: string; net: number }
  | { type: 'item'; key: string; item: Transaction };

function buildRows(items: Transaction[], grouped: boolean): Row[] {
  if (!grouped) return items.map((item) => ({ type: 'item', key: item.id, item }));
  const rows: Row[] = [];
  let header: Extract<Row, { type: 'header' }> | null = null;
  for (const item of items) {
    if (!header || header.date !== item.date) {
      header = { type: 'header', key: `h-${item.date}`, date: item.date, net: 0 };
      rows.push(header);
    }
    header.net += item.kind === 'income' ? item.amount : -item.amount;
    rows.push({ type: 'item', key: item.id, item });
  }
  return rows;
}

export default function TransactionsScreen() {
  // Deep links from a group or report land here pre-filtered.
  const params = useLocalSearchParams<{ groupId?: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { settings } = useSettings();
  const [kind, setKind] = useState<KindFilter>('all');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<HistoryFilters>(
    params.groupId ? { ...EMPTY_FILTERS, groupIds: [params.groupId] } : EMPTY_FILTERS
  );
  const [sheetOpen, setSheetOpen] = useState(false);
  const debouncedSearch = useDebouncedValue(search);

  const accounts = useAccounts();
  const categories = useCatalog('categories');
  const sources = useCatalog('sources');
  const groups = useGroups();

  const range = resolveRange(filters, settings.weekStartsOn);
  const query: TransactionFilters = {
    kind: kind === 'all' ? undefined : kind,
    search: debouncedSearch.trim() || undefined,
    from: range.from,
    to: range.to,
    categoryIds: filters.categoryIds,
    sourceIds: filters.sourceIds,
    accountIds: filters.accountIds,
    groupIds: filters.groupIds,
    minAmount: filters.minAmount,
    maxAmount: filters.maxAmount,
    withAttachments: filters.withAttachments || undefined,
    sort: filters.sort,
  };

  const list = useTransactionList(query);
  const summary = useTransactionSummary(query);
  const items = list.data?.pages.flat() ?? [];
  const grouped = filters.sort === 'newest' || filters.sort === 'oldest';
  const rows = buildRows(items, grouped);
  const filterCount = activeFilterCount(filters);
  const isFiltered = filterCount > 0 || !!query.search || kind !== 'all';

  const nameOf = (list: { id: string; name: string }[] | undefined, id: string) =>
    list?.find((x) => x.id === id)?.name ?? '…';

  const chips: { key: string; label: string; onRemove: () => void }[] = [];
  if (filters.period !== 'all') {
    chips.push({
      key: 'period',
      label:
        filters.period === 'custom'
          ? formatRange(range, settings.dateFormat)
          : periodLabel(filters.period),
      onRemove: () => setFilters({ ...filters, period: 'all', from: undefined, to: undefined }),
    });
  }
  for (const id of filters.accountIds) {
    chips.push({
      key: `a-${id}`,
      label: nameOf(accounts.data, id),
      onRemove: () =>
        setFilters({ ...filters, accountIds: filters.accountIds.filter((x) => x !== id) }),
    });
  }
  for (const id of filters.categoryIds) {
    chips.push({
      key: `c-${id}`,
      label: nameOf(categories.data, id),
      onRemove: () =>
        setFilters({ ...filters, categoryIds: filters.categoryIds.filter((x) => x !== id) }),
    });
  }
  for (const id of filters.sourceIds) {
    chips.push({
      key: `s-${id}`,
      label: nameOf(sources.data, id),
      onRemove: () =>
        setFilters({ ...filters, sourceIds: filters.sourceIds.filter((x) => x !== id) }),
    });
  }
  for (const id of filters.groupIds) {
    chips.push({
      key: `g-${id}`,
      label: id === '' ? 'No group' : nameOf(groups.data, id),
      onRemove: () =>
        setFilters({ ...filters, groupIds: filters.groupIds.filter((x) => x !== id) }),
    });
  }
  if (filters.minAmount != null || filters.maxAmount != null) {
    chips.push({
      key: 'amount',
      label: 'Amount range',
      onRemove: () => setFilters({ ...filters, minAmount: undefined, maxAmount: undefined }),
    });
  }
  if (filters.withAttachments) {
    chips.push({
      key: 'files',
      label: 'Has attachments',
      onRemove: () => setFilters({ ...filters, withAttachments: false }),
    });
  }
  if (filters.sort !== 'newest') {
    chips.push({
      key: 'sort',
      label: TRANSACTION_SORTS.find((s) => s.value === filters.sort)?.label ?? 'Sorted',
      onRemove: () => setFilters({ ...filters, sort: 'newest' }),
    });
  }

  const header = (
    <View style={styles.headerBlock}>
      <ScreenHeader
        title="History"
        subtitle="Income & expenses"
        left={<MenuButton />}
        right={
          <View>
            <IconButton
              icon="options-outline"
              accessibilityLabel={`Filters${filterCount ? `, ${filterCount} active` : ''}`}
              onPress={() => setSheetOpen(true)}
            />
            {filterCount > 0 ? (
              <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                <Text variant="micro" weight="bold" color="onPrimary">
                  {filterCount}
                </Text>
              </View>
            ) : null}
          </View>
        }
      />
      <SegmentedControl
        value={kind}
        onChange={(next) => {
          setKind(next);
          // Types and sources belong to one kind; drop selections that no longer apply.
          setFilters((f) => ({ ...f, categoryIds: [], sourceIds: [] }));
        }}
        options={[
          { value: 'all', label: 'All' },
          { value: 'income', label: 'Income', activeColor: colors.income },
          { value: 'expense', label: 'Expense', activeColor: colors.expense },
        ]}
      />
      <View style={styles.searchRow}>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search title, note, type, source, amount"
        />
      </View>
      {chips.length > 0 ? (
        <HorizontalScroll>
          {chips.map((chip) => (
            <Chip key={chip.key} label={chip.label} selected onRemove={chip.onRemove} />
          ))}
          <Chip
            label="Clear all"
            icon="close-circle-outline"
            onPress={() => setFilters(EMPTY_FILTERS)}
          />
        </HorizontalScroll>
      ) : null}
      <Card style={styles.summary} elevated={false} muted>
        <View style={styles.summaryItem}>
          <Text variant="micro" color="textMuted">
            Income
          </Text>
          <Amount value={summary.data?.income ?? 0} variant="callout" color="income" compact />
        </View>
        <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
        <View style={styles.summaryItem}>
          <Text variant="micro" color="textMuted">
            Expense
          </Text>
          <Amount value={summary.data?.expense ?? 0} variant="callout" color="expense" compact />
        </View>
        <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
        <View style={styles.summaryItem}>
          <Text variant="micro" color="textMuted">
            Net · {summary.data?.count ?? 0} items
          </Text>
          <Amount
            value={(summary.data?.income ?? 0) - (summary.data?.expense ?? 0)}
            variant="callout"
            colorize
            compact
          />
        </View>
      </Card>
    </View>
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <FlatList
        data={rows}
        keyExtractor={(row) => row.key}
        ListHeaderComponent={header}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (list.hasNextPage && !list.isFetchingNextPage) list.fetchNextPage();
        }}
        refreshControl={
          <RefreshControl
            refreshing={list.isRefetching && !list.isFetchingNextPage}
            onRefresh={() => list.refetch()}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        renderItem={({ item: row }) =>
          row.type === 'header' ? (
            <View style={styles.dayHeader}>
              <Text variant="label" weight="semibold" color="textSecondary" uppercase>
                {formatDayHeading(row.date, settings.dateFormat)}
              </Text>
              <Amount value={row.net} variant="caption" colorize signed weight="medium" />
            </View>
          ) : (
            <TransactionRow item={row.item} showDate={!grouped} />
          )
        }
        ListEmptyComponent={
          list.isPending ? (
            <ListSkeleton />
          ) : (
            <EmptyState
              icon={isFiltered ? 'search-outline' : 'receipt-outline'}
              title={isFiltered ? 'No matching transactions' : 'No transactions yet'}
              message={
                isFiltered
                  ? 'Try a different search or clear some filters.'
                  : 'Everything you earn and spend will show up here.'
              }
              action={
                isFiltered
                  ? {
                      label: 'Clear filters',
                      onPress: () => {
                        setFilters(EMPTY_FILTERS);
                        setSearch('');
                        setKind('all');
                      },
                    }
                  : {
                      label: 'Add transaction',
                      icon: 'add',
                      onPress: () => router.push('/transaction/new'),
                    }
              }
            />
          )
        }
        ListFooterComponent={
          list.isFetchingNextPage ? (
            <View style={styles.footerLoader}>
              <Loader size={28} />
            </View>
          ) : null
        }
      />
      <FilterSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        kind={kind === 'all' ? undefined : kind}
        value={filters}
        onApply={setFilters}
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
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  searchRow: {
    flexDirection: 'row',
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
  },
  summaryItem: {
    flex: 1,
    gap: 2,
    alignItems: 'center',
  },
  summaryDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
  },
  footerLoader: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
});
