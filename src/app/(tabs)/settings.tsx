import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Card } from '@/components/ui/card';
import { confirm } from '@/components/ui/confirm';
import { Icon } from '@/components/ui/icon';
import { ListGroup, ListRow } from '@/components/ui/list-row';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Screen } from '@/components/ui/screen';
import { MenuButton } from '@/components/navigation/app-menu';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Section } from '@/components/ui/section';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { SelectField } from '@/components/ui/select-field';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { useToast } from '@/components/ui/toast';
import { useAccounts } from '@/features/accounts/hooks';
import { formatReminderTime } from '@/features/notifications/reminders';
import {
  remindersAvailable,
  remindersUnavailableReason,
  requestReminderPermission,
} from '@/features/notifications/scheduler';
import { useExportTransactions, useResetAllData } from '@/features/settings/hooks';
import { useSettings } from '@/features/settings/settings-provider';
import type { ThemeMode } from '@/features/settings/settings';
import { countOf } from '@/lib/text';
import {
  DATE_FORMATS,
  formatDate,
  todayISO,
  WEEK_STARTS,
  WEEKDAYS_LONG,
  type DateFormat,
  type WeekStart,
} from '@/lib/date';
import { useTheme } from '@/theme/theme-provider';
import { radius, spacing } from '@/theme/tokens';

function DateFormatSheet({
  visible,
  value,
  onClose,
  onChange,
}: {
  visible: boolean;
  value: DateFormat;
  onClose: () => void;
  onChange: (format: DateFormat) => void;
}) {
  const { colors } = useTheme();
  const today = todayISO();
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Date format">
      <FlatList
        data={DATE_FORMATS}
        keyExtractor={(f) => f}
        contentContainerStyle={styles.sheetList}
        renderItem={({ item }) => {
          const selected = item === value;
          return (
            <PressableScale
              haptic
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => {
                onChange(item);
                onClose();
              }}
              style={[styles.option, selected && { backgroundColor: colors.primaryMuted }]}>
              <View style={styles.flex}>
                <Text weight={selected ? 'semibold' : 'medium'}>{formatDate(today, item)}</Text>
                <Text variant="caption" color="textMuted">
                  {item}
                </Text>
              </View>
              {selected ? <Icon name="checkmark-circle" size={22} color="primary" /> : null}
            </PressableScale>
          );
        }}
      />
    </BottomSheet>
  );
}

function WeekStartSheet({
  visible,
  value,
  onClose,
  onChange,
}: {
  visible: boolean;
  value: WeekStart;
  onClose: () => void;
  onChange: (day: WeekStart) => void;
}) {
  const { colors } = useTheme();
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Week starts on">
      <FlatList
        data={WEEK_STARTS}
        keyExtractor={(day) => String(day)}
        contentContainerStyle={styles.sheetList}
        renderItem={({ item }) => {
          const selected = item === value;
          return (
            <PressableScale
              haptic
              accessibilityRole="radio"
              accessibilityLabel={WEEKDAYS_LONG[item]}
              accessibilityState={{ selected }}
              onPress={() => {
                onChange(item);
                onClose();
              }}
              style={[styles.option, selected && { backgroundColor: colors.primaryMuted }]}>
              <Text weight={selected ? 'semibold' : 'medium'} style={styles.flex}>
                {WEEKDAYS_LONG[item]}
              </Text>
              {selected ? <Icon name="checkmark-circle" size={22} color="primary" /> : null}
            </PressableScale>
          );
        }}
      />
    </BottomSheet>
  );
}

const REMINDER_TIMES = [
  '06:00',
  '07:00',
  '08:00',
  '09:00',
  '10:00',
  '12:00',
  '15:00',
  '18:00',
  '20:00',
  '21:00',
  '22:00',
];

function ReminderTimeSheet({
  visible,
  value,
  onClose,
  onChange,
}: {
  visible: boolean;
  value: string;
  onClose: () => void;
  onChange: (time: string) => void;
}) {
  const { colors } = useTheme();
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Remind me at">
      <FlatList
        data={REMINDER_TIMES}
        keyExtractor={(time) => time}
        contentContainerStyle={styles.sheetList}
        renderItem={({ item }) => {
          const selected = item === value;
          return (
            <PressableScale
              haptic
              accessibilityRole="radio"
              accessibilityLabel={formatReminderTime(item)}
              accessibilityState={{ selected }}
              onPress={() => {
                onChange(item);
                onClose();
              }}
              style={[styles.option, selected && { backgroundColor: colors.primaryMuted }]}>
              <Text weight={selected ? 'semibold' : 'medium'} style={styles.flex}>
                {formatReminderTime(item)}
              </Text>
              {selected ? <Icon name="checkmark-circle" size={22} color="primary" /> : null}
            </PressableScale>
          );
        }}
      />
    </BottomSheet>
  );
}

export default function SettingsScreen() {
  const { settings, currency, updateSettings, formatAmount } = useSettings();
  const toast = useToast();
  const [name, setName] = useState(settings.displayName);
  const [dateSheet, setDateSheet] = useState(false);
  const [timeSheet, setTimeSheet] = useState(false);
  const [weekSheet, setWeekSheet] = useState(false);
  const accounts = useAccounts({ includeArchived: false });
  const exportTransactions = useExportTransactions();
  const reset = useResetAllData();

  // Web cannot schedule them at all, and Expo Go refuses to load the module.
  const remindersSupported = remindersAvailable;

  const toggleReminders = async () => {
    if (settings.notificationsEnabled) {
      await save({ notificationsEnabled: false });
      toast.show('Reminders turned off');
      return;
    }
    const granted = await requestReminderPermission();
    if (!granted) {
      toast.error('Allow notifications for this app in your device settings first.');
      return;
    }
    await save({ notificationsEnabled: true });
    toast.success(`Reminders on · ${formatReminderTime(settings.notificationTime)}`);
  };

  const save = async (patch: Parameters<typeof updateSettings>[0]) => {
    try {
      await updateSettings(patch);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save the setting');
    }
  };

  const handleExport = async () => {
    try {
      const count = await exportTransactions.mutateAsync();
      toast.success(`Exported ${countOf(count, 'transaction')}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed');
    }
  };

  const handleReset = async () => {
    const ok = await confirm({
      title: 'Erase all data?',
      message:
        'Every transaction, attachment, account, type and source will be permanently deleted and the defaults restored. This cannot be undone.',
      confirmLabel: 'Erase everything',
    });
    if (!ok) return;
    try {
      await reset.mutateAsync();
      setName('');
      toast.success('All data erased');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Reset failed');
    }
  };

  return (
    <Screen safeTop keyboard>
      <ScreenHeader title="Settings" subtitle="Preferences & data" left={<MenuButton />} />

      <Card style={styles.profile}>
        <TextField
          label="Your name"
          icon="person-outline"
          value={name}
          onChangeText={setName}
          onBlur={() => {
            if (name.trim() !== settings.displayName) save({ displayName: name.trim() });
          }}
          onSubmitEditing={() => save({ displayName: name.trim() })}
          placeholder="Shown on your dashboard"
          returnKeyType="done"
          maxLength={40}
        />
      </Card>

      <Section title="Preferences" caption="How money and dates are shown">
        <ListGroup>
          <ListRow
            icon="cash-outline"
            title="Default currency"
            subtitle={currency.name}
            value={`${currency.code} · ${formatAmount(123456)}`}
            onPress={() => router.push('/currency')}
          />
          <ListRow
            icon="calendar-outline"
            title="Date format"
            subtitle={settings.dateFormat}
            value={formatDate(todayISO(), settings.dateFormat)}
            onPress={() => setDateSheet(true)}
          />
          <ListRow
            icon="today-outline"
            title="Week starts on"
            subtitle="Used by weekly budgets and “this week”"
            value={WEEKDAYS_LONG[settings.weekStartsOn]}
            onPress={() => setWeekSheet(true)}
          />
        </ListGroup>
      </Section>

      <Section title="Appearance" caption="Light, dark or whatever the system uses">
        <Card>
          <SegmentedControl<ThemeMode>
            value={settings.themeMode}
            onChange={(themeMode) => save({ themeMode })}
            options={[
              { value: 'system', label: 'System', icon: 'phone-portrait-outline' },
              { value: 'light', label: 'Light', icon: 'sunny-outline' },
              { value: 'dark', label: 'Dark', icon: 'moon-outline' },
            ]}
          />
        </Card>
      </Section>

      <Section title="New transactions" caption="What a new entry starts with">
        <Card>
          <SelectField
            label="Default account"
            value={settings.defaultAccountId}
            onChange={(defaultAccountId) => {
              if (defaultAccountId) save({ defaultAccountId });
            }}
            options={(accounts.data ?? []).map((a) => ({
              value: a.id,
              label: a.name,
              description: a.accountTypeName,
              icon: a.icon,
              color: a.color,
            }))}
          />
        </Card>
      </Section>

      <Section
        title="Notifications"
        caption={
          remindersSupported
            ? 'Reminders for what is due, on this device only'
            : (remindersUnavailableReason ?? 'Reminders are unavailable here')
        }>
        <ListGroup>
          <ListRow
            icon="notifications-outline"
            title="Reminders"
            subtitle={
              remindersSupported
                ? settings.notificationsEnabled
                  ? `Announced at ${formatReminderTime(settings.notificationTime)}`
                  : 'Off'
                : (remindersUnavailableReason ?? 'Unavailable')
            }
            value={remindersSupported ? (settings.notificationsEnabled ? 'On' : 'Off') : '—'}
            disabled={!remindersSupported}
            onPress={remindersSupported ? toggleReminders : undefined}
          />
          <ListRow
            icon="alarm-outline"
            title="Remind me at"
            subtitle="Everything due that day is announced at this time"
            value={formatReminderTime(settings.notificationTime)}
            disabled={!settings.notificationsEnabled}
            onPress={settings.notificationsEnabled ? () => setTimeSheet(true) : undefined}
          />
          <ListRow
            icon="repeat"
            title="Recurring entries"
            subtitle="When a manual entry is waiting to be marked paid"
            value={settings.notifyRecurring ? 'On' : 'Off'}
            disabled={!settings.notificationsEnabled}
            onPress={
              settings.notificationsEnabled
                ? () => save({ notifyRecurring: !settings.notifyRecurring })
                : undefined
            }
          />
          <ListRow
            icon="reader-outline"
            title="Outstanding payments"
            subtitle="When a payable or receivable reaches its due date"
            value={settings.notifyOutstanding ? 'On' : 'Off'}
            disabled={!settings.notificationsEnabled}
            onPress={
              settings.notificationsEnabled
                ? () => save({ notifyOutstanding: !settings.notifyOutstanding })
                : undefined
            }
          />
        </ListGroup>
      </Section>

      <Section title="Reports" caption="Statements you can share or print">
        <ListGroup>
          <ListRow
            icon="document-text-outline"
            title="Ledger report"
            subtitle="Statements with opening and closing balances, PDF or CSV"
            onPress={() => router.push('/reports/ledger')}
          />
          <ListRow
            icon="pie-chart-outline"
            title="Group report"
            subtitle="What each trip, project or event adds up to"
            onPress={() => router.push('/reports/groups')}
          />
        </ListGroup>
      </Section>

      <Section title="Data" caption="Everything stays on this device">
        <ListGroup>
          <ListRow
            icon="download-outline"
            title="Export transactions"
            subtitle="All income and expenses as a CSV spreadsheet"
            onPress={exportTransactions.isPending ? undefined : handleExport}
          />
          <ListRow
            icon="trash-outline"
            title="Erase all data"
            subtitle="Delete everything and start fresh"
            destructive
            onPress={reset.isPending ? undefined : handleReset}
          />
        </ListGroup>
      </Section>

      <View style={styles.about}>
        <Icon name="lock-closed" size={16} color="textMuted" />
        <Text variant="caption" color="textMuted" align="center">
          Your data is stored only on this device.
        </Text>
        <Text variant="micro" color="textMuted">
          Selftage v{Constants.expoConfig?.version ?? '1.0.0'}
        </Text>
      </View>

      <DateFormatSheet
        visible={dateSheet}
        value={settings.dateFormat}
        onClose={() => setDateSheet(false)}
        onChange={(dateFormat) => save({ dateFormat })}
      />
      <WeekStartSheet
        visible={weekSheet}
        value={settings.weekStartsOn}
        onClose={() => setWeekSheet(false)}
        onChange={(weekStartsOn) => save({ weekStartsOn })}
      />
      <ReminderTimeSheet
        visible={timeSheet}
        value={settings.notificationTime}
        onClose={() => setTimeSheet(false)}
        onChange={(notificationTime) => save({ notificationTime })}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  profile: {
    paddingVertical: spacing.md,
  },
  group: {
    gap: spacing.md,
  },
  about: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingTop: spacing.md,
  },
  sheetList: {
    paddingHorizontal: spacing.md,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
  },
});
