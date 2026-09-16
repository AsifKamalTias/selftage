import { StyleSheet, TextInput, View } from 'react-native';

import { useTheme } from '@/theme/theme-provider';
import { fonts, radius, spacing, typography } from '@/theme/tokens';

import { Icon } from './icon';
import { PressableScale } from './pressable-scale';

export interface SearchBarProps {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChangeText, placeholder = 'Search' }: SearchBarProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceMuted }]}>
      <Icon name="search" size={18} color="textMuted" />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.primary}
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
        clearButtonMode="never"
        accessibilityLabel={placeholder}
        style={[styles.input, typography.body, { color: colors.text, fontFamily: fonts.regular }]}
      />
      {value ? (
        <PressableScale
          onPress={() => onChangeText('')}
          hitSlop={10}
          accessibilityLabel="Clear search">
          <Icon name="close-circle" size={18} color="textMuted" />
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    flex: 1,
  },
  input: {
    flex: 1,
    // Web inputs have an intrinsic width; allow them to shrink inside flex rows.
    minWidth: 0,
    height: '100%',
    paddingVertical: 0,
    outlineStyle: 'none',
  } as object,
});
