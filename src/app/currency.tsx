import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { PressableScale } from '@/components/ui/pressable-scale';
import { SearchBar } from '@/components/ui/search-bar';
import { Text } from '@/components/ui/text';
import { useToast } from '@/components/ui/toast';
import { CURRENCIES } from '@/features/settings/currencies';
import { useSettings } from '@/features/settings/settings-provider';
import { goBack } from '@/lib/navigation';
import { formatMoney } from '@/lib/money';
import { useTheme } from '@/theme/theme-provider';
import { maxContentWidth, radius, spacing } from '@/theme/tokens';

export default function CurrencyScreen() {
  const { settings, updateSettings } = useSettings();
  const { colors } = useTheme();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const term = search.trim().toLowerCase();
  const items = term
    ? CURRENCIES.filter(
        (c) => c.code.toLowerCase().includes(term) || c.name.toLowerCase().includes(term)
      )
    : CURRENCIES;

  return (
    <FlatList
      data={items}
      keyExtractor={(c) => c.code}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text variant="callout" color="textSecondary">
            Amounts are displayed in this currency. Stored values are not converted.
          </Text>
          <View style={styles.row}>
            <SearchBar value={search} onChangeText={setSearch} placeholder="Search currency" />
          </View>
        </View>
      }
      renderItem={({ item }) => {
        const selected = item.code === settings.currency;
        return (
          <PressableScale
            haptic
            scaleTo={0.98}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`${item.name}, ${item.code}`}
            onPress={async () => {
              try {
                await updateSettings({ currency: item.code });
                goBack('/settings');
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Could not change the currency');
              }
            }}
            style={[styles.item, selected && { backgroundColor: colors.primaryMuted }]}>
            <View style={[styles.symbol, { backgroundColor: colors.surfaceMuted }]}>
              <Text weight="bold" numberOfLines={1} adjustsFontSizeToFit>
                {item.symbol.trim()}
              </Text>
            </View>
            <View style={styles.flex}>
              <Text weight={selected ? 'semibold' : 'medium'}>{item.name}</Text>
              <Text variant="caption" color="textMuted">
                {item.code} · {formatMoney(1234567, item)}
              </Text>
            </View>
            {selected ? <Icon name="checkmark-circle" size={22} color="primary" /> : null}
          </PressableScale>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.huge,
  },
  header: {
    gap: spacing.md,
    padding: spacing.sm,
    paddingBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm + 2,
    borderRadius: radius.lg,
  },
  symbol: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  flex: {
    flex: 1,
  },
});
