import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { useTheme } from '@/theme/theme-provider';
import { withAlpha } from '@/theme/tokens';

/** Circular percentage indicator; anything above 100% keeps the ring full. */
export function ProgressRing({
  value,
  size = 168,
  thickness = 14,
  color,
  children,
}: {
  /** 0..1, values above 1 are clamped for the arc. */
  value: number;
  size?: number;
  thickness?: number;
  color?: string;
  children?: ReactNode;
}) {
  const { colors } = useTheme();
  const tint = color ?? colors.primary;
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const gradientId = `ring-${Math.round(size)}-${tint.replace('#', '')}`;

  return (
    <Animated.View
      entering={FadeIn.duration(320)}
      style={{ width: size, height: size }}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={tint} stopOpacity={0.75} />
            <Stop offset="1" stopColor={tint} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={withAlpha(tint, 0.16)}
          strokeWidth={thickness}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={`url(#${gradientId})`}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={`${circumference * clamped} ${circumference}`}
          // Start the arc at twelve o'clock.
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          fill="none"
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
        {children}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
});
