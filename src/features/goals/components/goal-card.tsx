import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { Icon, type IconName } from '@/components/ui/icon';
import { IconBadge } from '@/components/ui/icon-badge';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Text } from '@/components/ui/text';
import type { Goal } from '@/db/types';
import { useSettings } from '@/features/settings/settings-provider';
import { useTheme } from '@/theme/theme-provider';
import { radius, spacing, type ColorName } from '@/theme/tokens';

import { describeDeadline, goalProgress, type GoalPace } from '../progress';

export const PACE_TONE: Record<GoalPace, ColorName> = {
  reached: 'income',
  'on-track': 'primary',
  'no-deadline': 'textSecondary',
  behind: 'warning',
  'due-today': 'warning',
  overdue: 'expense',
};

const PACE_ICON: Record<GoalPace, IconName> = {
  reached: 'checkmark-circle',
  'on-track': 'trending-up',
  'no-deadline': 'infinite',
  behind: 'warning',
  'due-today': 'alarm',
  overdue: 'alert-circle',
};

export function GoalCard({ goal, onPress }: { goal: Goal; onPress: () => void }) {
  const { colors } = useTheme();
  const { formatAmount } = useSettings();
  const progress = goalProgress(goal);
  const completed = goal.status === 'completed';
  const tone: ColorName = completed ? 'income' : PACE_TONE[progress.pace];

  return (
    <PressableScale
      scaleTo={0.99}
      onPress={onPress}
      accessibilityLabel={`${goal.name}, ${progress.percent}% saved`}>
      <Card style={[styles.card, completed && styles.completed]}>
        <View style={styles.header}>
          <IconBadge icon={goal.icon} color={goal.color} size={40} />
          <View style={styles.titles}>
            <Text weight="semibold" numberOfLines={1}>
              {goal.name}
            </Text>
            <Text variant="caption" color="textMuted" numberOfLines={1}>
              {completed ? 'Completed' : describeDeadline(progress)}
            </Text>
          </View>
          <View style={[styles.pill, { backgroundColor: colors.surfaceMuted }]}>
            <Icon
              name={completed ? 'checkmark-circle' : PACE_ICON[progress.pace]}
              size={13}
              color={tone}
            />
            <Text variant="micro" weight="bold" color={tone} tabular>
              {progress.percent}%
            </Text>
          </View>
        </View>

        <ProgressBar value={progress.ratio} color={colors[tone]} height={8} />

        <View style={styles.footer}>
          <Text variant="caption" color="textSecondary" numberOfLines={1}>
            <Text variant="caption" weight="semibold" color={tone}>
              {formatAmount(goal.saved)}
            </Text>
            {` of ${formatAmount(goal.targetAmount)}`}
          </Text>
          {completed ? null : progress.reached ? (
            <Text variant="caption" weight="medium" color="income">
              Ready to complete
            </Text>
          ) : (
            <Text variant="caption" weight="medium" color="textSecondary" numberOfLines={1}>
              {formatAmount(progress.remaining)} to go
            </Text>
          )}
        </View>
      </Card>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  completed: {
    opacity: 0.75,
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
