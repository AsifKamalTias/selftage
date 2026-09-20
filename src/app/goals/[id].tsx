import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ProgressRing } from '@/components/charts/progress-ring';
import { Amount } from '@/components/ui/amount';
import { Button, IconButton } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { confirm } from '@/components/ui/confirm';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { IconBadge } from '@/components/ui/icon-badge';
import { ScreenLoader } from '@/components/ui/loader';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { Text } from '@/components/ui/text';
import { useToast } from '@/components/ui/toast';
import { GoalCompleteSheet } from '@/features/goals/components/goal-complete-sheet';
import { GoalMoneySheet, type MoneyMode } from '@/features/goals/components/goal-money-sheet';
import { PACE_TONE } from '@/features/goals/components/goal-card';
import { useDeleteGoal, useGoal, useGoalContributions } from '@/features/goals/hooks';
import { describeDeadline, describePace, goalProgress } from '@/features/goals/progress';
import { useSettings } from '@/features/settings/settings-provider';
import { toISODate } from '@/lib/date';
import { goBack } from '@/lib/navigation';
import { useTheme } from '@/theme/theme-provider';
import { radius, spacing, type ColorName } from '@/theme/tokens';

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.stat}>
      <Text variant="micro" color="textMuted" uppercase numberOfLines={1}>
        {label}
      </Text>
      {children}
    </View>
  );
}

export default function GoalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { formatAmount, formatDate } = useSettings();
  const toast = useToast();
  const { data: goal, isPending } = useGoal(id);
  const contributions = useGoalContributions(id);
  const remove = useDeleteGoal();
  const [moneyMode, setMoneyMode] = useState<MoneyMode | null>(null);
  const [completing, setCompleting] = useState(false);

  if (isPending) return <ScreenLoader />;
  if (!goal) {
    return (
      <EmptyState
        icon="search-outline"
        title="Goal not found"
        message="It may have been deleted."
        action={{ label: 'Back to goals', onPress: () => goBack('/goals') }}
      />
    );
  }

  const progress = goalProgress(goal);
  const completed = goal.status === 'completed';
  const tone: ColorName = completed ? 'income' : PACE_TONE[progress.pace];

  // Net held per account, for releasing and for the completion breakdown.
  const held = new Map<string, number>();
  const names = new Map<string, string>();
  for (const item of contributions.data ?? []) {
    held.set(item.accountId, (held.get(item.accountId) ?? 0) + item.amount);
    names.set(item.accountId, item.accountName);
  }
  const breakdown = [...held.entries()]
    .filter(([, amount]) => amount > 0)
    .map(([accountId, amount]) => ({
      accountId,
      accountName: names.get(accountId) ?? 'Account',
      amount,
    }));

  const handleDelete = async () => {
    const ok = await confirm({
      title: `Delete ${goal.name}?`,
      message: goal.saved
        ? `${formatAmount(goal.saved)} held for this goal is released back to your accounts.`
        : 'This goal will be removed.',
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(goal.id);
      toast.success('Goal deleted');
      goBack('/goals');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not delete the goal');
    }
  };

  return (
    <Screen safeBottom>
      <Stack.Screen
        options={{
          title: goal.name,
          headerRight: () =>
            completed ? null : (
              <IconButton
                icon="create-outline"
                variant="plain"
                accessibilityLabel="Edit goal"
                onPress={() => router.push({ pathname: '/goals/form', params: { id: goal.id } })}
              />
            ),
        }}
      />

      <Card style={styles.hero}>
        <ProgressRing value={progress.ratio} color={goal.color} size={184}>
          <Text variant="display" weight="bold" tabular>
            {progress.percent}%
          </Text>
          <Amount value={goal.saved} variant="callout" color="textSecondary" />
        </ProgressRing>

        <View style={[styles.badge, { backgroundColor: colors.surfaceMuted }]}>
          <Icon name={completed ? 'checkmark-circle' : 'flag'} size={14} color={tone} />
          <Text variant="label" weight="semibold" color={tone}>
            {completed ? 'Completed' : describePace(progress.pace)}
          </Text>
        </View>

        <Text variant="caption" color="textMuted" align="center">
          {completed
            ? `Spent ${formatAmount(goal.saved)} on ${
                // completedAt is a UTC timestamp: read it in the user's own day.
                goal.completedAt ? formatDate(toISODate(new Date(goal.completedAt))) : 'completion'
              }`
            : `Target ${formatAmount(goal.targetAmount)}${
                goal.targetDate ? ` by ${formatDate(goal.targetDate)}` : ''
              }`}
        </Text>
      </Card>

      {completed ? null : (
        <>
          <Card style={styles.stats}>
            <View style={styles.statRow}>
              <Stat label="Still needed">
                <Amount value={progress.remaining} variant="subheading" weight="bold" />
              </Stat>
              <Stat label="Time left">
                <Text variant="subheading" weight="bold" numberOfLines={1}>
                  {describeDeadline(progress)}
                </Text>
              </Stat>
            </View>
            {progress.perDay > 0 ? (
              <View style={[styles.statRow, styles.statRowTop, { borderTopColor: colors.border }]}>
                <Stat label="Per day">
                  <Amount value={progress.perDay} variant="body" weight="semibold" />
                </Stat>
                <Stat label="Per week">
                  <Amount value={progress.perWeek} variant="body" weight="semibold" />
                </Stat>
                <Stat label="Per month">
                  <Amount value={progress.perMonth} variant="body" weight="semibold" />
                </Stat>
              </View>
            ) : null}
          </Card>

          <View style={styles.actions}>
            <Button
              title="Hold money"
              icon="lock-closed-outline"
              variant={progress.reached ? 'outline' : 'primary'}
              style={styles.flex}
              onPress={() => setMoneyMode('reserve')}
            />
            <Button
              title="Release"
              icon="lock-open-outline"
              variant="outline"
              style={styles.flex}
              disabled={goal.saved <= 0}
              onPress={() => setMoneyMode('release')}
            />
          </View>

          {progress.reached ? (
            <Button
              title="Mark complete & spend reserve"
              icon="checkmark-done"
              tint={colors.income}
              onPress={() => setCompleting(true)}
            />
          ) : (
            <Text variant="caption" color="textMuted" align="center">
              Hold the full target to unlock completing this goal.
            </Text>
          )}
        </>
      )}

      {goal.note ? (
        <Section title="Note">
          <Card>
            <Text color="textSecondary">{goal.note}</Text>
          </Card>
        </Section>
      ) : null}

      <Section
        title="Activity"
        caption={`${goal.contributionCount} movement${goal.contributionCount === 1 ? '' : 's'}`}>
        {contributions.data && contributions.data.length > 0 ? (
          <Card style={styles.activity}>
            {contributions.data.map((item) => (
              <View key={item.id} style={styles.activityRow}>
                <IconBadge
                  icon={item.amount > 0 ? 'lock-closed' : 'lock-open'}
                  color={item.amount > 0 ? colors.primary : colors.warning}
                  size={34}
                />
                <View style={styles.activityText}>
                  <Text variant="callout" weight="medium" numberOfLines={1}>
                    {item.amount > 0 ? 'Held from' : 'Released to'} {item.accountName}
                  </Text>
                  <Text variant="micro" color="textMuted" numberOfLines={1}>
                    {formatDate(item.date)}
                    {item.note ? ` · ${item.note}` : ''}
                  </Text>
                </View>
                <Amount value={item.amount} variant="callout" weight="semibold" signed colorize />
              </View>
            ))}
          </Card>
        ) : (
          <Card padded={false}>
            <EmptyState
              compact
              icon="wallet-outline"
              title="Nothing held yet"
              message="Hold money from an account to start filling this goal."
            />
          </Card>
        )}
      </Section>

      <Button
        title="Delete goal"
        icon="trash-outline"
        variant="danger"
        loading={remove.isPending}
        onPress={handleDelete}
      />

      <GoalMoneySheet
        goal={goal}
        mode={moneyMode ?? 'reserve'}
        visible={moneyMode !== null}
        onClose={() => setMoneyMode(null)}
        heldByAccount={held}
      />
      <GoalCompleteSheet
        goal={goal}
        visible={completing}
        onClose={() => setCompleting(false)}
        breakdown={breakdown}
        onCompleted={() => toast.show('Recorded in your ledger', 'info')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xl,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 1,
    borderRadius: radius.pill,
  },
  stats: {
    gap: spacing.md,
  },
  statRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  statRowTop: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.md,
  },
  stat: {
    flex: 1,
    gap: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  flex: {
    flex: 1,
  },
  activity: {
    gap: spacing.md,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  activityText: {
    flex: 1,
    gap: 1,
  },
});
