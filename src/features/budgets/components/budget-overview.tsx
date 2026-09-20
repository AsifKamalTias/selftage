import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/loader';
import { Section } from '@/components/ui/section';
import type { BudgetHealth, BudgetStatus } from '@/db/types';
import { spacing } from '@/theme/tokens';

import { BudgetProgressCard } from './budget-progress-card';

const RANK: Record<BudgetHealth, number> = { exceeded: 0, warning: 1, ok: 2 };

/** Budgets needing attention first, then the closest to their limit. */
export function sortByAttention(statuses: BudgetStatus[]): BudgetStatus[] {
  return [...statuses].sort((a, b) => RANK[a.health] - RANK[b.health] || b.progress - a.progress);
}

export function BudgetOverview({
  statuses,
  isPending,
  limit = 3,
}: {
  statuses: BudgetStatus[];
  isPending: boolean;
  limit?: number;
}) {
  const sorted = sortByAttention(statuses);
  const visible = sorted.slice(0, limit);
  const attention = statuses.filter((s) => s.health !== 'ok').length;

  return (
    <Section
      title="Budgets"
      caption={
        statuses.length === 0
          ? 'Set limits to stay on track'
          : attention > 0
            ? `${attention} of ${statuses.length} need attention`
            : `${statuses.length} budget${statuses.length === 1 ? '' : 's'} on track`
      }
      action={
        statuses.length > 0
          ? { label: 'Manage', onPress: () => router.push('/budgets') }
          : undefined
      }>
      {isPending ? (
        <Skeleton height={120} radius={20} />
      ) : statuses.length === 0 ? (
        <Card padded={false}>
          <EmptyState
            compact
            icon="speedometer-outline"
            title="No budgets yet"
            message="Set a daily, weekly or monthly limit — overall or for a single expense type."
            action={{
              label: 'Set a budget',
              icon: 'add',
              onPress: () => router.push('/budgets/form'),
            }}
          />
        </Card>
      ) : (
        <View style={styles.list}>
          {visible.map((status) => (
            <BudgetProgressCard
              key={status.id}
              status={status}
              compact
              onPress={() => router.push({ pathname: '/budgets/form', params: { id: status.id } })}
            />
          ))}
        </View>
      )}
    </Section>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.md,
  },
});
