import { StyleSheet, View } from 'react-native';

import { IconButton } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { parseISODate, todayISO, type WeekStart } from '@/lib/date';
import { useTheme } from '@/theme/theme-provider';
import { radius, spacing } from '@/theme/tokens';

import { monthGridDays } from '../grid';
import type { CalendarDay } from '../repository';

const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

function DayCell({
  date,
  totals,
  inMonth,
  selected,
  isToday,
  scale,
  onPress,
}: {
  date: string;
  totals: CalendarDay | undefined;
  inMonth: boolean;
  selected: boolean;
  isToday: boolean;
  /** Busiest income and expense day of the month, so each bar is read against its own kind. */
  scale: { income: number; expense: number };
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const day = parseISODate(date).getDate();
  const income = totals?.income ?? 0;
  const expense = totals?.expense ?? 0;
  // Relative to the busiest day of the same kind, with a floor that stays visible.
  const bar = (value: number, max: number) => (value > 0 ? Math.max(0.28, value / max) : 0);

  return (
    <PressableScale
      scaleTo={0.94}
      onPress={onPress}
      style={styles.cell}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${date}${totals ? `, ${totals.count} entries` : ', nothing recorded'}`}>
      <View
        style={[
          styles.cellInner,
          selected && { backgroundColor: colors.primary },
          !selected && isToday && { borderColor: colors.primary, borderWidth: 1.5 },
        ]}>
        <Text
          variant="caption"
          weight={isToday || selected ? 'bold' : 'medium'}
          color={selected ? 'onPrimary' : inMonth ? 'text' : 'textMuted'}
          tabular>
          {day}
        </Text>
        <View style={styles.bars}>
          <View style={styles.barSlot}>
            {income > 0 ? (
              <View
                style={[
                  styles.bar,
                  {
                    backgroundColor: selected ? colors.onPrimary : colors.income,
                    flex: bar(income, scale.income),
                  },
                ]}
              />
            ) : null}
          </View>
          <View style={styles.barSlot}>
            {expense > 0 ? (
              <View
                style={[
                  styles.bar,
                  {
                    backgroundColor: selected ? colors.onPrimary : colors.expense,
                    flex: bar(expense, scale.expense),
                  },
                ]}
              />
            ) : null}
          </View>
        </View>
      </View>
    </PressableScale>
  );
}

/**
 * A month of days with a bar per day for income and expense, so busy days stand out
 * before anything is selected.
 */
export function MonthGrid({
  monthStart,
  days,
  selected,
  weekStartsOn,
  onSelect,
  onChangeMonth,
}: {
  monthStart: Date;
  days: CalendarDay[];
  selected: string;
  weekStartsOn: WeekStart;
  onSelect: (date: string) => void;
  onChangeMonth: (delta: number) => void;
}) {
  const { colors } = useTheme();
  const today = todayISO();
  const byDate = new Map(days.map((day) => [day.date, day]));
  const scale = {
    income: Math.max(1, ...days.map((day) => day.income)),
    expense: Math.max(1, ...days.map((day) => day.expense)),
  };
  const grid = monthGridDays(monthStart, weekStartsOn);
  const month = monthStart.getMonth();

  const weekdays = Array.from(
    { length: 7 },
    (_, index) => WEEKDAY_INITIALS[(weekStartsOn + index) % 7]
  );

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <IconButton
          icon="chevron-back"
          variant="plain"
          accessibilityLabel="Previous month"
          onPress={() => onChangeMonth(-1)}
        />
        <Text variant="subheading" weight="semibold">
          {monthStart.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </Text>
        <IconButton
          icon="chevron-forward"
          variant="plain"
          accessibilityLabel="Next month"
          onPress={() => onChangeMonth(1)}
        />
      </View>

      <View style={styles.weekdays}>
        {weekdays.map((initial, index) => (
          <Text
            key={`${initial}-${index}`}
            variant="micro"
            color="textMuted"
            align="center"
            style={styles.weekday}>
            {initial}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {grid.map((date) => (
          <DayCell
            key={date}
            date={date}
            totals={byDate.get(date)}
            inMonth={parseISODate(date).getMonth() === month}
            selected={date === selected}
            isToday={date === today}
            scale={scale}
            onPress={() => onSelect(date)}
          />
        ))}
      </View>

      <View style={styles.legend}>
        <View style={[styles.dot, { backgroundColor: colors.income }]} />
        <Text variant="micro" color="textMuted">
          Income
        </Text>
        <View style={[styles.dot, { backgroundColor: colors.expense }]} />
        <Text variant="micro" color="textMuted">
          Expense
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  weekdays: {
    flexDirection: 'row',
  },
  weekday: {
    flex: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%`,
    paddingVertical: 2,
    paddingHorizontal: 1,
  },
  cellInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: 16,
  },
  barSlot: {
    width: 5,
    height: '100%',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderRadius: 2,
    minHeight: 3,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginLeft: spacing.sm,
  },
});
