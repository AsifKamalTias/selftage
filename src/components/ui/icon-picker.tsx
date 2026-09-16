import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/theme-provider';
import { radius, spacing, withAlpha } from '@/theme/tokens';

import { Icon, type IconName } from './icon';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

export const PICKER_ICONS: readonly IconName[] = [
  'wallet',
  'cash',
  'card',
  'library',
  'business',
  'phone-portrait',
  'document-text',
  'briefcase',
  'laptop',
  'storefront',
  'trending-up',
  'gift',
  'key',
  'home',
  'restaurant',
  'cafe',
  'fast-food',
  'cart',
  'bag-handle',
  'shirt',
  'car',
  'bus',
  'airplane',
  'train',
  'bicycle',
  'flash',
  'water',
  'flame',
  'wifi',
  'call',
  'tv',
  'game-controller',
  'film',
  'musical-notes',
  'book',
  'school',
  'medkit',
  'medical',
  'fitness',
  'heart',
  'paw',
  'people',
  'person',
  'happy',
  'sparkles',
  'construct',
  'hammer',
  'build',
  'globe',
  'receipt',
  'pricetag',
  'ticket',
  'return-down-back',
  'repeat',
  'shield-checkmark',
  'umbrella',
  'leaf',
  'planet',
  'star',
  'ellipsis-horizontal-circle',
];

export function IconPicker({
  label = 'Icon',
  value,
  color,
  onChange,
}: {
  label?: string;
  value: string;
  color: string;
  onChange: (icon: IconName) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.container}>
      <Text variant="label" color="textSecondary">
        {label}
      </Text>
      <View style={styles.grid} accessibilityRole="radiogroup">
        {PICKER_ICONS.map((icon) => {
          const selected = icon === value;
          return (
            <PressableScale
              key={icon}
              haptic
              scaleTo={0.88}
              accessibilityRole="radio"
              accessibilityLabel={icon.replace(/-/g, ' ')}
              accessibilityState={{ selected }}
              onPress={() => onChange(icon)}
              style={[
                styles.cell,
                {
                  backgroundColor: selected ? withAlpha(color, 0.18) : colors.surfaceMuted,
                  borderColor: selected ? color : 'transparent',
                },
              ]}>
              <Icon name={icon} size={20} color={selected ? color : colors.textSecondary} />
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
    gap: spacing.sm,
  },
  cell: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
