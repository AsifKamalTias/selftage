import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

import { haptics } from '@/lib/haptics';
import { useTheme } from '@/theme/theme-provider';
import { elevation, radius, spacing } from '@/theme/tokens';

import { Icon, type IconName } from './icon';
import { Text } from './text';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: IconName;
  /** Color for the label/indicator when selected. */
  activeColor?: string;
}

export interface SegmentedControlProps<T extends string> {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
}: SegmentedControlProps<T>) {
  const { colors, isDark } = useTheme();
  const [width, setWidth] = useState(0);
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value)
  );
  const segmentWidth = width > 0 ? (width - 8) / options.length : 0;
  const height = size === 'sm' ? 36 : 44;

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: withSpring(index * segmentWidth, { damping: 20, stiffness: 220 }) }],
  }));

  return (
    <View
      accessibilityRole="tablist"
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={[styles.track, { height, backgroundColor: colors.surfaceMuted }]}>
      {segmentWidth > 0 ? (
        <Animated.View
          style={[
            styles.indicator,
            {
              width: segmentWidth,
              backgroundColor: isDark ? colors.border : colors.surface,
            },
            elevation(1, colors.shadow, isDark),
            indicatorStyle,
          ]}
        />
      ) : null}
      {options.map((option) => {
        const selected = option.value === value;
        const tint = selected ? (option.activeColor ?? colors.text) : colors.textSecondary;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => {
              if (!selected) {
                haptics.selection();
                onChange(option.value);
              }
            }}
            style={styles.segment}>
            {option.icon ? <Icon name={option.icon} size={16} color={tint} /> : null}
            <Text
              variant={size === 'sm' ? 'caption' : 'callout'}
              weight={selected ? 'semibold' : 'medium'}
              color={tint}
              numberOfLines={1}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderRadius: radius.md,
    padding: 4,
  },
  indicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: radius.sm + 1,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.sm,
  },
});
