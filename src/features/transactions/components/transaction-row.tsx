import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Amount } from '@/components/ui/amount';
import { Icon } from '@/components/ui/icon';
import { IconBadge } from '@/components/ui/icon-badge';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import type { Transaction } from '@/db/types';
import { useSettings } from '@/features/settings/settings-provider';
import { spacing } from '@/theme/tokens';

export function TransactionRow({
  item,
  showDate = false,
}: {
  item: Transaction;
  showDate?: boolean;
}) {
  const { formatDate } = useSettings();
  const meta = [item.categoryName, item.sourceName, item.accountName].filter(Boolean).join(' · ');

  return (
    <PressableScale
      scaleTo={0.98}
      onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: item.id } })}
      accessibilityLabel={`${item.title}, ${item.kind} ${meta}`}
      accessibilityHint="Opens transaction details"
      style={styles.row}>
      <IconBadge icon={item.categoryIcon} color={item.categoryColor} size={44} />
      <View style={styles.main}>
        <Text weight="medium" numberOfLines={1}>
          {item.title}
        </Text>
        <Text variant="caption" color="textMuted" numberOfLines={1}>
          {meta}
        </Text>
      </View>
      <View style={styles.side}>
        <Amount value={item.amount} kind={item.kind} signed colorize />
        <View style={styles.sideMeta}>
          {item.attachmentCount > 0 ? <Icon name="attach" size={13} color="textMuted" /> : null}
          {showDate ? (
            <Text variant="micro" color="textMuted">
              {formatDate(item.date)}
            </Text>
          ) : null}
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  main: {
    flex: 1,
    gap: 3,
  },
  side: {
    alignItems: 'flex-end',
    gap: 3,
    maxWidth: '45%',
  },
  sideMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 14,
  },
});
