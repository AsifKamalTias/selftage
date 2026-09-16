import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { Icon, type IconName } from '@/components/ui/icon';
import { IconBadge } from '@/components/ui/icon-badge';
import { Text } from '@/components/ui/text';
import type { TransactionSummary } from '@/features/transactions/repository';
import { useSettings } from '@/features/settings/settings-provider';
import { percentChange } from '@/lib/money';
import { spacing } from '@/theme/tokens';

function Delta({ value, goodWhenUp }: { value: number | null; goodWhenUp: boolean }) {
  if (value == null) {
    return (
      <Text variant="micro" color="textMuted">
        No earlier data
      </Text>
    );
  }
  const up = value > 0;
  const flat = Math.abs(value) < 0.5;
  const good = flat ? null : up === goodWhenUp;
  const color = good == null ? 'textMuted' : good ? 'income' : 'expense';
  const icon: IconName = flat ? 'remove' : up ? 'trending-up' : 'trending-down';
  return (
    <View style={styles.delta}>
      <Icon name={icon} size={13} color={color} />
      <Text variant="micro" weight="semibold" color={color}>
        {flat ? 'No change' : `${Math.abs(value).toFixed(0)}%`}
      </Text>
      {!flat ? (
        <Text variant="micro" color="textMuted">
          vs prev.
        </Text>
      ) : null}
    </View>
  );
}

function StatCard({
  icon,
  color,
  label,
  value,
  footer,
}: {
  icon: IconName;
  color: string;
  label: string;
  value: string;
  footer: React.ReactNode;
}) {
  return (
    <Card style={styles.card}>
      <View style={styles.cardTop}>
        <IconBadge icon={icon} color={color} size={34} />
        <Text variant="caption" color="textSecondary" numberOfLines={1} style={styles.label}>
          {label}
        </Text>
      </View>
      <Text variant="subheading" weight="bold" tabular numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {footer}
    </Card>
  );
}

export function StatGrid({
  totals,
  previous,
  averageDailyExpense,
}: {
  totals: TransactionSummary;
  previous: TransactionSummary | null;
  averageDailyExpense: number;
}) {
  const { formatAmount } = useSettings();
  const net = totals.income - totals.expense;
  const prevNet = previous ? previous.income - previous.expense : null;

  return (
    <View style={styles.grid}>
      <View style={styles.row}>
        <StatCard
          icon="arrow-down-circle"
          color="#10B981"
          label="Income"
          value={formatAmount(totals.income)}
          footer={
            <Delta
              value={previous ? percentChange(totals.income, previous.income) : null}
              goodWhenUp
            />
          }
        />
        <StatCard
          icon="arrow-up-circle"
          color="#F43F5E"
          label="Expense"
          value={formatAmount(totals.expense)}
          footer={
            <Delta
              value={previous ? percentChange(totals.expense, previous.expense) : null}
              goodWhenUp={false}
            />
          }
        />
      </View>
      <View style={styles.row}>
        <StatCard
          icon="wallet"
          color="#6366F1"
          label="Net savings"
          value={formatAmount(net)}
          footer={<Delta value={prevNet != null ? percentChange(net, prevNet) : null} goodWhenUp />}
        />
        <StatCard
          icon="speedometer"
          color="#F59E0B"
          label="Avg. daily spend"
          value={formatAmount(averageDailyExpense)}
          footer={
            <Text variant="micro" color="textMuted">
              {totals.count} transaction{totals.count === 1 ? '' : 's'}
            </Text>
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  card: {
    flex: 1,
    gap: spacing.sm,
    padding: spacing.md + 2,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  label: {
    flex: 1,
  },
  delta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
});
