import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Amount } from '@/components/ui/amount';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { IconBadge } from '@/components/ui/icon-badge';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Section } from '@/components/ui/section';
import { Text } from '@/components/ui/text';
import type { Goal } from '@/db/types';
import { useSettings } from '@/features/settings/settings-provider';
import { countOf } from '@/lib/text';
import { useTheme } from '@/theme/theme-provider';
import { radius, spacing } from '@/theme/tokens';

import { useGoals } from '../hooks';
import { describeDeadline, goalProgress } from '../progress';

import { PACE_TONE } from './goal-card';

function GoalLine({ goal }: { goal: Goal }) {
  const { colors } = useTheme();
  const { formatAmount } = useSettings();
  const progress = goalProgress(goal);
  const tone = PACE_TONE[progress.pace];

  return (
    <PressableScale
      scaleTo={0.99}
      onPress={() => router.push({ pathname: '/goals/[id]', params: { id: goal.id } })}
      accessibilityLabel={`${goal.name}, ${progress.percent}% saved`}
      style={styles.line}>
      <View style={styles.lineHead}>
        <IconBadge icon={goal.icon} color={goal.color} size={32} />
        <View style={styles.lineText}>
          <Text variant="callout" weight="medium" numberOfLines={1}>
            {goal.name}
          </Text>
          <Text variant="micro" color="textMuted" numberOfLines={1}>
            {formatAmount(goal.saved)} of {formatAmount(goal.targetAmount)} ·{' '}
            {describeDeadline(progress)}
          </Text>
        </View>
        <View style={[styles.pill, { backgroundColor: colors.surfaceMuted }]}>
          <Text variant="micro" weight="bold" color={tone} tabular>
            {progress.percent}%
          </Text>
        </View>
      </View>
      <ProgressBar value={progress.ratio} color={colors[tone]} height={6} />
    </PressableScale>
  );
}

/** Dashboard view of how each goal is coming along. Hidden when there are none. */
export function GoalOverview({ limit = 3 }: { limit?: number }) {
  const { colors } = useTheme();
  const { formatAmount } = useSettings();
  const { data } = useGoals();

  const active = (data ?? []).filter((goal) => goal.status === 'active');
  if (active.length === 0) return null;

  // Closest to done first, so the next win is at the top.
  const sorted = [...active].sort((a, b) => b.saved / b.targetAmount - a.saved / a.targetAmount);
  const saved = active.reduce((sum, goal) => sum + goal.saved, 0);
  const target = active.reduce((sum, goal) => sum + goal.targetAmount, 0);
  const percent = target > 0 ? Math.round((saved / target) * 100) : 0;
  const ready = active.filter((goal) => goal.saved >= goal.targetAmount).length;

  return (
    <Section
      title="Goals"
      caption={
        ready > 0
          ? `${countOf(ready, 'goal')} ready to complete`
          : `${percent}% of ${countOf(active.length, 'goal')} funded`
      }
      action={{ label: 'Manage', onPress: () => router.push('/goals') }}>
      <Card style={styles.card}>
        <View style={styles.summary}>
          <View style={styles.summaryText}>
            <Text variant="micro" color="textMuted" uppercase>
              Held towards goals
            </Text>
            <Text variant="caption" color="textSecondary">
              <Amount value={saved} variant="caption" weight="semibold" color="primary" />
              {` of ${formatAmount(target)}`}
            </Text>
          </View>
          <View style={[styles.total, { backgroundColor: colors.primaryMuted }]}>
            {ready > 0 ? <Icon name="checkmark-circle" size={13} color="income" /> : null}
            <Text variant="callout" weight="bold" color="primary" tabular>
              {percent}%
            </Text>
          </View>
        </View>

        <View style={styles.list}>
          {sorted.slice(0, limit).map((goal) => (
            <GoalLine key={goal.id} goal={goal} />
          ))}
        </View>

        {active.length > limit ? (
          <Text variant="micro" color="textMuted" align="center">
            +{active.length - limit} more
          </Text>
        ) : null}
      </Card>
    </Section>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.lg,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  summaryText: {
    flex: 1,
    gap: 2,
  },
  total: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  list: {
    gap: spacing.md,
  },
  line: {
    gap: spacing.xs + 2,
  },
  lineHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
  },
  lineText: {
    flex: 1,
    gap: 1,
  },
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
});
