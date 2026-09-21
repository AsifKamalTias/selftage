import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { countOf } from '@/lib/text';

import { DonutChart } from '@/components/charts/donut-chart';
import { Amount } from '@/components/ui/amount';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { IconBadge } from '@/components/ui/icon-badge';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Section } from '@/components/ui/section';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Text } from '@/components/ui/text';
import type { EntryKind, GroupTotals } from '@/db/types';
import { useSettings } from '@/features/settings/settings-provider';
import { useTheme } from '@/theme/theme-provider';
import { spacing } from '@/theme/tokens';

/** The report's "Ungrouped" bucket has an empty id and no group screen to open. */
const isUngrouped = (row: GroupTotals) => row.id === '';

function GroupRow({ row, kind }: { row: GroupTotals; kind: EntryKind }) {
  const value = kind === 'expense' ? row.expense : row.income;

  return (
    <PressableScale
      onPress={() => router.push({ pathname: '/transactions', params: { groupId: row.id } })}
      accessibilityLabel={`${row.name}, ${row.count} entries`}
      accessibilityHint="Opens the entries in this group">
      <View style={styles.row}>
        <IconBadge icon={row.icon} color={row.color} size={38} />
        <View style={styles.rowText}>
          <Text variant="callout" weight="medium" numberOfLines={1}>
            {row.name}
          </Text>
          <Text variant="micro" color="textMuted" numberOfLines={1}>
            {countOf(row.count, 'entry')}
          </Text>
        </View>
        <View style={styles.rowValues}>
          <Amount value={value} variant="callout" weight="semibold" />
          <Amount value={row.net} variant="micro" signed colorize />
        </View>
      </View>
    </PressableScale>
  );
}

/**
 * Group-wise totals as a donut plus a table. Used on the dashboard and in the
 * group report; both take the same period-scoped rows.
 */
export function GroupBreakdown({
  rows,
  title = 'Groups',
  caption = 'What each trip, project or event adds up to',
}: {
  rows: GroupTotals[];
  title?: string;
  caption?: string;
}) {
  const { formatAmount } = useSettings();
  const [kind, setKind] = useState<EntryKind>('expense');
  const { colors } = useTheme();

  const withValue = rows.filter((row) => (kind === 'expense' ? row.expense : row.income) > 0);
  const named = rows.filter((row) => !isUngrouped(row));

  return (
    <Section title={title} caption={caption}>
      <Card style={styles.card}>
        <SegmentedControl
          value={kind}
          onChange={setKind}
          options={[
            { value: 'expense', label: 'Spent', icon: 'arrow-up', activeColor: colors.expense },
            { value: 'income', label: 'Earned', icon: 'arrow-down', activeColor: colors.income },
          ]}
        />

        {named.length === 0 ? (
          <EmptyState
            compact
            icon="albums-outline"
            title="Nothing grouped yet"
            message="Pick a group while adding an entry to see it reported here."
          />
        ) : withValue.length === 0 ? (
          <EmptyState
            compact
            icon="pie-chart-outline"
            title={`No ${kind === 'expense' ? 'spending' : 'income'} in a group`}
            message="Try the other tab, or widen the period."
          />
        ) : (
          <>
            <View style={styles.donut}>
              <DonutChart
                key={kind}
                centerLabel={kind === 'expense' ? 'Total spent' : 'Total earned'}
                formatValue={formatAmount}
                data={withValue.map((row) => ({
                  key: row.id || 'ungrouped',
                  label: row.name,
                  value: kind === 'expense' ? row.expense : row.income,
                  color: row.color,
                  detail: countOf(row.count, 'entry'),
                }))}
              />
            </View>
            <View style={styles.list}>
              {withValue.map((row) => (
                <GroupRow key={row.id || 'ungrouped'} row={row} kind={kind} />
              ))}
            </View>
          </>
        )}
      </Card>
    </Section>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.lg,
  },
  donut: {
    alignItems: 'center',
  },
  list: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowText: {
    flex: 1,
    gap: 1,
  },
  rowValues: {
    alignItems: 'flex-end',
    gap: 1,
  },
});
