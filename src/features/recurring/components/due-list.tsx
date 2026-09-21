import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Amount } from '@/components/ui/amount';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { confirm } from '@/components/ui/confirm';
import { IconBadge } from '@/components/ui/icon-badge';
import { Section } from '@/components/ui/section';
import { Text } from '@/components/ui/text';
import { useToast } from '@/components/ui/toast';
import type { RecurringOccurrence } from '@/db/types';
import { useSettings } from '@/features/settings/settings-provider';
import { daysBetween, todayISO } from '@/lib/date';
import { useTheme } from '@/theme/theme-provider';
import { radius, spacing } from '@/theme/tokens';

import { useSkipOccurrence } from '../hooks';

import { MarkPaidSheet } from './mark-paid-sheet';

function dueLabel(dueDate: string, today: string): { text: string; overdue: boolean } {
  if (dueDate === today) return { text: 'Due today', overdue: false };
  if (dueDate > today) {
    const days = daysBetween(today, dueDate);
    return { text: `Due in ${days} day${days === 1 ? '' : 's'}`, overdue: false };
  }
  const days = daysBetween(dueDate, today);
  return { text: `${days} day${days === 1 ? '' : 's'} overdue`, overdue: true };
}

function DueRow({
  occurrence,
  onMarkPaid,
}: {
  occurrence: RecurringOccurrence;
  onMarkPaid: () => void;
}) {
  const { colors } = useTheme();
  const { formatDate } = useSettings();
  const toast = useToast();
  const skip = useSkipOccurrence();
  const isIncome = occurrence.kind === 'income';
  const due = dueLabel(occurrence.dueDate, todayISO());

  const handleSkip = async () => {
    const ok = await confirm({
      title: `Skip ${occurrence.name}?`,
      message: `Nothing is recorded for ${formatDate(
        occurrence.dueDate
      )}. The schedule keeps running.`,
      confirmLabel: 'Skip it',
    });
    if (!ok) return;
    try {
      await skip.mutateAsync(occurrence.id);
      toast.show('Skipped');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not skip this entry');
    }
  };

  return (
    <Card style={styles.row}>
      <View style={styles.rowHead}>
        <IconBadge icon={occurrence.categoryIcon} color={occurrence.categoryColor} size={42} />
        <View style={styles.rowText}>
          <Text variant="callout" weight="semibold" numberOfLines={1}>
            {occurrence.name}
          </Text>
          <View style={styles.meta}>
            <View
              style={[
                styles.pill,
                { backgroundColor: due.overdue ? `${colors.expense}1A` : colors.surfaceMuted },
              ]}>
              <Text
                variant="micro"
                weight="semibold"
                color={due.overdue ? 'expense' : 'textSecondary'}>
                {due.text}
              </Text>
            </View>
            <Text variant="micro" color="textMuted" numberOfLines={1}>
              {formatDate(occurrence.dueDate)} · {occurrence.accountName}
            </Text>
          </View>
        </View>
        <Amount
          value={isIncome ? occurrence.amount : -occurrence.amount}
          variant="callout"
          weight="bold"
          signed
          colorize
        />
      </View>

      <View style={styles.actions}>
        <Button
          title={isIncome ? 'Mark received' : 'Mark paid'}
          icon="checkmark-done"
          size="sm"
          style={styles.flex}
          onPress={onMarkPaid}
        />
        <Button
          title="Skip"
          icon="close"
          size="sm"
          variant="outline"
          loading={skip.isPending}
          onPress={handleSkip}
        />
      </View>
    </Card>
  );
}

/** Manual occurrences waiting to be confirmed, oldest first. */
export function DueList({ occurrences }: { occurrences: RecurringOccurrence[] }) {
  const [selected, setSelected] = useState<RecurringOccurrence | null>(null);

  if (occurrences.length === 0) return null;

  const today = todayISO();
  const overdue = occurrences.filter((o) => o.dueDate < today).length;

  return (
    <Section
      title="Waiting for you"
      caption={
        overdue
          ? `${overdue} overdue of ${occurrences.length} to confirm`
          : `${occurrences.length} to confirm`
      }>
      <View style={styles.list}>
        {occurrences.map((occurrence) => (
          <DueRow
            key={occurrence.id}
            occurrence={occurrence}
            onMarkPaid={() => setSelected(occurrence)}
          />
        ))}
      </View>
      <MarkPaidSheet
        occurrence={selected}
        visible={selected !== null}
        onClose={() => setSelected(null)}
      />
    </Section>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.md,
  },
  row: {
    gap: spacing.md,
  },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowText: {
    flex: 1,
    gap: spacing.xs,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  flex: {
    flex: 1,
  },
});
