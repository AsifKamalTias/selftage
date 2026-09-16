import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { useSettings } from '@/features/settings/settings-provider';
import { addDays, parseISODate, toISODate, todayISO } from '@/lib/date';
import { useTheme } from '@/theme/theme-provider';
import { radius, spacing } from '@/theme/tokens';

import { BottomSheet } from './bottom-sheet';
import { Button } from './button';
import { Chip } from './chip';
import { Icon } from './icon';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

export interface DateFieldProps {
  label: string;
  /** YYYY-MM-DD, or null when optional and empty. */
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  shortcuts?: boolean;
  clearable?: boolean;
  minimumDate?: string;
  maximumDate?: string;
  error?: string | null;
}

export function DateField({
  label,
  value,
  onChange,
  placeholder = 'Select date',
  shortcuts = false,
  clearable = false,
  minimumDate,
  maximumDate,
  error,
}: DateFieldProps) {
  const { colors } = useTheme();
  const { formatDate } = useSettings();
  const [iosOpen, setIosOpen] = useState(false);
  const [iosDraft, setIosDraft] = useState(() => parseISODate(value ?? todayISO()));

  const current = parseISODate(value ?? todayISO());
  const min = minimumDate ? parseISODate(minimumDate) : undefined;
  const max = maximumDate ? parseISODate(maximumDate) : undefined;

  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: current,
        mode: 'date',
        minimumDate: min,
        maximumDate: max,
        onValueChange: (_event, date) => onChange(toISODate(date)),
      });
    } else {
      setIosDraft(current);
      setIosOpen(true);
    }
  };

  const today = todayISO();
  const yesterday = toISODate(addDays(new Date(), -1));

  return (
    <View style={styles.container}>
      <Text variant="label" color="textSecondary">
        {label}
      </Text>
      <PressableScale
        scaleTo={0.99}
        onPress={open}
        accessibilityLabel={`${label}: ${value ? formatDate(value) : placeholder}`}
        style={[
          styles.field,
          { borderColor: error ? colors.danger : colors.border, backgroundColor: colors.surface },
        ]}>
        <Icon name="calendar-outline" size={18} color="textMuted" />
        <Text
          style={styles.text}
          color={value ? 'text' : 'textMuted'}
          weight={value ? 'medium' : 'regular'}>
          {value ? formatDate(value) : placeholder}
        </Text>
        {clearable && value ? (
          <PressableScale
            onPress={() => onChange(null)}
            hitSlop={10}
            accessibilityLabel={`Clear ${label}`}>
            <Icon name="close-circle" size={18} color="textMuted" />
          </PressableScale>
        ) : (
          <Icon name="chevron-down" size={18} color="textMuted" />
        )}
      </PressableScale>
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

      {Platform.OS === 'ios' ? (
        <BottomSheet
          visible={iosOpen}
          onClose={() => setIosOpen(false)}
          title={label}
          footer={
            <Button
              title="Done"
              onPress={() => {
                onChange(toISODate(iosDraft));
                setIosOpen(false);
              }}
            />
          }>
          <View style={styles.picker}>
            <DateTimePicker
              value={iosDraft}
              mode="date"
              display="inline"
              accentColor={colors.primary}
              minimumDate={min}
              maximumDate={max}
              onValueChange={(_event, date) => setIosDraft(date)}
            />
          </View>
        </BottomSheet>
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
  text: {
    flex: 1,
  },
  shortcuts: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  picker: {
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
});
