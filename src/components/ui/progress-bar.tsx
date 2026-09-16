import { View } from 'react-native';

import { useTheme } from '@/theme/theme-provider';

export function ProgressBar({
  value,
  color,
  height = 6,
}: {
  /** 0..1 */
  value: number;
  color?: string;
  height?: number;
}) {
  const { colors } = useTheme();
  const pct = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
      style={{
        height,
        borderRadius: height / 2,
        backgroundColor: colors.surfaceMuted,
        overflow: 'hidden',
      }}>
      <View
        style={{
          width: `${pct * 100}%`,
          height: '100%',
          borderRadius: height / 2,
          backgroundColor: color ?? colors.primary,
        }}
      />
    </View>
  );
}
