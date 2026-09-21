import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Amount } from '@/components/ui/amount';
import { Button, IconButton } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ListSkeleton } from '@/components/ui/loader';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { Text } from '@/components/ui/text';
import type { Goal } from '@/db/types';
import { GoalCard } from '@/features/goals/components/goal-card';
import { GoalMoneySheet, type MoneyMode } from '@/features/goals/components/goal-money-sheet';
import { useGoalContributions, useGoals } from '@/features/goals/hooks';
import { useTheme } from '@/theme/theme-provider';
import { spacing } from '@/theme/tokens';

/** Loads the per-account holds the money sheet needs, only once one is opened. */
function GoalMoneyLauncher({
  goal,
  mode,
  onClose,
}: {
  goal: Goal;
  mode: MoneyMode;
  onClose: () => void;
}) {
  const contributions = useGoalContributions(goal.id);
  const held = new Map<string, number>();
  for (const item of contributions.data ?? []) {
    held.set(item.accountId, (held.get(item.accountId) ?? 0) + item.amount);
  }
  return <GoalMoneySheet goal={goal} mode={mode} visible onClose={onClose} heldByAccount={held} />;
}

export default function GoalsScreen() {
  const { colors } = useTheme();
  const [money, setMoney] = useState<{ goal: Goal; mode: MoneyMode } | null>(null);
  const { data, isPending } = useGoals();
  const goals = data ?? [];
  const active = goals.filter((goal) => goal.status === 'active');
  const completed = goals.filter((goal) => goal.status === 'completed');
  const reserved = active.reduce((sum, goal) => sum + goal.saved, 0);
  const target = active.reduce((sum, goal) => sum + goal.targetAmount, 0);

  const open = (id?: string) =>
    router.push(id ? { pathname: '/goals/[id]', params: { id } } : '/goals/form');

  return (
    <Screen safeBottom>
      <Stack.Screen
        options={{
          headerRight: () => (
            <IconButton
              icon="add"
              variant="plain"
              accessibilityLabel="Add goal"
              onPress={() => open()}
            />
          ),
        }}
      />

      {isPending ? (
        <ListSkeleton rows={3} />
      ) : goals.length === 0 ? (
        <EmptyState
          icon="flag-outline"
          title="No goals yet"
          message="Set a target, then hold money from your accounts towards it. The money stays in the account until you complete the goal."
          action={{ label: 'Create a goal', icon: 'add', onPress: () => open() }}
        />
      ) : (
        <>
          {active.length > 0 ? (
            <Card muted elevated={false} style={styles.summary}>
              <View style={styles.summaryItem}>
                <Text variant="micro" color="textMuted" uppercase>
                  Reserved
                </Text>
                <Amount value={reserved} variant="heading" weight="bold" color="primary" />
              </View>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={styles.summaryItem}>
                <Text variant="micro" color="textMuted" uppercase>
                  Across {active.length} goal{active.length === 1 ? '' : 's'}
                </Text>
                <Text variant="callout" color="textSecondary">
                  of <Amount value={target} variant="callout" weight="semibold" /> target
                </Text>
              </View>
            </Card>
          ) : null}

          {active.length > 0 ? (
            <Section title="In progress" caption="Money held for these stays in your accounts">
              <View style={styles.list}>
                {active.map((goal) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    onPress={() => open(goal.id)}
                    onHold={(target) => setMoney({ goal: target, mode: 'reserve' })}
                    onRelease={(target) => setMoney({ goal: target, mode: 'release' })}
                    onEdit={(target) =>
                      router.push({ pathname: '/goals/form', params: { id: target.id } })
                    }
                  />
                ))}
              </View>
            </Section>
          ) : null}

          {completed.length > 0 ? (
            <Section title="Completed" caption="Reserve spent and recorded as an expense">
              <View style={styles.list}>
                {completed.map((goal) => (
                  <GoalCard key={goal.id} goal={goal} onPress={() => open(goal.id)} />
                ))}
              </View>
            </Section>
          ) : null}

          <Button title="Create a goal" icon="add" variant="secondary" onPress={() => open()} />
        </>
      )}

      {money ? (
        <GoalMoneyLauncher goal={money.goal} mode={money.mode} onClose={() => setMoney(null)} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.md,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  summaryItem: {
    flex: 1,
    gap: 2,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
  },
});
