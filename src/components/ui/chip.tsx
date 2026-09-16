import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/theme-provider';
import { radius, spacing } from '@/theme/tokens';

import { Icon, type IconName } from './icon';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName | (string & {});
  /** Accent color for the icon/dot and the selected state. */
  color?: string;
  onRemove?: () => void;
}

export function Chip({ label, selected = false, onPress, icon, color, onRemove }: ChipProps) {
  const { colors } = useTheme();
  const accent = color ?? colors.primary;
  return (
    <PressableScale
      haptic
      onPress={onPress}
      disabled={!onPress && !onRemove}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityState={{ selected }}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.primaryMuted : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}>
      {icon ? (
        <Icon name={icon} size={14} color={selected ? colors.primary : accent} />
      ) : color ? (
        <View style={[styles.dot, { backgroundColor: accent }]} />
      ) : null}
      <Text
        variant="caption"
        weight={selected ? 'semibold' : 'medium'}
        color={selected ? 'primary' : 'textSecondary'}
        numberOfLines={1}>
        {label}
      </Text>
      {onRemove ? (
        <PressableScale onPress={onRemove} hitSlop={8} accessibilityLabel={`Remove ${label}`}>
          <Icon name="close" size={14} color={selected ? 'primary' : 'textMuted'} />
        </PressableScale>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    height: 34,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
