import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Amount } from '@/components/ui/amount';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ListSkeleton } from '@/components/ui/loader';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { Text } from '@/components/ui/text';
import { PeriodSelector } from '@/features/dashboard/components/period-selector';
import { GroupBreakdown } from '@/features/groups/components/group-breakdown';
import { useGroupTotals } from '@/features/groups/hooks';
import { useSettings } from '@/features/settings/settings-provider';
import { formatRange, periodLabel, rangeForPreset, type PeriodPreset } from '@/lib/date';
import { useTheme } from '@/theme/theme-provider';
import { spacing } from '@/theme/tokens';

export default function GroupReportScreen() {
  const [preset, setPreset] = useState<PeriodPreset>('this-month');
  const { settings, formatAmount } = useSettings();
  const { colors } = useTheme();

  const range = rangeForPreset(preset, { weekStartsOn: settings.weekStartsOn });
  const { data, isPending } = useGroupTotals(range);

  const rows = data ?? [];
  const totals = rows.reduce(
    (acc, row) => ({
      income: acc.income + row.income,
      expense: acc.expense + row.expense,
      count: acc.count + row.count,
    }),
    { income: 0, expense: 0, count: 0 }
  );
  const grouped = rows.filter((row) => row.id !== '');
  const rangeText = range.from || range.to ? formatRange(range, settings.dateFormat) : 'All time';

  return (
    <Screen safeBottom>
      <View style={styles.period}>
        <PeriodSelector value={preset} onChange={setPreset} />
        <Text variant="caption" color="textMuted">
          {rangeText}
        </Text>
      </View>

      <Card style={styles.summary}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text variant="micro" color="textMuted" uppercase>
              Earned
            </Text>
            <Amount value={totals.income} variant="subheading" weight="bold" color="income" />
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.summaryItem}>
            <Text variant="micro" color="textMuted" uppercase>
              Spent
            </Text>
            <Amount value={totals.expense} variant="subheading" weight="bold" color="expense" />
          </View>
        </View>
        <View style={[styles.net, { borderTopColor: colors.border }]}>
          <Text variant="caption" color="textSecondary">
            Net for the period
          </Text>
          <Amount
            value={totals.income - totals.expense}
            variant="subheading"
            weight="bold"
            signed
            colorize
          />
        </View>
        <Text variant="caption" color="textMuted" align="center">
          {grouped.length} group{grouped.length === 1 ? '' : 's'} active in{' '}
          {periodLabel(preset).toLowerCase()} · {totals.count} entr
          {totals.count === 1 ? 'y' : 'ies'} in total
        </Text>
      </Card>

      {isPending ? (
        <ListSkeleton rows={3} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon="albums-outline"
          title="Nothing recorded in this period"
          message="Group an entry while adding it, then come back to see how each group adds up."
          action={{
            label: 'Manage groups',
            icon: 'albums-outline',
            onPress: () => router.push('/manage/groups'),
          }}
        />
      ) : (
        <>
          <GroupBreakdown rows={rows} caption={rangeText} />

          <Section title="All groups" caption="Including entries with no group">
            <Card style={styles.table}>
              {rows.map((row) => (
                <View key={row.id || 'ungrouped'} style={styles.tableRow}>
                  <View style={[styles.swatch, { backgroundColor: row.color }]} />
                  <View style={styles.tableText}>
                    <Text variant="caption" weight="medium" numberOfLines={1}>
                      {row.name}
                    </Text>
                    <Text variant="micro" color="textMuted">
                      {formatAmount(row.income)} in · {formatAmount(row.expense)} out · {row.count}{' '}
                      entr{row.count === 1 ? 'y' : 'ies'}
                    </Text>
                  </View>
                  <Amount value={row.net} variant="caption" weight="semibold" signed colorize />
                </View>
              ))}
            </Card>
          </Section>

          <Button
            title="Manage groups"
            icon="albums-outline"
            variant="outline"
            onPress={() => router.push('/manage/groups')}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  period: {
    gap: spacing.sm,
  },
  summary: {
    gap: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  net: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.md,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
  },
  table: {
    gap: spacing.md,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  tableText: {
    flex: 1,
    gap: 1,
  },
});
