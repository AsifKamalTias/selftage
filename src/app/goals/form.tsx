import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ColorPicker } from '@/components/ui/color-picker';
import { DateField } from '@/components/ui/date-field';
import { EmptyState } from '@/components/ui/empty-state';
import { IconBadge } from '@/components/ui/icon-badge';
import { IconPicker } from '@/components/ui/icon-picker';
import { ScreenLoader } from '@/components/ui/loader';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { useToast } from '@/components/ui/toast';
import type { Goal } from '@/db/types';
import { useGoal, useSaveGoal } from '@/features/goals/hooks';
import { describeDeadline, goalProgress } from '@/features/goals/progress';
import { useSettings } from '@/features/settings/settings-provider';
import { addDays, toISODate, todayISO } from '@/lib/date';
import { minorToInput, parseAmountInput, sanitizeAmountInput } from '@/lib/money';
import { goBack } from '@/lib/navigation';
import { spacing } from '@/theme/tokens';

export default function GoalFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data, isPending } = useGoal(id);
  if (id && isPending) return <ScreenLoader />;
  if (id && !data) return <EmptyState icon="search-outline" title="Goal not found" />;
  return <GoalForm key={data?.id ?? 'new'} existing={data ?? null} />;
}

function GoalForm({ existing }: { existing: Goal | null }) {
  const { currency, formatAmount } = useSettings();
  const toast = useToast();
  const save = useSaveGoal();

  const [name, setName] = useState(existing?.name ?? '');
  const [amountText, setAmountText] = useState(existing ? minorToInput(existing.targetAmount) : '');
  const [targetDate, setTargetDate] = useState<string | null>(
    existing?.targetDate ?? toISODate(addDays(new Date(), 90))
  );
  const [note, setNote] = useState(existing?.note ?? '');
  const [icon, setIcon] = useState(existing?.icon ?? 'flag');
  const [color, setColor] = useState(existing?.color ?? '#6366F1');
  const [errors, setErrors] = useState<{ name?: string; amount?: string }>({});

  const target = parseAmountInput(amountText);
  const preview =
    target && target > 0
      ? goalProgress(
          {
            targetAmount: target,
            targetDate,
            saved: existing?.saved ?? 0,
            status: 'active',
            createdAt: existing?.createdAt ?? new Date().toISOString(),
          },
          todayISO()
        )
      : null;

  const submit = async () => {
    const nextErrors: typeof errors = {};
    if (!name.trim()) nextErrors.name = 'Name is required';
    if (target == null || target <= 0) nextErrors.amount = 'Enter a target greater than zero';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    try {
      const id = await save.mutateAsync({
        id: existing?.id,
        input: {
          name: name.trim(),
          targetAmount: target!,
          targetDate,
          note: note.trim() || null,
          icon,
          color,
        },
      });
      toast.success(existing ? 'Goal updated' : 'Goal created');
      goBack(existing ? { pathname: '/goals/[id]', params: { id } } : '/goals');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the goal');
    }
  };

  return (
    <Screen
      keyboard
      safeBottom
      footer={
        <Button
          title={existing ? 'Save changes' : 'Create goal'}
          icon="checkmark"
          loading={save.isPending}
          onPress={submit}
        />
      }>
      <Stack.Screen options={{ title: existing ? 'Edit goal' : 'New goal' }} />

      <Card style={styles.preview}>
        <IconBadge icon={icon} color={color} size={56} solid />
        <View style={styles.previewText}>
          <Text variant="subheading" numberOfLines={1}>
            {name.trim() || 'Goal name'}
          </Text>
          <Text variant="caption" color="textMuted">
            {target ? formatAmount(target) : 'Target amount'}
            {preview ? ` · ${describeDeadline(preview)}` : ''}
          </Text>
        </View>
      </Card>

      <TextField
        label="Goal name"
        value={name}
        onChangeText={(value) => {
          setName(value);
          setErrors((e) => ({ ...e, name: undefined }));
        }}
        placeholder="e.g. New laptop"
        maxLength={60}
        error={errors.name}
        autoFocus={!existing}
      />

      <TextField
        label="Target amount"
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

      <DateField
        label="Target date"
        value={targetDate}
        onChange={setTargetDate}
        clearable
        minimumDate={todayISO()}
      />
      {preview && targetDate ? (
        <Text variant="caption" color="textMuted" style={styles.hint}>
          {preview.remaining > 0 && preview.perDay > 0
            ? `Set aside about ${formatAmount(preview.perDay)} a day (${formatAmount(
                preview.perMonth
              )} a month) to get there.`
            : 'Clear the date if this goal has no deadline.'}
        </Text>
      ) : null}

      <TextField
        label="Note"
        value={note}
        onChangeText={setNote}
        placeholder="What is this for?"
        multiline
        maxLength={500}
      />

      <ColorPicker value={color} onChange={setColor} />
      <IconPicker value={icon} color={color} onChange={setIcon} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  previewText: {
    flex: 1,
    gap: 2,
  },
  hint: {
    marginTop: -spacing.sm,
  },
});
