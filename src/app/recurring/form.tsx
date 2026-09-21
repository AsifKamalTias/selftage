import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { confirm } from '@/components/ui/confirm';
import { DateField } from '@/components/ui/date-field';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { ScreenLoader } from '@/components/ui/loader';
import { Screen } from '@/components/ui/screen';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { SelectField } from '@/components/ui/select-field';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { useToast } from '@/components/ui/toast';
import {
  RECURRENCE_FREQUENCIES,
  type EntryKind,
  type RecurrenceFrequency,
  type RecurringRule,
} from '@/db/types';
import { useAccounts } from '@/features/accounts/hooks';
import { GroupField } from '@/features/groups/components/group-field';
import { useCatalog } from '@/features/catalog/hooks';
import {
  useDeleteRecurringRule,
  useRecurringRule,
  useSaveRecurringRule,
  useToggleRecurringRule,
} from '@/features/recurring/hooks';
import { useRecurringRun } from '@/features/recurring/recurring-runner';
import {
  describeRecurrence,
  FREQUENCY_LABELS,
  occurrencesThrough,
} from '@/features/recurring/schedule';
import { MAX_CATCHUP_PER_RULE } from '@/features/recurring/runner';
import { useSettings } from '@/features/settings/settings-provider';
import { formatDate, todayISO } from '@/lib/date';
import { minorToInput, parseAmountInput, sanitizeAmountInput } from '@/lib/money';
import { goBack } from '@/lib/navigation';
import { useTheme } from '@/theme/theme-provider';
import { spacing } from '@/theme/tokens';

const INTERVAL_OPTIONS = [1, 2, 3, 4, 6, 12];

export default function RecurringFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data, isPending } = useRecurringRule(id);
  if (id && isPending) return <ScreenLoader />;
  if (id && !data) return <EmptyState icon="search-outline" title="Recurring not found" />;
  return <RecurringForm key={data?.id ?? 'new'} existing={data ?? null} />;
}

function RecurringForm({ existing }: { existing: RecurringRule | null }) {
  const { colors } = useTheme();
  const { settings, currency, formatAmount } = useSettings();
  const toast = useToast();
  const save = useSaveRecurringRule();
  const toggle = useToggleRecurringRule();
  const remove = useDeleteRecurringRule();
  const runRecurring = useRecurringRun();

  const [kind, setKind] = useState<EntryKind>(existing?.kind ?? 'expense');
  const [name, setName] = useState(existing?.name ?? '');
  const [amountText, setAmountText] = useState(existing ? minorToInput(existing.amount) : '');
  const [categoryId, setCategoryId] = useState<string | null>(existing?.categoryId ?? null);
  const [sourceId, setSourceId] = useState<string | null>(existing?.sourceId ?? null);
  const [accountId, setAccountId] = useState<string | null>(
    existing?.accountId ?? settings.defaultAccountId
  );
  const [frequency, setFrequency] = useState<RecurrenceFrequency>(existing?.frequency ?? 'monthly');
  const [intervalCount, setIntervalCount] = useState(existing?.intervalCount ?? 1);
  const [startDate, setStartDate] = useState<string | null>(existing?.startDate ?? todayISO());
  const [groupId, setGroupId] = useState<string | null>(existing?.groupId ?? null);
  const [note, setNote] = useState(existing?.note ?? '');
  const [errors, setErrors] = useState<{
    name?: string;
    amount?: string;
    categoryId?: string;
    accountId?: string;
    startDate?: string;
  }>({});

  const categories = useCatalog('categories', kind);
  const sources = useCatalog('sources', kind);
  const accounts = useAccounts({ includeArchived: false });
  const tint = kind === 'income' ? colors.income : colors.expense;
  const amount = parseAmountInput(amountText);
  const today = todayISO();

  // Entries dated before today are posted as soon as the rule is saved.
  const backfill =
    !existing && startDate && startDate < today
      ? occurrencesThrough(
          { startDate, frequency, intervalCount },
          startDate,
          today,
          MAX_CATCHUP_PER_RULE
        ).length
      : 0;

  const changeKind = (next: EntryKind) => {
    setKind(next);
    setCategoryId(null);
    setSourceId(null);
  };

  const submit = async () => {
    const nextErrors: typeof errors = {};
    if (!name.trim()) nextErrors.name = 'Name is required';
    if (amount == null || amount <= 0) nextErrors.amount = 'Enter an amount greater than zero';
    if (!categoryId) nextErrors.categoryId = `Choose an ${kind} type`;
    if (!accountId) nextErrors.accountId = 'Choose an account';
    if (!startDate) nextErrors.startDate = 'Choose a start date';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    try {
      await save.mutateAsync({
        id: existing?.id,
        input: {
          kind,
          name: name.trim(),
          amount: amount!,
          categoryId: categoryId!,
          sourceId,
          accountId: accountId!,
          note: note.trim() || null,
          groupId,
          frequency,
          intervalCount,
          startDate: startDate!,
        },
      });
      toast.success(existing ? 'Recurring updated' : 'Recurring added');
      goBack('/recurring');
      // Post anything already due (including a start date in the past).
      await runRecurring();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save this recurring');
    }
  };

  const handleToggle = async () => {
    if (!existing) return;
    try {
      await toggle.mutateAsync({ id: existing.id, isActive: !existing.isActive });
      toast.success(existing.isActive ? 'Recurring paused' : 'Recurring resumed');
      goBack('/recurring');
      if (!existing.isActive) await runRecurring();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update this recurring');
    }
  };

  const handleDelete = async () => {
    if (!existing) return;
    const ok = await confirm({
      title: `Delete ${existing.name}?`,
      message: existing.postedCount
        ? `The ${existing.postedCount} transaction(s) already posted stay in your history; only the schedule is removed.`
        : 'The schedule will be removed. Nothing else changes.',
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(existing.id);
      toast.success('Recurring deleted');
      goBack('/recurring');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not delete this recurring');
    }
  };

  return (
    <Screen
      keyboard
      safeBottom
      footer={
        <Button
          title={existing ? 'Save changes' : 'Add recurring'}
          icon="checkmark"
          tint={tint}
          loading={save.isPending}
          onPress={submit}
        />
      }>
      <Stack.Screen options={{ title: existing ? 'Edit recurring' : 'New recurring' }} />

      <SegmentedControl
        value={kind}
        onChange={changeKind}
        options={[
          { value: 'expense', label: 'Expense', icon: 'arrow-up', activeColor: colors.expense },
          { value: 'income', label: 'Income', icon: 'arrow-down', activeColor: colors.income },
        ]}
      />

      <TextField
        label="Name"
        value={name}
        onChangeText={(value) => {
          setName(value);
          setErrors((e) => ({ ...e, name: undefined }));
        }}
        placeholder={kind === 'income' ? 'e.g. Monthly salary' : 'e.g. House rent'}
        maxLength={60}
        error={errors.name}
        autoFocus={!existing}
      />

      <TextField
        label="Amount"
        value={amountText}
        onChangeText={(text) => {
          setAmountText(sanitizeAmountInput(text));
          setErrors((e) => ({ ...e, amount: undefined }));
        }}
        prefix={currency.symbol.trim()}
        placeholder="0.00"
        keyboardType="decimal-pad"
        inputMode="decimal"
        error={errors.amount}
      />

      <SelectField
        label={kind === 'income' ? 'Income type' : 'Expense type'}
        placeholder="Choose a type"
        value={categoryId}
        options={(categories.data ?? []).map((c) => ({
          value: c.id,
          label: c.name,
          icon: c.icon,
          color: c.color,
        }))}
        onChange={(value) => {
          setCategoryId(value);
          setErrors((e) => ({ ...e, categoryId: undefined }));
        }}
        error={errors.categoryId}
      />

      <SelectField
        label={kind === 'income' ? 'Received from' : 'Paid to'}
        placeholder="Choose a source (optional)"
        value={sourceId}
        options={(sources.data ?? []).map((s) => ({
          value: s.id,
          label: s.name,
          icon: s.icon,
          color: s.color,
        }))}
        onChange={setSourceId}
        clearable
      />

      <SelectField
        label={kind === 'income' ? 'Add to account' : 'Deduct from account'}
        placeholder="Choose an account"
        value={accountId}
        options={(accounts.data ?? []).map((a) => ({
          value: a.id,
          label: a.name,
          description: a.accountTypeName,
          icon: a.icon,
          color: a.color,
        }))}
        onChange={(value) => {
          setAccountId(value);
          setErrors((e) => ({ ...e, accountId: undefined }));
        }}
        error={errors.accountId}
      />

      <GroupField
        value={groupId}
        onChange={setGroupId}
        hint="Group every entry this posts (optional)"
      />

      <View style={styles.group}>
        <Text variant="label" color="textSecondary">
          Repeats
        </Text>
        <SegmentedControl
          size="sm"
          value={frequency}
          onChange={setFrequency}
          options={RECURRENCE_FREQUENCIES.map((value) => ({
            value,
            label: FREQUENCY_LABELS[value],
          }))}
        />
      </View>

      <View style={styles.group}>
        <Text variant="label" color="textSecondary">
          Every
        </Text>
        <View style={styles.chips}>
          {INTERVAL_OPTIONS.map((value) => (
            <Chip
              key={value}
              label={
                value === 1
                  ? `Every ${FREQUENCY_UNIT[frequency]}`
                  : `${value} ${FREQUENCY_UNIT_PLURAL[frequency]}`
              }
              selected={intervalCount === value}
              onPress={() => setIntervalCount(value)}
            />
          ))}
        </View>
      </View>

      <DateField
        label="Starts from"
        value={startDate}
        onChange={(value) => {
          setStartDate(value);
          setErrors((e) => ({ ...e, startDate: undefined }));
        }}
        shortcuts
        error={errors.startDate}
      />

      <TextField
        label="Note"
        value={note}
        onChangeText={setNote}
        placeholder="Added to every entry (optional)"
        multiline
        maxLength={500}
      />

      {startDate ? (
        <Card muted elevated={false} style={styles.preview}>
          <View style={styles.previewRow}>
            <Icon name="repeat" size={16} color="primary" />
            <Text variant="caption" color="textSecondary" style={styles.previewText}>
              {describeRecurrence(frequency, intervalCount, startDate)} ·{' '}
              {amount ? formatAmount(amount) : 'amount not set'} from{' '}
              {formatDate(startDate, settings.dateFormat)}
            </Text>
          </View>
          {backfill > 0 ? (
            <View style={styles.previewRow}>
              <Icon name="information-circle" size={16} color="warning" />
              <Text variant="caption" color="warning" style={styles.previewText}>
                {backfill} entr{backfill === 1 ? 'y' : 'ies'} for dates already passed will be added
                right away.
              </Text>
            </View>
          ) : null}
        </Card>
      ) : null}

      {existing ? (
        <View style={styles.actions}>
          <Button
            title={existing.isActive ? 'Pause' : 'Resume'}
            icon={existing.isActive ? 'pause-outline' : 'play-outline'}
            variant="outline"
            loading={toggle.isPending}
            onPress={handleToggle}
          />
          <Button
            title="Delete recurring"
            icon="trash-outline"
            variant="danger"
            loading={remove.isPending}
            onPress={handleDelete}
          />
          <Text variant="caption" color="textMuted" align="center">
            Changes apply to future entries. Anything already posted stays in your history.
          </Text>
        </View>
      ) : null}
    </Screen>
  );
}

const FREQUENCY_UNIT: Record<RecurrenceFrequency, string> = {
  daily: 'day',
  weekly: 'week',
  monthly: 'month',
  yearly: 'year',
};

const FREQUENCY_UNIT_PLURAL: Record<RecurrenceFrequency, string> = {
  daily: 'days',
  weekly: 'weeks',
  monthly: 'months',
  yearly: 'years',
};

const styles = StyleSheet.create({
  group: {
    gap: spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  preview: {
    gap: spacing.sm,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  previewText: {
    flex: 1,
  },
  actions: {
    gap: spacing.md,
    marginTop: spacing.md,
  },
});
