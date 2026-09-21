import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BarChart } from '@/components/charts/bar-chart';
import { DonutChart } from '@/components/charts/donut-chart';
import { LineChart } from '@/components/charts/line-chart';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Section } from '@/components/ui/section';
import { SegmentedControl } from '@/components/ui/segmented-control';
import type { EntryKind } from '@/db/types';
import { useSettings } from '@/features/settings/settings-provider';
import { countOf } from '@/lib/text';
import { MONTHS_LONG, parseISODate } from '@/lib/date';
import { formatMoney } from '@/lib/money';
import { useTheme } from '@/theme/theme-provider';
import { spacing } from '@/theme/tokens';

import type { Bucket, CumulativePoint, Granularity } from '../buckets';
import type { BreakdownItem } from '../repository';

const GRANULARITY_CAPTION: Record<Granularity, string> = {
  day: 'Daily',
  week: 'Weekly',
  month: 'Monthly',
  year: 'Yearly',
};

function useChartFormatters() {
  const { currency, formatAmount } = useSettings();
  return {
    formatAxis: (value: number) => formatMoney(value, currency, { compact: true, plain: true }),
    formatValue: (value: number) => formatAmount(value),
  };
}

export function CashFlowCard({
  buckets,
  granularity,
}: {
  buckets: Bucket[];
  granularity: Granularity;
}) {
  const { colors } = useTheme();
  const { formatDate } = useSettings();
  const formatters = useChartFormatters();

  const bucketTitle = (b: Bucket) => {
    if (granularity === 'day') return formatDate(b.from);
    if (granularity === 'week') return `${formatDate(b.from)} – ${formatDate(b.to)}`;
    const date = parseISODate(b.from);
    if (granularity === 'month') return `${MONTHS_LONG[date.getMonth()]} ${date.getFullYear()}`;
    return String(date.getFullYear());
  };

  return (
    <Section title="Cash flow" caption={`${GRANULARITY_CAPTION[granularity]} income vs expense`}>
      <Card>
        <BarChart
          data={buckets.map((b) => ({
            label: b.label,
            title: bucketTitle(b),
            values: [b.income, b.expense],
          }))}
          series={[
            { key: 'income', label: 'Income', color: colors.income },
            { key: 'expense', label: 'Expense', color: colors.expense },
          ]}
          {...formatters}
        />
      </Card>
    </Section>
  );
}

export function TrendCard({ points }: { points: CumulativePoint[] }) {
  const { colors } = useTheme();
  const formatters = useChartFormatters();
  return (
    <Section title="Running totals" caption="How income and spending add up over the period">
      <Card>
        <LineChart
          labels={points.map((p) => p.label)}
          series={[
            {
              key: 'income',
              label: 'Income',
              color: colors.income,
              values: points.map((p) => p.income),
            },
            {
              key: 'expense',
              label: 'Expense',
              color: colors.expense,
              values: points.map((p) => p.expense),
            },
          ]}
          {...formatters}
        />
      </Card>
    </Section>
  );
}

type Dimension = 'type' | 'source';

export function BreakdownCard({
  expenseByCategory,
  incomeByCategory,
  expenseBySource,
  incomeBySource,
}: {
  expenseByCategory: BreakdownItem[];
  incomeByCategory: BreakdownItem[];
  expenseBySource: BreakdownItem[];
  incomeBySource: BreakdownItem[];
}) {
  const { colors } = useTheme();
  const { formatValue } = useChartFormatters();
  const [kind, setKind] = useState<EntryKind>('expense');
  const [dimension, setDimension] = useState<Dimension>('type');

  const items =
    dimension === 'type'
      ? kind === 'expense'
        ? expenseByCategory
        : incomeByCategory
      : kind === 'expense'
        ? expenseBySource
        : incomeBySource;

  return (
    <Section title="Breakdown" caption="Where your money comes from and goes">
      <Card style={styles.breakdown}>
        <SegmentedControl
          value={kind}
          onChange={setKind}
          options={[
            { value: 'expense', label: 'Expense', icon: 'arrow-up', activeColor: colors.expense },
            { value: 'income', label: 'Income', icon: 'arrow-down', activeColor: colors.income },
          ]}
        />
        <SegmentedControl
          size="sm"
          value={dimension}
          onChange={setDimension}
          options={[
            { value: 'type', label: 'By type' },
            { value: 'source', label: 'By source' },
          ]}
        />
        {items.length === 0 ? (
          <EmptyState
            compact
            icon="pie-chart-outline"
            title={`No ${kind} yet`}
            message="Add transactions to see the breakdown for this period."
          />
        ) : (
          <View style={styles.donut}>
            <DonutChart
              key={`${kind}-${dimension}`}
              centerLabel={kind === 'expense' ? 'Total spent' : 'Total earned'}
              formatValue={formatValue}
              data={items.map((item) => ({
                key: item.id ?? `none-${item.name}`,
                label: item.name,
                value: item.total,
                color: item.color,
                detail: countOf(item.count, 'transaction'),
              }))}
            />
          </View>
        )}
      </Card>
    </Section>
  );
}

const styles = StyleSheet.create({
  breakdown: {
    gap: spacing.md,
  },
  donut: {
    paddingTop: spacing.md,
  },
});
