import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Amount } from '@/components/ui/amount';
import { Button, IconButton } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { IconBadge } from '@/components/ui/icon-badge';
import { ListSkeleton } from '@/components/ui/loader';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { Text } from '@/components/ui/text';
import { BudgetProgressCard } from '@/features/budgets/components/budget-progress-card';
import { MonthGrid } from '@/features/calendar/components/month-grid';
import { useDayReport, useMonthTotals } from '@/features/calendar/hooks';
import type { ScheduledEntry } from '@/features/calendar/repository';
import { DueList } from '@/features/recurring/components/due-list';
import { useSettings } from '@/features/settings/settings-provider';
import { TransactionRow } from '@/features/transactions/components/transaction-row';
import {
  addDays,
  addMonths,
  endOfMonth,
  formatDate,
  parseISODate,
  startOfMonth,
  toISODate,
  todayISO,
} from '@/lib/date';
import { useTheme } from '@/theme/theme-provider';
import { spacing } from '@/theme/tokens';

function DayHeading({ date }: { date: string }) {
  const { settings } = useSettings();
  const today = todayISO();
  const day = parseISODate(date);
  const yesterday = toISODate(addDays(parseISODate(today), -1));
  const relative =
    date === today
      ? 'Today'
      : date === yesterday
        ? 'Yesterday'
        : day.toLocaleDateString(undefined, { weekday: 'long' });

  return (
    <View style={styles.dayHeading}>
      <Text variant="subheading" weight="bold">
        {relative}
      </Text>
      <Text variant="caption" color="textMuted">
        {formatDate(date, settings.dateFormat)}
      </Text>
    </View>
  );
}

function ScheduledRow({ entry }: { entry: ScheduledEntry }) {
  return (
    <View style={styles.scheduledRow}>
      <IconBadge icon={entry.categoryIcon} color={entry.categoryColor} size={36} />
      <View style={styles.scheduledText}>
        <Text variant="callout" weight="medium" numberOfLines={1}>
          {entry.name}
        </Text>
        <Text variant="micro" color="textMuted" numberOfLines={1}>
          {entry.categoryName} · {entry.accountName} ·{' '}
          {entry.mode === 'manual' ? 'you confirm it' : 'posts itself'}
        </Text>
      </View>
      <Amount
        value={entry.kind === 'income' ? entry.amount : -entry.amount}
        variant="callout"
        weight="semibold"
        signed
        colorize
      />
      <Icon name="time-outline" size={14} color="textMuted" />
    </View>
  );
}

export default function CalendarScreen() {
  const { colors } = useTheme();
  const { settings } = useSettings();
  const [selected, setSelected] = useState(todayISO());
  const [monthStart, setMonthStart] = useState(() => startOfMonth(new Date()));

  const range = {
    from: toISODate(startOfMonth(monthStart)),
    to: toISODate(endOfMonth(monthStart)),
  };
  const month = useMonthTotals(range);
  const day = useDayReport(selected);
  const report = day.data;

  const changeMonth = (delta: number) => {
    const next = startOfMonth(addMonths(monthStart, delta));
    setMonthStart(next);
    // Keep a selection inside the month on view: the 1st, or today for the current month.
    const today = todayISO();
    const first = toISODate(next);
    const last = toISODate(endOfMonth(next));
    if (selected < first || selected > last) {
      setSelected(today >= first && today <= last ? today : first);
    }
  };

  const jumpToToday = () => {
    setMonthStart(startOfMonth(new Date()));
    setSelected(todayISO());
  };

  const monthIncome = (month.data ?? []).reduce((sum, d) => sum + d.income, 0);
  const monthExpense = (month.data ?? []).reduce((sum, d) => sum + d.expense, 0);

  return (
    <Screen safeBottom>
      <Stack.Screen
        options={{
          headerRight: () => (
            <IconButton
              icon="today-outline"
              variant="plain"
              accessibilityLabel="Jump to today"
              onPress={jumpToToday}
            />
          ),
        }}
      />

      <MonthGrid
        monthStart={monthStart}
        days={month.data ?? []}
        selected={selected}
        weekStartsOn={settings.weekStartsOn}
        onSelect={setSelected}
        onChangeMonth={changeMonth}
      />

      <Card muted elevated={false} style={styles.monthTotals}>
        <View style={styles.monthItem}>
          <Text variant="micro" color="textMuted" uppercase>
            Month in
          </Text>
          <Amount value={monthIncome} variant="callout" weight="bold" color="income" />
        </View>
        <View style={[styles.monthDivider, { backgroundColor: colors.border }]} />
        <View style={styles.monthItem}>
          <Text variant="micro" color="textMuted" uppercase>
            Month out
          </Text>
          <Amount value={monthExpense} variant="callout" weight="bold" color="expense" />
        </View>
        <View style={[styles.monthDivider, { backgroundColor: colors.border }]} />
        <View style={styles.monthItem}>
          <Text variant="micro" color="textMuted" uppercase>
            Net
          </Text>
          <Amount
            value={monthIncome - monthExpense}
            variant="callout"
            weight="bold"
            signed
            colorize
          />
        </View>
      </Card>

      <DayHeading date={selected} />

      {day.isPending || !report ? (
        <ListSkeleton rows={3} />
      ) : (
        <Animated.View key={selected} entering={FadeIn.duration(220)} style={styles.day}>
          <Card style={styles.totals}>
            <View style={styles.totalsRow}>
              <View style={styles.total}>
                <Text variant="micro" color="textMuted" uppercase>
                  Income
                </Text>
                <Amount value={report.income} variant="subheading" weight="bold" color="income" />
              </View>
              <View style={[styles.monthDivider, { backgroundColor: colors.border }]} />
              <View style={styles.total}>
                <Text variant="micro" color="textMuted" uppercase>
                  Expense
                </Text>
                <Amount value={report.expense} variant="subheading" weight="bold" color="expense" />
              </View>
            </View>
            <View style={[styles.net, { borderTopColor: colors.border }]}>
              <Text variant="caption" color="textSecondary">
                Net · {report.count} entr{report.count === 1 ? 'y' : 'ies'}
              </Text>
              <Amount value={report.net} variant="subheading" weight="bold" signed colorize />
            </View>
          </Card>

          <View style={styles.actions}>
            <Button
              title="Add expense"
              icon="arrow-up"
              variant="secondary"
              style={styles.flex}
              onPress={() =>
                router.push({
                  pathname: '/transaction/new',
                  params: { kind: 'expense', date: selected },
                })
              }
            />
            <Button
              title="Add income"
              icon="arrow-down"
              variant="secondary"
              style={styles.flex}
              onPress={() =>
                router.push({
                  pathname: '/transaction/new',
                  params: { kind: 'income', date: selected },
                })
              }
            />
          </View>

          {report.pending.length > 0 ? <DueList occurrences={report.pending} /> : null}

          {report.scheduled.length > 0 ? (
            <Section title="Recurring on this day" caption={`${report.scheduled.length} scheduled`}>
              <Card style={styles.scheduled}>
                {report.scheduled.map((entry) => (
                  <ScheduledRow key={entry.ruleId} entry={entry} />
                ))}
              </Card>
            </Section>
          ) : null}

          {report.budgets.length > 0 ? (
            <Section title="Budgets" caption="Windows that cover this day">
              <View style={styles.budgets}>
                {report.budgets.map((status) => (
                  <BudgetProgressCard
                    key={status.id}
                    status={status}
                    compact
                    onPress={() =>
                      router.push({ pathname: '/budgets/form', params: { id: status.id } })
                    }
                  />
                ))}
              </View>
            </Section>
          ) : null}

          <Section
            title="Entries"
            caption={report.count ? `${report.count} on this day` : undefined}>
            {report.transactions.length > 0 ? (
              <Card padded={false} style={styles.list}>
                {report.transactions.map((item) => (
                  <TransactionRow key={item.id} item={item} />
                ))}
              </Card>
            ) : (
              <Card padded={false}>
                <EmptyState
                  compact
                  icon="calendar-outline"
                  title="Nothing recorded"
                  message="Add an income or expense to this day with the buttons above."
                />
              </Card>
            )}
          </Section>
        </Animated.View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  monthTotals: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  monthItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  monthDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
  },
  dayHeading: {
    gap: 2,
  },
  day: {
    gap: spacing.xxl,
  },
  totals: {
    gap: spacing.md,
  },
  totalsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  total: {
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
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  flex: {
    flex: 1,
  },
  scheduled: {
    gap: spacing.md,
  },
  scheduledRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  scheduledText: {
    flex: 1,
    gap: 1,
  },
  budgets: {
    gap: spacing.md,
  },
  list: {
    overflow: 'hidden',
  },
});
