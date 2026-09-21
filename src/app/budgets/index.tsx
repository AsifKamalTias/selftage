import { router, Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button, IconButton } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/loader';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { Text } from '@/components/ui/text';
import { BUDGET_PERIODS, type BudgetPeriod, type BudgetStatus } from '@/db/types';
import { sortByAttention } from '@/features/budgets/components/budget-overview';
import { BudgetProgressCard } from '@/features/budgets/components/budget-progress-card';
import { useBudgetStatuses } from '@/features/budgets/hooks';
import { BUDGET_PERIOD_LABELS } from '@/features/budgets/period';
import { useSettings } from '@/features/settings/settings-provider';
import { countOf, verbFor } from '@/lib/text';
import { formatDate } from '@/lib/date';
import { useTheme } from '@/theme/theme-provider';
import { spacing } from '@/theme/tokens';

function PeriodGroup({ period, statuses }: { period: BudgetPeriod; statuses: BudgetStatus[] }) {
  const { settings } = useSettings();
  if (statuses.length === 0) return null;
  const window = statuses[0];
  const range =
    period === 'daily'
      ? formatDate(window.from, settings.dateFormat)
      : `${formatDate(window.from, settings.dateFormat)} – ${formatDate(window.to, settings.dateFormat)}`;

  return (
    <Section title={`${BUDGET_PERIOD_LABELS[period]} budgets`} caption={range}>
      <View style={styles.list}>
        {sortByAttention(statuses).map((status) => (
          <BudgetProgressCard
            key={status.id}
            status={status}
            onPress={() => router.push({ pathname: '/budgets/form', params: { id: status.id } })}
            onEdit={(budget) =>
              router.push({ pathname: '/budgets/form', params: { id: budget.id } })
            }
          />
        ))}
      </View>
    </Section>
  );
}

export default function BudgetsScreen() {
  const { colors } = useTheme();
  const { data, isPending } = useBudgetStatuses({ includeInactive: true });
  const statuses = data ?? [];
  const active = statuses.filter((s) => s.isActive);
  const attention = active.filter((s) => s.health !== 'ok');

  return (
    <Screen safeBottom>
      <Stack.Screen
        options={{
          headerRight: () => (
            <IconButton
              icon="add"
              variant="plain"
              accessibilityLabel="Add budget"
              onPress={() => router.push('/budgets/form')}
            />
          ),
        }}
      />

      {isPending ? (
        <View style={styles.list}>
          <Skeleton height={90} radius={20} />
          <Skeleton height={140} radius={20} />
        </View>
      ) : statuses.length === 0 ? (
        <EmptyState
          icon="speedometer-outline"
          title="No budgets yet"
          message="Set a spending limit for a day, a week or a month — overall or for one expense type. You'll be warned as you approach it."
          action={{
            label: 'Set your first budget',
            icon: 'add',
            onPress: () => router.push('/budgets/form'),
          }}
        />
      ) : (
        <>
          <Card
            muted
            elevated={false}
            style={[
              styles.summary,
              { borderColor: attention.length ? colors.warning : colors.border },
            ]}>
            <Icon
              name={attention.length ? 'warning' : 'checkmark-circle'}
              size={22}
              color={attention.length ? 'warning' : 'income'}
            />
            <Text variant="callout" style={styles.summaryText}>
              {attention.length
                ? `${countOf(attention.length, 'budget')} ${verbFor(attention.length, 'needs', 'need')} attention this period.`
                : `All ${countOf(active.length, 'active budget')} ${verbFor(active.length, 'is', 'are')} on track.`}
            </Text>
          </Card>

          {BUDGET_PERIODS.map((period) => (
            <PeriodGroup
              key={period}
              period={period}
              statuses={statuses.filter((s) => s.period === period)}
            />
          ))}

          <Button
            title="Add budget"
            icon="add"
            variant="secondary"
            onPress={() => router.push('/budgets/form')}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.md,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
  },
  summaryText: {
    flex: 1,
  },
});
