import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Amount } from '@/components/ui/amount';
import { Button, IconButton } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { ListSkeleton } from '@/components/ui/loader';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Text } from '@/components/ui/text';
import type { Obligation, ObligationDirection } from '@/db/types';
import { ObligationCard } from '@/features/outstanding/components/obligation-card';
import { SettleSheet } from '@/features/outstanding/components/settle-sheet';
import { useObligations, useOutstandingSummary } from '@/features/outstanding/hooks';
import { todayISO } from '@/lib/date';
import { useTheme } from '@/theme/theme-provider';
import { spacing } from '@/theme/tokens';

type Tab = 'all' | ObligationDirection;

export default function OutstandingScreen() {
  const { colors } = useTheme();
  const [tab, setTab] = useState<Tab>('all');
  const [settling, setSettling] = useState<Obligation | null>(null);
  const summary = useOutstandingSummary();
  const { data, isPending } = useObligations({
    direction: tab === 'all' ? undefined : tab,
  });

  const items = data ?? [];
  const open = items.filter((item) => !item.isSettled);
  const settled = items.filter((item) => item.isSettled);
  const today = todayISO();
  const overdue = open.filter((item) => item.dueDate && item.dueDate < today);
  const upcoming = open.filter((item) => !item.dueDate || item.dueDate >= today);
  const totals = summary.data;

  return (
    <Screen safeBottom>
      <Stack.Screen
        options={{
          headerRight: () => (
            <IconButton
              icon="add"
              variant="plain"
              accessibilityLabel="Add outstanding record"
              onPress={() => router.push('/outstanding/form')}
            />
          ),
        }}
      />

      <Card style={styles.summary}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text variant="micro" color="textMuted" uppercase>
              Owed to you
            </Text>
            <Amount
              value={totals?.receivable ?? 0}
              variant="subheading"
              weight="bold"
              color="income"
            />
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.summaryItem}>
            <Text variant="micro" color="textMuted" uppercase>
              You owe
            </Text>
            <Amount
              value={totals?.payable ?? 0}
              variant="subheading"
              weight="bold"
              color="expense"
            />
          </View>
        </View>
        <View style={[styles.net, { borderTopColor: colors.border }]}>
          <Text variant="caption" color="textSecondary">
            Net position
          </Text>
          <Amount value={totals?.net ?? 0} variant="subheading" weight="bold" signed colorize />
        </View>
        {totals?.overdueCount ? (
          <View style={styles.overdue}>
            <Icon name="alert-circle" size={14} color="expense" />
            <Text variant="caption" color="expense" weight="semibold">
              {totals.overdueCount} overdue
            </Text>
          </View>
        ) : null}
      </Card>

      <View style={styles.actions}>
        <Button
          title="Add record"
          icon="add"
          style={styles.flex}
          onPress={() => router.push('/outstanding/form')}
        />
        <Button
          title="Contacts"
          icon="people-outline"
          variant="outline"
          style={styles.flex}
          onPress={() => router.push('/contacts')}
        />
      </View>

      <SegmentedControl
        value={tab}
        onChange={setTab}
        options={[
          { value: 'all', label: 'All' },
          {
            value: 'receivable',
            label: 'To receive',
            icon: 'arrow-down',
            activeColor: colors.income,
          },
          { value: 'payable', label: 'To pay', icon: 'arrow-up', activeColor: colors.expense },
        ]}
      />

      {isPending ? (
        <ListSkeleton rows={3} />
      ) : items.length === 0 ? (
        <EmptyState
          icon="reader-outline"
          title="Nothing outstanding"
          message="Record what someone owes you, or what you owe them, and settle it in one go or by installments."
          action={{
            label: 'Add a record',
            icon: 'add',
            onPress: () => router.push('/outstanding/form'),
          }}
        />
      ) : (
        <>
          {overdue.length > 0 ? (
            <Section title="Overdue" caption="Past the due date and still open">
              <View style={styles.list}>
                {overdue.map((item) => (
                  <ObligationCard key={item.id} obligation={item} onSettle={setSettling} />
                ))}
              </View>
            </Section>
          ) : null}

          {upcoming.length > 0 ? (
            <Section title="Open" caption="Still to settle">
              <View style={styles.list}>
                {upcoming.map((item) => (
                  <ObligationCard key={item.id} obligation={item} onSettle={setSettling} />
                ))}
              </View>
            </Section>
          ) : null}

          {settled.length > 0 ? (
            <Section title="Settled" caption="Paid in full">
              <View style={styles.list}>
                {settled.map((item) => (
                  <ObligationCard key={item.id} obligation={item} onSettle={setSettling} />
                ))}
              </View>
            </Section>
          ) : null}
        </>
      )}
      {settling ? (
        <SettleSheet obligation={settling} visible onClose={() => setSettling(null)} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  divider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
  },
  net: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.md,
  },
  overdue: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  list: {
    gap: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  flex: {
    flex: 1,
  },
});
