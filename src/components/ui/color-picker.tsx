import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/theme-provider';
import { PICKER_COLORS, spacing } from '@/theme/tokens';

import { Icon } from './icon';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

export function ColorPicker({
  label = 'Color',
  value,
  onChange,
}: {
  label?: string;
  value: string;
  onChange: (color: string) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.container}>
      <Text variant="label" color="textSecondary">
        {label}
      </Text>
      <View style={styles.grid} accessibilityRole="radiogroup">
        {PICKER_COLORS.map((color) => {
          const selected = color.toLowerCase() === value.toLowerCase();
          return (
            <PressableScale
              key={color}
              haptic
              scaleTo={0.88}
              accessibilityRole="radio"
              accessibilityLabel={`Color ${color}`}
              accessibilityState={{ selected }}
              onPress={() => onChange(color)}
              style={[
                styles.swatch,
                { backgroundColor: color, borderColor: selected ? colors.text : 'transparent' },
              ]}>
              {selected ? <Icon name="checkmark" size={18} color="#FFFFFF" /> : null}
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm + 2,
  },
  swatch: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
