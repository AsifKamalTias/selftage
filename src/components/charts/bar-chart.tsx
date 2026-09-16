import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import Svg, { Line, Path, Text as SvgText } from 'react-native-svg';

import { Text } from '@/components/ui/text';
import { haptics } from '@/lib/haptics';
import { useTheme } from '@/theme/theme-provider';
import { fonts, radius, spacing, withAlpha } from '@/theme/tokens';

import { labelStep, niceMax, roundedTopBar, ticks } from './scale';

export interface ChartSeries {
  key: string;
  label: string;
  color: string;
}

export interface BarDatum {
  label: string;
  /** Detailed label for the tooltip. */
  title?: string;
  /** One value per series, in series order. */
  values: number[];
}

export interface BarChartProps {
  data: BarDatum[];
  series: ChartSeries[];
  height?: number;
  formatAxis: (value: number) => string;
  formatValue: (value: number) => string;
}

const AXIS_WIDTH = 48;
const TOP = 12;
const BOTTOM = 24;

export function BarChart({ data, series, height = 200, formatAxis, formatValue }: BarChartProps) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  const plotWidth = Math.max(0, width - AXIS_WIDTH);
  const plotHeight = height - TOP - BOTTOM;
  const max = niceMax(Math.max(0, ...data.flatMap((d) => d.values)));
  const groupWidth = data.length ? plotWidth / data.length : 0;
  const barGap = 3;
  const barWidth = Math.max(
    3,
    Math.min(16, (groupWidth * 0.72 - barGap * (series.length - 1)) / series.length)
  );
  const step = labelStep(data.length, Math.max(3, Math.floor(plotWidth / 44)));
  const active: BarDatum | null = (selected != null && data[selected]) || null;

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <View style={[styles.tooltip, { backgroundColor: colors.surfaceMuted }]}>
        {active ? (
          <>
            <Text variant="caption" weight="semibold">
              {active.title ?? active.label}
            </Text>
            <View style={styles.tooltipValues}>
              {series.map((s, i) => (
                <View key={s.key} style={styles.legendItem}>
                  <View style={[styles.dot, { backgroundColor: s.color }]} />
                  <Text variant="caption" color="textSecondary">
                    {s.label}
                  </Text>
                  <Text variant="caption" weight="semibold" tabular>
                    {formatValue(active.values[i] ?? 0)}
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          <View style={styles.tooltipValues}>
            {series.map((s) => (
              <View key={s.key} style={styles.legendItem}>
                <View style={[styles.dot, { backgroundColor: s.color }]} />
                <Text variant="caption" color="textSecondary">
                  {s.label}
                </Text>
              </View>
            ))}
            <Text variant="caption" color="textMuted" style={styles.hint}>
              Tap a bar for details
            </Text>
          </View>
        )}
      </View>

      {width > 0 ? (
        <Animated.View entering={FadeIn.duration(350)} key={data.length}>
          <Svg width={width} height={height}>
            {ticks(max).map((tick) => {
              const y = TOP + plotHeight - (tick / max) * plotHeight;
              return (
                <Line
                  key={`grid-${tick}`}
                  x1={AXIS_WIDTH}
                  x2={width}
                  y1={y}
                  y2={y}
                  stroke={colors.chartGrid}
                  strokeWidth={1}
                  strokeDasharray={tick === 0 ? undefined : '4 4'}
                />
              );
            })}
            {ticks(max).map((tick) => (
              <SvgText
                key={`axis-${tick}`}
                x={AXIS_WIDTH - 8}
                y={TOP + plotHeight - (tick / max) * plotHeight + 4}
                fontSize={10}
                fontFamily={fonts.medium}
                fill={colors.textMuted}
                textAnchor="end">
                {formatAxis(tick)}
              </SvgText>
            ))}
            {data.map((datum, index) => {
              const groupX = AXIS_WIDTH + index * groupWidth;
              const totalBars = barWidth * series.length + barGap * (series.length - 1);
              const startX = groupX + (groupWidth - totalBars) / 2;
              const dim = selected != null && selected !== index;
              return series.map((s, si) => {
                const value = datum.values[si] ?? 0;
                const barHeight = (value / max) * plotHeight;
                const x = startX + si * (barWidth + barGap);
                return (
                  <Path
                    key={`${index}-${s.key}`}
                    d={roundedTopBar(x, TOP + plotHeight - barHeight, barWidth, barHeight, 4)}
                    fill={dim ? withAlpha(s.color, 0.3) : s.color}
                  />
                );
              });
            })}
            {data.map((datum, index) =>
              index % step === 0 ? (
                <SvgText
                  key={`label-${index}`}
                  x={AXIS_WIDTH + index * groupWidth + groupWidth / 2}
                  y={height - 6}
                  fontSize={10}
                  fontFamily={selected === index ? fonts.semibold : fonts.regular}
                  fill={selected === index ? colors.text : colors.textMuted}
                  textAnchor="middle">
                  {datum.label}
                </SvgText>
              ) : null
            )}
          </Svg>
          <View style={[StyleSheet.absoluteFill, styles.hitRow, { left: AXIS_WIDTH }]}>
            {data.map((datum, index) => (
              <Pressable
                key={`hit-${index}`}
                style={styles.hit}
                accessibilityRole="button"
                accessibilityLabel={`${datum.title ?? datum.label}: ${series
                  .map((s, i) => `${s.label} ${formatValue(datum.values[i] ?? 0)}`)
                  .join(', ')}`}
                onPress={() => {
                  haptics.selection();
                  setSelected((current) => (current === index ? null : index));
                }}
              />
            ))}
          </View>
        </Animated.View>
      ) : (
        <View style={{ height }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tooltip: {
    minHeight: 52,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    justifyContent: 'center',
    gap: 4,
  },
  tooltipValues: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: spacing.lg,
    rowGap: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  hint: {
    marginLeft: 'auto',
  },
  hitRow: {
    flexDirection: 'row',
  },
  hit: {
    flex: 1,
  },
});
