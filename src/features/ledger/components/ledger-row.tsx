import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Amount } from '@/components/ui/amount';
import { Icon } from '@/components/ui/icon';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import type { LedgerEntry } from '@/db/types';
import { MONTHS_SHORT, parseISODate } from '@/lib/date';
import { useTheme } from '@/theme/theme-provider';
import { radius, spacing } from '@/theme/tokens';

export function LedgerRow({ entry, showAccount }: { entry: LedgerEntry; showAccount: boolean }) {
  const { colors } = useTheme();
  const isOpening = entry.entryType === 'opening';
  const isDebit = entry.debit > 0;
  const date = parseISODate(entry.date);
  const meta = isOpening
    ? 'Opening balance'
    : [entry.categoryName, entry.sourceName, showAccount ? entry.accountName : null]
        .filter(Boolean)
        .join(' · ');

  return (
    <PressableScale
      scaleTo={0.985}
      disabled={!entry.transactionId}
      onPress={
        entry.transactionId
          ? () =>
              router.push({
                pathname: '/transaction/[id]',
                params: { id: entry.transactionId! },
              })
          : undefined
      }
      accessibilityLabel={`${entry.description}, ${isDebit ? 'debit' : 'credit'}`}
      style={[styles.row, { borderBottomColor: colors.border }]}>
      <View style={[styles.date, { backgroundColor: colors.surfaceMuted }]}>
        {isOpening ? (
          <Icon name="flag" size={16} color="primary" />
        ) : (
          <>
            <Text variant="subheading" weight="bold" style={styles.day}>
              {date.getDate()}
            </Text>
            <Text variant="micro" color="textMuted" uppercase>
              {MONTHS_SHORT[date.getMonth()]}
            </Text>
          </>
        )}
      </View>
      <View style={styles.main}>
        <Text weight="medium" numberOfLines={1}>
          {entry.description}
        </Text>
        <Text variant="caption" color="textMuted" numberOfLines={1}>
          {showAccount && isOpening ? `${meta} · ${entry.accountName}` : meta}
        </Text>
      </View>
      <View style={styles.amounts}>
        <View style={styles.amountLine}>
          <Text variant="micro" weight="semibold" color={isDebit ? 'income' : 'expense'}>
            {isDebit ? 'DR' : 'CR'}
          </Text>
          <Amount
            value={isDebit ? entry.debit : entry.credit}
            color={isDebit ? 'income' : 'expense'}
          />
        </View>
        <Text variant="micro" color="textMuted" tabular numberOfLines={1}>
          Bal{' '}
          <Amount value={entry.balance} variant="micro" weight="semibold" color="textSecondary" />
        </Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  date: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  day: {
    lineHeight: 20,
  },
  main: {
    flex: 1,
    gap: 3,
  },
  amounts: {
    alignItems: 'flex-end',
    gap: 3,
    maxWidth: '45%',
  },
  amountLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});
