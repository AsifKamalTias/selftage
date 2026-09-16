import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { useTheme } from '@/theme/theme-provider';
import { brandGradient, spacing, withAlpha } from '@/theme/tokens';

import { Text } from './text';

/** Branded spinner: a gradient arc orbiting a faint track. */
export function Loader({ size = 40, strokeWidth = 4 }: { size?: number; strokeWidth?: number }) {
  const { colors } = useTheme();
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.set(withRepeat(withTiming(360, { duration: 900, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(rotation);
  }, [rotation]);

  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.get()}deg` }] }));
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;

  return (
    <View
      style={{ width: size, height: size }}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading">
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={withAlpha(colors.primary, 0.15)}
          strokeWidth={strokeWidth}
          fill="none"
        />
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFill, spin]}>
        <Svg width={size} height={size}>
          <Defs>
            <LinearGradient id="loader-arc" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={brandGradient[0]} />
              <Stop offset="1" stopColor={brandGradient[1]} />
            </LinearGradient>
          </Defs>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="url(#loader-arc)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${circumference * 0.3} ${circumference}`}
            fill="none"
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

export function ScreenLoader({ label }: { label?: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Loader size={44} />
      {label ? (
        <Text variant="callout" color="textSecondary">
          {label}
        </Text>
      ) : null}
    </View>
  );
}

export function Skeleton({
  width = '100%',
  height = 16,
  radius = 8,
}: {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
}) {
  const { colors } = useTheme();
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.set(withRepeat(withTiming(0.45, { duration: 750 }), -1, true));
    return () => cancelAnimation(opacity);
  }, [opacity]);

  const pulse = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return (
    <Animated.View
      style={[{ width, height, borderRadius: radius, backgroundColor: colors.skeleton }, pulse]}
    />
  );
}

/** Placeholder shaped like a list of transaction rows. */
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={styles.row}>
          <Skeleton width={44} height={44} radius={14} />
          <View style={styles.rowText}>
            <Skeleton width="60%" height={14} />
            <Skeleton width="35%" height={12} />
          </View>
          <Skeleton width={64} height={14} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  list: {
    gap: spacing.lg,
    paddingVertical: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowText: {
    flex: 1,
    gap: spacing.sm,
  },
});
