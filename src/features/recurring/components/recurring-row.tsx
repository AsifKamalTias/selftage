import { StyleSheet, View } from 'react-native';

import { Amount } from '@/components/ui/amount';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { IconBadge } from '@/components/ui/icon-badge';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import type { RecurringRule } from '@/db/types';
import { useSettings } from '@/features/settings/settings-provider';
import { todayISO } from '@/lib/date';
import { useTheme } from '@/theme/theme-provider';
import { radius, spacing } from '@/theme/tokens';

import { describeNextRun, describeRecurrence } from '../schedule';

export function RecurringRow({ rule, onPress }: { rule: RecurringRule; onPress: () => void }) {
  const { colors } = useTheme();
  const { settings } = useSettings();
  const today = todayISO();
  const overdue = rule.isActive && rule.nextDate <= today;

  return (
    <PressableScale
      scaleTo={0.99}
      onPress={onPress}
      accessibilityLabel={`Edit ${rule.name}`}
      accessibilityHint={describeRecurrence(rule.frequency, rule.intervalCount, rule.startDate)}>
      <Card style={[styles.card, !rule.isActive && styles.paused]}>
        <View style={styles.header}>
          <IconBadge icon={rule.categoryIcon} color={rule.categoryColor} size={40} />
          <View style={styles.titles}>
            <Text weight="semibold" numberOfLines={1}>
              {rule.name}
            </Text>
            <Text variant="caption" color="textMuted" numberOfLines={1}>
              {describeRecurrence(rule.frequency, rule.intervalCount, rule.startDate)}
            </Text>
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

        {rule.postedCount ? (
          <Text variant="micro" color="textMuted">
            {rule.postedCount} entr{rule.postedCount === 1 ? 'y' : 'ies'} posted so far
          </Text>
        ) : null}
      </Card>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
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
    gap: 1,
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
