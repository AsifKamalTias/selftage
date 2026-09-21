import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { CardActions } from '@/components/ui/card-actions';
import { confirm } from '@/components/ui/confirm';
import { Icon, type IconName } from '@/components/ui/icon';
import { IconBadge } from '@/components/ui/icon-badge';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Text } from '@/components/ui/text';
import { useToast } from '@/components/ui/toast';
import type { BudgetHealth, BudgetStatus } from '@/db/types';
import { useDeleteBudget, useToggleBudget } from '@/features/budgets/hooks';
import { useSettings } from '@/features/settings/settings-provider';
import { useTheme } from '@/theme/theme-provider';
import { radius, spacing, type ColorName } from '@/theme/tokens';

import { BUDGET_PERIOD_LABELS, dailyAllowance } from '../period';

export const HEALTH_COLOR: Record<BudgetHealth, ColorName> = {
  ok: 'income',
  warning: 'warning',
  exceeded: 'expense',
};

const HEALTH_ICON: Record<BudgetHealth, IconName> = {
  ok: 'checkmark-circle',
  warning: 'warning',
  exceeded: 'alert-circle',
};

const HEALTH_LABEL: Record<BudgetHealth, string> = {
  ok: 'On track',
  warning: 'Close to limit',
  exceeded: 'Over limit',
};

export function BudgetProgressCard({
  status,
  onPress,
  onEdit,
  compact = false,
}: {
  status: BudgetStatus;
  onPress?: () => void;
  /** Shows pause, edit and delete actions on the card when provided. */
  onEdit?: (status: BudgetStatus) => void;
  /** Hides the per-day hint, for dense lists such as the dashboard. */
  compact?: boolean;
}) {
  const { colors } = useTheme();
  const { formatAmount } = useSettings();
  const toast = useToast();
  const toggle = useToggleBudget();
  const remove = useDeleteBudget();
  const tone = HEALTH_COLOR[status.health];
  const tint = colors[tone];
  const perDay = dailyAllowance(status.remaining, status.daysLeft);
  const percent = Math.round(status.progress * 100);

  return (
    <Card style={[styles.card, !status.isActive && styles.paused]}>
      <PressableScale scaleTo={0.99} style={styles.body} onPress={onPress} disabled={!onPress}>
        <View style={styles.header}>
          <IconBadge
            icon={status.categoryIcon ?? 'pie-chart'}
            color={status.categoryColor ?? colors.primary}
            size={38}
          />
          <View style={styles.titles}>
            <Text weight="semibold" numberOfLines={1}>
              {status.categoryName ?? 'Overall spending'}
            </Text>
            <Text variant="caption" color="textMuted" numberOfLines={1}>
              {BUDGET_PERIOD_LABELS[status.period]}
              {status.isActive ? '' : ' · paused'}
            </Text>
          </View>
          <View style={[styles.pill, { backgroundColor: colors.surfaceMuted }]}>
            <Icon name={HEALTH_ICON[status.health]} size={13} color={tint} />
            <Text variant="micro" weight="bold" color={tone} tabular>
              {percent}%
            </Text>
          </View>
        </View>

        <ProgressBar value={status.progress} color={tint} height={8} />

        <View style={styles.footer}>
          <Text variant="caption" color="textSecondary" numberOfLines={1}>
            <Text variant="caption" weight="semibold" color={tone}>
              {formatAmount(status.spent)}
            </Text>
            {` of ${formatAmount(status.amount)}`}
          </Text>
          <Text variant="caption" weight="medium" color={tone} numberOfLines={1}>
            {status.remaining >= 0
              ? `${formatAmount(status.remaining)} left`
              : `${formatAmount(Math.abs(status.remaining))} over`}
          </Text>
        </View>
      </PressableScale>

      {onEdit ? (
        <CardActions
          actions={[
            {
              key: 'toggle',
              label: status.isActive ? 'Pause' : 'Resume',
              icon: status.isActive ? 'pause-outline' : 'play-outline',
              loading: toggle.isPending,
              onPress: async () => {
                try {
                  await toggle.mutateAsync({ id: status.id, isActive: !status.isActive });
                  toast.show(status.isActive ? 'Budget paused' : 'Budget resumed');
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : 'Could not update the budget');
                }
              },
            },
            { key: 'edit', label: 'Edit', icon: 'create-outline', onPress: () => onEdit(status) },
            {
              key: 'delete',
              label: 'Delete',
              icon: 'trash-outline',
              destructive: true,
              loading: remove.isPending,
              onPress: async () => {
                const ok = await confirm({
                  title: `Delete this ${BUDGET_PERIOD_LABELS[status.period].toLowerCase()} budget?`,
                  message: 'Your transactions are untouched; only the limit is removed.',
                });
                if (!ok) return;
                try {
                  await remove.mutateAsync(status.id);
                  toast.success('Budget deleted');
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : 'Could not delete the budget');
                }
              },
            },
          ]}
        />
      ) : null}

      {compact ? null : (
        <Text variant="micro" color="textMuted">
          {HEALTH_LABEL[status.health]} ·{' '}
          {status.daysLeft > 0
            ? `${status.daysLeft} day${status.daysLeft === 1 ? '' : 's'} left`
            : 'period ends today'}
          {perDay > 0 ? ` · ${formatAmount(perDay)}/day available` : ''}
        </Text>
      )}
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
    opacity: 0.6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  titles: {
    flex: 1,
    gap: 1,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
});
