import { router } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/loader';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { BudgetOverview } from '@/features/budgets/components/budget-overview';
import { useBudgetStatuses } from '@/features/budgets/hooks';
import {
  AccountsStrip,
  AccountTable,
  RecentCard,
  TopExpensesTable,
} from '@/features/dashboard/components/accounts-overview';
import { BalanceHero } from '@/features/dashboard/components/balance-hero';
import {
  BreakdownCard,
  CashFlowCard,
  TrendCard,
} from '@/features/dashboard/components/charts-section';
import { PeriodSelector } from '@/features/dashboard/components/period-selector';
import { StatGrid } from '@/features/dashboard/components/stat-grid';
import { useDashboard } from '@/features/dashboard/hooks';
import { useSettings } from '@/features/settings/settings-provider';
import { TransactionRow } from '@/features/transactions/components/transaction-row';
import { formatRange, greetingForNow, periodLabel, type PeriodPreset } from '@/lib/date';
import { useTheme } from '@/theme/theme-provider';
import { brandGradient, spacing } from '@/theme/tokens';

function Header() {
  const { settings } = useSettings();
  const { colors } = useTheme();
  const name = settings.displayName.trim();
  const initials = name
    ? name
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('')
    : null;

  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <Text variant="callout" color="textSecondary">
          {greetingForNow()}
          {name ? ',' : ''}
        </Text>
        <Text variant="title" numberOfLines={1}>
          {name || 'Your finances'}
        </Text>
      </View>
      <PressableScale
        scaleTo={0.9}
        onPress={() => router.push('/settings')}
        accessibilityLabel="Open settings"
        style={[
          styles.avatar,
          { backgroundColor: initials ? brandGradient[0] : colors.surfaceMuted },
        ]}>
        {initials ? (
          <Text weight="bold" color="#FFFFFF">
            {initials}
          </Text>
        ) : (
          <Text variant="heading">👋</Text>
        )}
      </PressableScale>
    </View>
  );
}

function DashboardSkeleton() {
  return (
    <View style={styles.skeleton}>
      <Skeleton height={190} radius={28} />
      <View style={styles.skeletonRow}>
        <View style={styles.flex}>
          <Skeleton height={110} radius={20} />
        </View>
        <View style={styles.flex}>
          <Skeleton height={110} radius={20} />
        </View>
      </View>
      <Skeleton height={260} radius={20} />
    </View>
  );
}

export default function DashboardScreen() {
  const [preset, setPreset] = useState<PeriodPreset>('this-month');
  const { settings } = useSettings();
  const { colors } = useTheme();
  const { data, isPending, isRefetching, refetch, error } = useDashboard(preset);
  const budgets = useBudgetStatuses();

  const hasActivity = !!data && data.totals.count > 0;
  const rangeText = data ? formatRange(data.range, settings.dateFormat) : '';

  return (
    <Screen
      safeTop
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }>
      <Header />
      <View style={styles.period}>
        <PeriodSelector value={preset} onChange={setPreset} />
        {rangeText ? (
          <Text variant="caption" color="textMuted">
            {rangeText}
          </Text>
        ) : null}
      </View>

      {error ? (
        <EmptyState
          icon="warning-outline"
          title="Couldn't load your dashboard"
          message={error.message}
          action={{ label: 'Try again', onPress: () => refetch() }}
        />
      ) : isPending || !data ? (
        <DashboardSkeleton />
      ) : (
        <Animated.View entering={FadeInDown.duration(350)} style={styles.content}>
          <BalanceHero
            totalBalance={data.totalBalance}
            income={data.totals.income}
            expense={data.totals.expense}
            periodLabel={periodLabel(preset)}
          />

          <View style={styles.actions}>
            <Button
              title="Add income"
              icon="arrow-down"
              variant="secondary"
              style={styles.flex}
              onPress={() =>
                router.push({ pathname: '/transaction/new', params: { kind: 'income' } })
              }
            />
            <Button
              title="Add expense"
              icon="arrow-up"
              variant="secondary"
              style={styles.flex}
              onPress={() =>
                router.push({ pathname: '/transaction/new', params: { kind: 'expense' } })
              }
            />
          </View>

          <StatGrid
            totals={data.totals}
            previous={data.previousTotals}
            averageDailyExpense={data.averageDailyExpense}
          />

          <BudgetOverview statuses={budgets.data ?? []} isPending={budgets.isPending} />

          {hasActivity ? (
            <>
              <CashFlowCard buckets={data.buckets} granularity={data.granularity} />
              <BreakdownCard
                expenseByCategory={data.expenseByCategory}
                incomeByCategory={data.incomeByCategory}
                expenseBySource={data.expenseBySource}
                incomeBySource={data.incomeBySource}
              />
              <TrendCard points={data.cumulative} />
            </>
          ) : (
            <EmptyState
              icon="sparkles-outline"
              title="Nothing recorded for this period"
              message="Tap + to add your first income or expense. Charts appear as soon as you do."
              action={{
                label: 'Add transaction',
                icon: 'add',
                onPress: () => router.push('/transaction/new'),
              }}
            />
          )}

          <AccountsStrip accounts={data.accounts} />
          <AccountTable accounts={data.accounts} />
          <TopExpensesTable items={data.largestExpenses} />

          {data.recent.length > 0 ? (
            <RecentCard>
              {data.recent.map((item) => (
                <TransactionRow key={item.id} item={item} showDate />
              ))}
            </RecentCard>
          ) : null}
        </Animated.View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  period: {
    gap: spacing.sm,
    marginTop: -spacing.xs,
  },
  content: {
    gap: spacing.xxl,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  flex: {
    flex: 1,
  },
  skeleton: {
    gap: spacing.lg,
  },
  skeletonRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
});
