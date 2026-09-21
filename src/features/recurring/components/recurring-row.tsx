import { StyleSheet, View } from 'react-native';

import { Amount } from '@/components/ui/amount';
import { Card } from '@/components/ui/card';
import { CardActions } from '@/components/ui/card-actions';
import { confirm } from '@/components/ui/confirm';
import { Icon } from '@/components/ui/icon';
import { IconBadge } from '@/components/ui/icon-badge';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { useToast } from '@/components/ui/toast';
import type { RecurringRule } from '@/db/types';
import { useDeleteRecurringRule, useToggleRecurringRule } from '@/features/recurring/hooks';
import { useSettings } from '@/features/settings/settings-provider';
import { countOf } from '@/lib/text';
import { todayISO } from '@/lib/date';
import { useTheme } from '@/theme/theme-provider';
import { radius, spacing } from '@/theme/tokens';

import { describeNextRun, describeRecurrence } from '../schedule';

export function RecurringRow({
  rule,
  onPress,
  showActions = false,
}: {
  rule: RecurringRule;
  onPress: () => void;
  /** Shows pause, edit and delete along the bottom of the card. */
  showActions?: boolean;
}) {
  const { colors } = useTheme();
  const { settings } = useSettings();
  const toast = useToast();
  const toggle = useToggleRecurringRule();
  const remove = useDeleteRecurringRule();
  const today = todayISO();
  const overdue = rule.isActive && rule.nextDate <= today;

  return (
    <Card style={[styles.card, !rule.isActive && styles.paused]}>
      <PressableScale
        scaleTo={0.99}
        style={styles.body}
        onPress={onPress}
        accessibilityLabel={`Edit ${rule.name}`}
        accessibilityHint={describeRecurrence(rule.frequency, rule.intervalCount, rule.startDate)}>
        <View style={styles.header}>
          <IconBadge icon={rule.categoryIcon} color={rule.categoryColor} size={40} />
          <View style={styles.titles}>
            <Text weight="semibold" numberOfLines={1}>
              {rule.name}
            </Text>
            <View style={styles.subtitle}>
              <Text variant="caption" color="textMuted" numberOfLines={1} style={styles.flex}>
                {describeRecurrence(rule.frequency, rule.intervalCount, rule.startDate)}
              </Text>
              {rule.mode === 'manual' ? (
                <View style={[styles.mode, { backgroundColor: colors.surfaceMuted }]}>
                  <Icon name="hand-left" size={10} color="textSecondary" />
                  <Text variant="micro" weight="semibold" color="textSecondary">
                    Manual
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
          <Amount value={rule.amount} kind={rule.kind} signed colorize />
        </View>

        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <View style={styles.meta}>
            <Icon
              name={rule.isActive ? (overdue ? 'time' : 'calendar-outline') : 'pause-circle'}
              size={14}
              color={rule.isActive ? (overdue ? 'warning' : 'textMuted') : 'textMuted'}
            />
            <Text
              variant="caption"
              color={rule.isActive ? (overdue ? 'warning' : 'textSecondary') : 'textMuted'}
              numberOfLines={1}>
              {rule.isActive
                ? describeNextRun(rule.nextDate, today, settings.dateFormat)
                : 'Paused'}
            </Text>
          </View>
          <View style={[styles.tag, { backgroundColor: colors.surfaceMuted }]}>
            <Text variant="micro" color="textSecondary" numberOfLines={1}>
              {rule.categoryName} · {rule.accountName}
            </Text>
          </View>
        </View>

        {rule.pendingCount ? (
          <Text variant="micro" color="warning" weight="semibold">
            {rule.pendingCount} waiting to be marked {rule.kind === 'income' ? 'received' : 'paid'}
          </Text>
        ) : rule.postedCount ? (
          <Text variant="micro" color="textMuted">
            {countOf(rule.postedCount, 'entry')} posted so far
          </Text>
        ) : null}
      </PressableScale>

      {showActions ? (
        <CardActions
          actions={[
            {
              key: 'toggle',
              label: rule.isActive ? 'Pause' : 'Resume',
              icon: rule.isActive ? 'pause-outline' : 'play-outline',
              loading: toggle.isPending,
              onPress: async () => {
                try {
                  await toggle.mutateAsync({ id: rule.id, isActive: !rule.isActive });
                  toast.show(rule.isActive ? 'Recurring paused' : 'Recurring resumed');
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : 'Could not update this recurring');
                }
              },
            },
            { key: 'edit', label: 'Edit', icon: 'create-outline', onPress },
            {
              key: 'delete',
              label: 'Delete',
              icon: 'trash-outline',
              destructive: true,
              loading: remove.isPending,
              onPress: async () => {
                const ok = await confirm({
                  title: `Delete ${rule.name}?`,
                  message: rule.postedCount
                    ? `The ${rule.postedCount} transaction${
                        rule.postedCount === 1 ? '' : 's'
                      } already posted stay in your history; only the schedule is removed.`
                    : 'The schedule will be removed. Nothing else changes.',
                });
                if (!ok) return;
                try {
                  await remove.mutateAsync(rule.id);
                  toast.success('Recurring deleted');
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : 'Could not delete this recurring');
                }
              },
            },
          ]}
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  body: {
    gap: spacing.md,
  },
  paused: {
    opacity: 0.65,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  titles: {
    flex: 1,
    gap: 2,
  },
  subtitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  flex: {
    flexShrink: 1,
  },
  mode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 1,
    borderRadius: radius.pill,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.md,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    flexShrink: 1,
  },
  tag: {
    maxWidth: '55%',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
});
