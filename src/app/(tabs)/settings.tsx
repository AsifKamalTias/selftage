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
import { ScreenHeader } from '@/components/ui/screen-header';
import { Section } from '@/components/ui/section';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { SelectField } from '@/components/ui/select-field';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { useToast } from '@/components/ui/toast';
import { useAccounts, useAccountTypes } from '@/features/accounts/hooks';
import { useCatalog } from '@/features/catalog/hooks';
import { useBudgetStatuses } from '@/features/budgets/hooks';
import { useExportTransactions, useResetAllData } from '@/features/settings/hooks';
import { useSettings } from '@/features/settings/settings-provider';
import type { ThemeMode } from '@/features/settings/settings';
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

export default function SettingsScreen() {
  const { settings, currency, updateSettings, formatAmount } = useSettings();
  const toast = useToast();
  const [name, setName] = useState(settings.displayName);
  const [dateSheet, setDateSheet] = useState(false);
  const [weekSheet, setWeekSheet] = useState(false);
  const accounts = useAccounts({ includeArchived: false });
  const accountTypes = useAccountTypes();
  const categories = useCatalog('categories');
  const sources = useCatalog('sources');
  const budgets = useBudgetStatuses({ includeInactive: true });
  const exportTransactions = useExportTransactions();
  const reset = useResetAllData();

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
      toast.success(`Exported ${count} transaction${count === 1 ? '' : 's'}`);
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

  const countLabel = (count: number | undefined, noun: string) =>
    count == null ? '' : `${count} ${noun}${count === 1 ? '' : 's'}`;

  const attention = (budgets.data ?? []).filter((b) => b.isActive && b.health !== 'ok').length;
  const budgetSubtitle = budgets.data?.length
    ? attention
      ? `${countLabel(budgets.data.length, 'budget')} · ${attention} need${attention === 1 ? 's' : ''} attention`
      : countLabel(budgets.data.length, 'budget')
    : 'Set daily, weekly or monthly limits';

  return (
    <Screen safeTop keyboard>
      <ScreenHeader title="Settings" subtitle="Preferences & data" />

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

      <Section title="Preferences">
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
        <Card style={styles.group}>
          <Text variant="label" color="textSecondary">
            Appearance
          </Text>
          <SegmentedControl<ThemeMode>
            value={settings.themeMode}
            onChange={(themeMode) => save({ themeMode })}
            options={[
              { value: 'system', label: 'System', icon: 'phone-portrait-outline' },
              { value: 'light', label: 'Light', icon: 'sunny-outline' },
              { value: 'dark', label: 'Dark', icon: 'moon-outline' },
            ]}
          />
          <SelectField
            label="Default account for new transactions"
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

      <Section title="Manage">
        <ListGroup>
          <ListRow
            icon="speedometer-outline"
            iconColor="#6366F1"
            title="Budgets"
            subtitle={budgetSubtitle}
            onPress={() => router.push('/budgets')}
          />
          <ListRow
            icon="pricetags-outline"
            iconColor="#F97316"
            title="Income & expense types"
            subtitle={countLabel(categories.data?.length, 'type')}
            onPress={() => router.push('/manage/types')}
          />
          <ListRow
            icon="people-outline"
            iconColor="#EC4899"
            title="Sources"
            subtitle={countLabel(sources.data?.length, 'source')}
            onPress={() => router.push('/manage/sources')}
          />
          <ListRow
            icon="wallet-outline"
            iconColor="#10B981"
            title="Accounts"
            subtitle={countLabel(accounts.data?.length, 'active account')}
            onPress={() => router.push('/manage/accounts')}
          />
          <ListRow
            icon="albums-outline"
            iconColor="#3B82F6"
            title="Account types"
            subtitle={countLabel(accountTypes.data?.length, 'type')}
            onPress={() => router.push('/manage/account-types')}
          />
        </ListGroup>
      </Section>

      <Section title="Reports & data">
        <ListGroup>
          <ListRow
            icon="document-text-outline"
            title="Ledger report"
            subtitle="Statements with opening & closing balances, PDF/CSV"
            onPress={() => router.push('/reports/ledger')}
          />
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
