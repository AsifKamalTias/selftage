import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { PressableScale } from '@/components/ui/pressable-scale';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Text } from '@/components/ui/text';
import { haptics } from '@/lib/haptics';
import { useTheme } from '@/theme/theme-provider';
import { radius, spacing, withAlpha } from '@/theme/tokens';

import { arcPath } from './scale';

export interface DonutDatum {
  key: string;
  label: string;
  value: number;
  color: string;
  /** Secondary text in the legend, e.g. "12 transactions". */
  detail?: string;
}

export interface DonutChartProps {
  data: DonutDatum[];
  formatValue: (value: number) => string;
  size?: number;
  thickness?: number;
  centerLabel?: string;
  /** Legend rows shown below the chart; the rest are grouped as "Other". */
  maxLegendItems?: number;
}

const GAP_DEGREES = 1.6;

/** Start/end angles for each slice, with a small gap between neighbours. */
function buildSegments(items: DonutDatum[], total: number) {
  const segments: { item: DonutDatum; start: number; end: number }[] = [];
  let angle = 0;
  for (const item of items) {
    const sweep = total > 0 ? (item.value / total) * 360 : 0;
    const gap = items.length > 1 ? Math.min(GAP_DEGREES, sweep / 3) : 0;
    segments.push({ item, start: angle + gap / 2, end: angle + sweep - gap / 2 });
    angle += sweep;
  }
  return segments;
}

export function DonutChart({
  data,
  formatValue,
  size = 190,
  thickness = 22,
  centerLabel = 'Total',
  maxLegendItems = 6,
}: DonutChartProps) {
  const { colors } = useTheme();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const total = data.reduce((sum, d) => sum + d.value, 0);
  const visible = data.slice(0, maxLegendItems);
  const rest = data.slice(maxLegendItems);
  const items: DonutDatum[] = rest.length
    ? [
        ...visible,
        {
          key: '__other__',
          label: `Other (${rest.length})`,
          value: rest.reduce((sum, d) => sum + d.value, 0),
          color: colors.textMuted,
        },
      ]
    : visible;

  const selected = items.find((d) => d.key === selectedKey) ?? null;
  const r = (size - thickness) / 2;
  const c = size / 2;

  const segments = buildSegments(items, total);

  return (
    <View style={styles.container}>
      <Animated.View entering={ZoomIn.duration(400)} style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Circle
            cx={c}
            cy={c}
            r={r}
            stroke={colors.surfaceMuted}
            strokeWidth={thickness}
            fill="none"
          />
          {segments.map(({ item, start, end }) => {
            const dim = selected && selected.key !== item.key;
            const stroke = dim ? withAlpha(item.color, 0.25) : item.color;
            const width = selected?.key === item.key ? thickness + 4 : thickness;
            if (end - start >= 359.9) {
              return (
                <Circle
                  key={item.key}
                  cx={c}
                  cy={c}
                  r={r}
                  stroke={stroke}
                  strokeWidth={width}
                  fill="none"
                />
              );
            }
            if (end <= start) return null;
            return (
              <Path
                key={item.key}
                d={arcPath(c, c, r, start, end)}
                stroke={stroke}
                strokeWidth={width}
                strokeLinecap="butt"
                fill="none"
              />
            );
          })}
        </Svg>
        <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
          <Text variant="caption" color="textMuted" numberOfLines={1} style={styles.centerText}>
            {selected ? selected.label : centerLabel}
          </Text>
          <Text
            variant="subheading"
            weight="bold"
            tabular
            numberOfLines={1}
            style={styles.centerText}>
            {formatValue(selected ? selected.value : total)}
          </Text>
          {selected && total > 0 ? (
            <Text variant="caption" weight="semibold" color={selected.color}>
              {((selected.value / total) * 100).toFixed(1)}%
            </Text>
          ) : null}
        </View>
      </Animated.View>

      <View style={styles.legend}>
        {items.map((item) => {
          const share = total > 0 ? item.value / total : 0;
          const isSelected = selected?.key === item.key;
          return (
            <PressableScale
              key={item.key}
              scaleTo={0.98}
              accessibilityLabel={`${item.label}, ${formatValue(item.value)}, ${(share * 100).toFixed(0)} percent`}
              onPress={() => {
                haptics.selection();
                setSelectedKey((current) => (current === item.key ? null : item.key));
              }}
              style={[styles.legendRow, isSelected && { backgroundColor: colors.surfaceMuted }]}>
              <View style={styles.legendTop}>
                <View style={[styles.swatch, { backgroundColor: item.color }]} />
                <Text
                  variant="callout"
                  weight="medium"
                  numberOfLines={1}
                  style={styles.legendLabel}>
                  {item.label}
                </Text>
                <Text variant="caption" color="textMuted" tabular>
                  {(share * 100).toFixed(0)}%
                </Text>
                <Text variant="callout" weight="semibold" tabular style={styles.legendValue}>
                  {formatValue(item.value)}
                </Text>
              </View>
              <ProgressBar value={share} color={item.color} height={4} />
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing.xl,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxxl,
  },
  centerText: {
    maxWidth: '100%',
  },
  legend: {
    alignSelf: 'stretch',
    gap: spacing.xs,
  },
  legendRow: {
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  legendTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
  legendLabel: {
    flex: 1,
  },
  legendValue: {
    minWidth: 72,
    textAlign: 'right',
  },
});
