import { StyleSheet, View } from 'react-native';

import { addDays, toISODate, todayISO } from '@/lib/date';
import { useTheme } from '@/theme/theme-provider';
import { fonts, radius, spacing } from '@/theme/tokens';

import { Chip } from './chip';
import type { DateFieldProps } from './date-field';
import { Icon } from './icon';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

/** Web uses the browser's native date input. */
export function DateField({
  label,
  value,
  onChange,
  shortcuts = false,
  clearable = false,
  minimumDate,
  maximumDate,
  error,
}: DateFieldProps) {
  const { colors, isDark } = useTheme();
  const today = todayISO();
  const yesterday = toISODate(addDays(new Date(), -1));

  return (
    <View style={styles.container}>
      <Text variant="label" color="textSecondary">
        {label}
      </Text>
      <View
        style={[
          styles.field,
          { borderColor: error ? colors.danger : colors.border, backgroundColor: colors.surface },
        ]}>
        <Icon name="calendar-outline" size={18} color="textMuted" />
        <input
          type="date"
          aria-label={label}
          value={value ?? ''}
          min={minimumDate}
          max={maximumDate}
          onChange={(event) => onChange(event.target.value || null)}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: value ? colors.text : colors.textMuted,
            fontFamily: `${fonts.medium}, system-ui, sans-serif`,
            fontSize: 15,
            colorScheme: isDark ? 'dark' : 'light',
            minWidth: 0,
          }}
        />
        {clearable && value ? (
          <PressableScale
            onPress={() => onChange(null)}
            hitSlop={10}
            accessibilityLabel={`Clear ${label}`}>
            <Icon name="close-circle" size={18} color="textMuted" />
          </PressableScale>
        ) : null}
      </View>
      {shortcuts ? (
        <View style={styles.shortcuts}>
          <Chip label="Today" selected={value === today} onPress={() => onChange(today)} />
          <Chip
            label="Yesterday"
            selected={value === yesterday}
            onPress={() => onChange(yesterday)}
          />
        </View>
      ) : null}
      {error ? (
        <Text variant="caption" color="danger">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs + 2,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 50,
    borderWidth: 1.5,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md + 2,
    gap: spacing.sm,
  },
  shortcuts: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
});
