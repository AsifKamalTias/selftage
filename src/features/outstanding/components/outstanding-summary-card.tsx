import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Amount } from '@/components/ui/amount';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Section } from '@/components/ui/section';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme/theme-provider';
import { spacing } from '@/theme/tokens';

import { useOutstandingSummary } from '../hooks';

/** Dashboard view of what is still owed either way. Hidden when nothing is open. */
export function OutstandingSummaryCard() {
  const { colors } = useTheme();
  const { data } = useOutstandingSummary();

  if (!data || data.openCount === 0) return null;

  return (
    <Section
      title="Outstanding"
      caption={`${data.openCount} open${data.overdueCount ? ` · ${data.overdueCount} overdue` : ''}`}>
      <PressableScale
        scaleTo={0.99}
        onPress={() => router.push('/outstanding')}
        accessibilityLabel="Open outstanding payments"
        accessibilityHint="Shows what you owe and are owed">
        <Card style={styles.card}>
          <View style={styles.row}>
            <View style={styles.item}>
              <Text variant="micro" color="textMuted" uppercase>
                To receive
              </Text>
              <Amount value={data.receivable} variant="subheading" weight="bold" color="income" />
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.item}>
              <Text variant="micro" color="textMuted" uppercase>
                To pay
              </Text>
              <Amount value={data.payable} variant="subheading" weight="bold" color="expense" />
            </View>
          </View>
          <View style={[styles.net, { borderTopColor: colors.border }]}>
            {data.overdueCount ? (
              <View style={styles.overdue}>
                <Icon name="alert-circle" size={13} color="expense" />
                <Text variant="caption" color="expense" weight="semibold">
                  {data.overdueCount} overdue
                </Text>
              </View>
            ) : (
              <Text variant="caption" color="textSecondary">
                Net position
              </Text>
            )}
            <Amount value={data.net} variant="callout" weight="bold" signed colorize />
          </View>
        </Card>
      </PressableScale>
    </Section>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  item: {
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
    gap: spacing.xs,
  },
});
