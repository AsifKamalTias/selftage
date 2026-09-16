import { StyleSheet, View } from 'react-native';

import { Amount } from '@/components/ui/amount';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme/theme-provider';
import { spacing } from '@/theme/tokens';

import type { LedgerSummary } from '../repository';

function Cell({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: 'income' | 'expense';
}) {
  return (
    <View style={styles.cell}>
      <Text variant="micro" color="textMuted" uppercase numberOfLines={1}>
        {label}
      </Text>
      <Amount value={value} variant="callout" weight="bold" color={color} compact />
    </View>
  );
}

export function LedgerSummaryCard({
  summary,
  showOpening,
}: {
  summary: LedgerSummary;
  showOpening: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        {showOpening ? <Cell label="Opening" value={summary.openingBalance} /> : null}
        <Cell label="Debit (in)" value={summary.totalDebit} color="income" />
        <Cell label="Credit (out)" value={summary.totalCredit} color="expense" />
      </View>
      <View style={[styles.closing, { borderTopColor: colors.border }]}>
        <Text variant="callout" color="textSecondary">
          Closing balance
        </Text>
        <Amount value={summary.closingBalance} variant="heading" weight="bold" />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cell: {
    flex: 1,
    gap: 2,
  },
  closing: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.md,
  },
});
