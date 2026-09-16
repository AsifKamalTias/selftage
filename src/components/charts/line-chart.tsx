import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

import { Text } from '@/components/ui/text';
import { haptics } from '@/lib/haptics';
import { useTheme } from '@/theme/theme-provider';
import { fonts, radius, spacing } from '@/theme/tokens';

import type { ChartSeries } from './bar-chart';
import { labelStep, niceMax, smoothPath, ticks } from './scale';

export interface LineSeries extends ChartSeries {
  values: number[];
}

export interface LineChartProps {
  labels: string[];
  series: LineSeries[];
  height?: number;
  formatAxis: (value: number) => string;
  formatValue: (value: number) => string;
}

const AXIS_WIDTH = 48;
const TOP = 14;
const BOTTOM = 24;
const RIGHT = 8;

export function LineChart({
  labels,
  series,
  height = 190,
  formatAxis,
  formatValue,
}: LineChartProps) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  const count = labels.length;
  const plotWidth = Math.max(0, width - AXIS_WIDTH - RIGHT);
  const plotHeight = height - TOP - BOTTOM;
  const max = niceMax(Math.max(0, ...series.flatMap((s) => s.values)));
  const xAt = (i: number) =>
    AXIS_WIDTH + (count <= 1 ? plotWidth / 2 : (i / (count - 1)) * plotWidth);
  const yAt = (v: number) => TOP + plotHeight - (v / max) * plotHeight;
  const step = labelStep(count, Math.max(3, Math.floor(plotWidth / 48)));
  const active = selected != null && selected < count ? selected : null;
  const lastIndex = count - 1;
  /** Width of the tap target around each point. */
  const column = count <= 1 ? plotWidth : plotWidth / (count - 1);

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <View style={[styles.tooltip, { backgroundColor: colors.surfaceMuted }]}>
        <Text variant="caption" weight="semibold">
          {active != null ? labels[active] : 'Running total'}
        </Text>
        <View style={styles.values}>
          {series.map((s) => (
            <View key={s.key} style={styles.valueItem}>
              <View style={[styles.dot, { backgroundColor: s.color }]} />
              <Text variant="caption" color="textSecondary">
                {s.label}
              </Text>
              <Text variant="caption" weight="semibold" tabular>
                {formatValue(s.values[active ?? lastIndex] ?? 0)}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {width > 0 && count > 0 ? (
        <Animated.View entering={FadeIn.duration(350)} key={count}>
          <Svg width={width} height={height}>
            <Defs>
              {series.map((s) => (
                <LinearGradient key={s.key} id={`fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={s.color} stopOpacity={0.22} />
                  <Stop offset="1" stopColor={s.color} stopOpacity={0} />
                </LinearGradient>
              ))}
            </Defs>
            {ticks(max).map((tick) => (
              <Line
                key={`grid-${tick}`}
                x1={AXIS_WIDTH}
                x2={width - RIGHT}
                y1={yAt(tick)}
                y2={yAt(tick)}
                stroke={colors.chartGrid}
                strokeDasharray={tick === 0 ? undefined : '4 4'}
              />
            ))}
            {ticks(max).map((tick) => (
              <SvgText
                key={`axis-${tick}`}
                x={AXIS_WIDTH - 8}
                y={yAt(tick) + 4}
                fontSize={10}
                fontFamily={fonts.medium}
                fill={colors.textMuted}
                textAnchor="end">
                {formatAxis(tick)}
              </SvgText>
            ))}
            {series.map((s) => {
              const points = s.values.map((v, i) => ({ x: xAt(i), y: yAt(v) }));
              const line = smoothPath(points);
              const area = `${line} L${xAt(count - 1)},${yAt(0)} L${xAt(0)},${yAt(0)} Z`;
              return (
                <Path key={`area-${s.key}`} d={area} fill={`url(#fill-${s.key})`} stroke="none" />
              );
            })}
            {series.map((s) => (
              <Path
                key={`line-${s.key}`}
                d={smoothPath(s.values.map((v, i) => ({ x: xAt(i), y: yAt(v) })))}
                stroke={s.color}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            ))}
            {active != null ? (
              <Line
                x1={xAt(active)}
                x2={xAt(active)}
                y1={TOP}
                y2={TOP + plotHeight}
                stroke={colors.borderStrong}
                strokeDasharray="3 3"
              />
            ) : null}
            {series.map((s) => {
              const i = active ?? lastIndex;
              return (
                <Circle
                  key={`dot-${s.key}`}
                  cx={xAt(i)}
                  cy={yAt(s.values[i] ?? 0)}
                  r={4.5}
                  fill={colors.surface}
                  stroke={s.color}
                  strokeWidth={2.5}
                />
              );
            })}
            {labels.map((label, i) =>
              i % step === 0 ? (
                <SvgText
                  key={`label-${i}`}
                  x={xAt(i)}
                  y={height - 6}
                  fontSize={10}
                  fontFamily={active === i ? fonts.semibold : fonts.regular}
                  fill={active === i ? colors.text : colors.textMuted}
                  textAnchor={
                    count > 1 && i === 0 ? 'start' : count > 1 && i === lastIndex ? 'end' : 'middle'
                  }>
                  {label}
                </SvgText>
              ) : null
            )}
          </Svg>
          <View style={[styles.hitRow, { left: xAt(0) - column / 2, width: column * count }]}>
            {labels.map((label, i) => (
              <Pressable
                key={`hit-${i}`}
                style={styles.hit}
                accessibilityRole="button"
                accessibilityLabel={`${label}: ${series
                  .map((s) => `${s.label} ${formatValue(s.values[i] ?? 0)}`)
                  .join(', ')}`}
                onPress={() => {
                  haptics.selection();
                  setSelected((current) => (current === i ? null : i));
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
    gap: 4,
  },
  values: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: spacing.lg,
    rowGap: 4,
  },
  valueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  hitRow: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    flexDirection: 'row',
  },
  hit: {
    flex: 1,
  },
});
