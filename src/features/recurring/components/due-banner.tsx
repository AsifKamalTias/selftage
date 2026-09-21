import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Amount } from '@/components/ui/amount';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { todayISO } from '@/lib/date';
import { useTheme } from '@/theme/theme-provider';
import { spacing } from '@/theme/tokens';

import { usePendingOccurrences } from '../hooks';

/** Dashboard nudge: manual recurring entries that still need confirming. */
export function DueBanner() {
  const { colors } = useTheme();
  const { data } = usePendingOccurrences();
  const pending = data ?? [];

  if (pending.length === 0) return null;

  const today = todayISO();
  const overdue = pending.filter((o) => o.dueDate < today).length;
  const total = pending.reduce((sum, o) => sum + (o.kind === 'income' ? o.amount : -o.amount), 0);

  return (
    <PressableScale
      onPress={() => router.push('/recurring')}
      accessibilityLabel={`${pending.length} recurring waiting to be confirmed`}
      accessibilityHint="Opens the recurring screen">
      <Card style={[styles.card, { borderColor: colors.warning }]}>
        <View style={[styles.badge, { backgroundColor: `${colors.warning}1A` }]}>
          <Icon name="hand-left" size={18} color="warning" />
        </View>
        <View style={styles.text}>
          <Text variant="callout" weight="semibold" numberOfLines={1}>
            {pending.length} to confirm
          </Text>
          <Text variant="micro" color="textMuted" numberOfLines={1}>
            {overdue ? `${overdue} overdue · ` : ''}mark them paid when the money moves
          </Text>
        </View>
        <Amount value={total} variant="callout" weight="bold" signed colorize />
        <Icon name="chevron-forward" size={16} color="textMuted" />
      </Card>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
  },
  badge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    gap: 1,
  },
});
