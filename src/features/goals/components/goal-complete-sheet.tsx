import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Amount } from '@/components/ui/amount';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DateField } from '@/components/ui/date-field';
import { Icon } from '@/components/ui/icon';
import { SelectField } from '@/components/ui/select-field';
import { Text } from '@/components/ui/text';
import { useToast } from '@/components/ui/toast';
import type { Goal } from '@/db/types';
import { useCatalog } from '@/features/catalog/hooks';
import { useSettings } from '@/features/settings/settings-provider';
import { todayISO } from '@/lib/date';
import { useTheme } from '@/theme/theme-provider';
import { spacing } from '@/theme/tokens';

import { useCompleteGoal } from '../hooks';

/**
 * Completing spends the whole reserve: one expense per contributing account, so the
 * money finally leaves the balances and lands in the ledger.
 */
export function GoalCompleteSheet({
  goal,
  visible,
  onClose,
  breakdown,
  onCompleted,
}: {
  goal: Goal;
  visible: boolean;
  onClose: () => void;
  /** Accounts holding money for this goal, with the amount each will spend. */
  breakdown: { accountId: string; accountName: string; amount: number }[];
  onCompleted: () => void;
}) {
  const { colors } = useTheme();
  const { formatAmount } = useSettings();
  const toast = useToast();
  const categories = useCatalog('categories', 'expense');
  const sources = useCatalog('sources', 'expense');
  const complete = useCompleteGoal();

  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(todayISO());
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!categoryId) {
      setError('Choose the expense type to record this under');
      return;
    }
    try {
      const result = await complete.mutateAsync({
        goalId: goal.id,
        categoryId,
        sourceId,
        date: date ?? todayISO(),
      });
      toast.success(`${goal.name} completed · ${formatAmount(result.total)} spent`);
      onClose();
      onCompleted();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not complete the goal');
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Complete this goal"
      maxHeight={0.9}
      footer={
        <Button
          title="Spend reserve & complete"
          icon="checkmark-done"
          loading={complete.isPending}
          onPress={submit}
        />
      }>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card muted elevated={false} style={styles.summary}>
          <Text variant="caption" color="textSecondary">
            The money held for this goal is spent now and recorded as an expense.
          </Text>
          {breakdown.map((row) => (
            <View key={row.accountId} style={styles.row}>
              <Icon name="arrow-forward" size={14} color="expense" />
              <Text variant="caption" style={styles.rowText} numberOfLines={1}>
                {row.accountName}
              </Text>
              <Amount value={row.amount} variant="caption" weight="semibold" color="expense" />
            </View>
          ))}
          <View style={[styles.total, { borderTopColor: colors.border }]}>
            <Text variant="callout" weight="semibold">
              Total
            </Text>
            <Amount value={goal.saved} variant="subheading" weight="bold" color="expense" />
          </View>
        </Card>

        <SelectField
          label="Record as expense type"
          placeholder="Choose a type"
          value={categoryId}
          options={(categories.data ?? []).map((category) => ({
            value: category.id,
            label: category.name,
            icon: category.icon,
            color: category.color,
          }))}
          onChange={(value) => {
            setCategoryId(value);
            setError(null);
          }}
          error={error}
        />

        <SelectField
          label="Paid to"
          placeholder="Choose a source (optional)"
          value={sourceId}
          options={(sources.data ?? []).map((source) => ({
            value: source.id,
            label: source.name,
            icon: source.icon,
            color: source.color,
          }))}
          onChange={setSourceId}
          clearable
        />

        <DateField label="Spent on" value={date} onChange={setDate} shortcuts />

        <Text variant="caption" color="textMuted">
          Spending less than you saved? Release the difference first, then complete.
        </Text>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  summary: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowText: {
    flex: 1,
  },
  total: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm,
  },
});
