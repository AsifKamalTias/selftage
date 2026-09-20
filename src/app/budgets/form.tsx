import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { confirm } from '@/components/ui/confirm';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { ScreenLoader } from '@/components/ui/loader';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Screen } from '@/components/ui/screen';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { SelectField } from '@/components/ui/select-field';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { useToast } from '@/components/ui/toast';
import { BUDGET_PERIODS, type Budget, type BudgetPeriod } from '@/db/types';
import { HEALTH_COLOR } from '@/features/budgets/components/budget-progress-card';
import {
  useBudget,
  useDeleteBudget,
  useSaveBudget,
  useScopeSpending,
  useToggleBudget,
} from '@/features/budgets/hooks';
import { BUDGET_PERIOD_LABELS, BUDGET_PERIOD_WINDOW } from '@/features/budgets/period';
import { budgetHealth, DEFAULT_WARN_AT } from '@/features/budgets/repository';
import { useCatalog } from '@/features/catalog/hooks';
import { useSettings } from '@/features/settings/settings-provider';
import { minorToInput, parseAmountInput, sanitizeAmountInput } from '@/lib/money';
import { goBack } from '@/lib/navigation';
import { useTheme } from '@/theme/theme-provider';
import { spacing } from '@/theme/tokens';

const WARN_OPTIONS = [50, 60, 70, 80, 90];

type Scope = 'overall' | 'category';

export default function BudgetFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data, isPending } = useBudget(id);
  if (id && isPending) return <ScreenLoader />;
  if (id && !data) {
    return <EmptyState icon="search-outline" title="Budget not found" />;
  }
  return <BudgetForm key={data?.id ?? 'new'} existing={data ?? null} />;
}

function BudgetForm({ existing }: { existing: Budget | null }) {
  const { colors } = useTheme();
  const { currency, formatAmount } = useSettings();
  const toast = useToast();
  const save = useSaveBudget();
  const toggle = useToggleBudget();
  const remove = useDeleteBudget();
  const categories = useCatalog('categories', 'expense');

  const [scope, setScope] = useState<Scope>(existing?.categoryId ? 'category' : 'overall');
  const [categoryId, setCategoryId] = useState<string | null>(existing?.categoryId ?? null);
  const [period, setPeriod] = useState<BudgetPeriod>(existing?.period ?? 'monthly');
  const [amountText, setAmountText] = useState(existing ? minorToInput(existing.amount) : '');
  const [warnAt, setWarnAt] = useState(existing?.warnAt ?? DEFAULT_WARN_AT);
  const [errors, setErrors] = useState<{ amount?: string; category?: string }>({});

  const effectiveCategoryId = scope === 'category' ? categoryId : null;
  const spending = useScopeSpending(effectiveCategoryId, period);
  const amount = parseAmountInput(amountText);
  const spent = spending.data?.spent ?? 0;
  const progress = amount && amount > 0 ? spent / amount : 0;
  const health = budgetHealth(spent, amount ?? 0, warnAt);

  const submit = async () => {
    const nextErrors: typeof errors = {};
    if (amount == null || amount <= 0) nextErrors.amount = 'Enter a limit greater than zero';
    if (scope === 'category' && !categoryId) nextErrors.category = 'Choose an expense type';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    try {
      await save.mutateAsync({
        id: existing?.id,
        input: { categoryId: effectiveCategoryId, period, amount: amount!, warnAt },
      });
      toast.success(existing ? 'Budget updated' : 'Budget set');
      goBack('/budgets');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the budget');
    }
  };

  const handleToggle = async () => {
    if (!existing) return;
    try {
      await toggle.mutateAsync({ id: existing.id, isActive: !existing.isActive });
      toast.success(existing.isActive ? 'Budget paused' : 'Budget resumed');
      goBack('/budgets');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update the budget');
    }
  };

  const handleDelete = async () => {
    if (!existing) return;
    const ok = await confirm({
      title: 'Delete this budget?',
      message: 'Your transactions stay untouched — only the limit is removed.',
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(existing.id);
      toast.success('Budget deleted');
      goBack('/budgets');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not delete the budget');
    }
  };

  return (
    <Screen
      keyboard
      safeBottom
      footer={
        <Button
          title={existing ? 'Save changes' : 'Set budget'}
          icon="checkmark"
          loading={save.isPending}
          onPress={submit}
        />
      }>
      <Stack.Screen options={{ title: existing ? 'Edit budget' : 'New budget' }} />

      <SegmentedControl
        value={scope}
        onChange={(next) => {
          setScope(next);
          setErrors((e) => ({ ...e, category: undefined }));
        }}
        options={[
          { value: 'overall', label: 'All spending', icon: 'layers-outline' },
          { value: 'category', label: 'One type', icon: 'pricetag-outline' },
        ]}
      />

      {scope === 'category' ? (
        <SelectField
          label="Expense type"
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
            setErrors((e) => ({ ...e, category: undefined }));
          }}
          error={errors.category}
        />
      ) : null}

      <View style={styles.group}>
        <Text variant="label" color="textSecondary">
          Period
        </Text>
        <SegmentedControl
          value={period}
          onChange={setPeriod}
          options={BUDGET_PERIODS.map((value) => ({
            value,
            label: BUDGET_PERIOD_LABELS[value],
          }))}
        />
      </View>

      <TextField
        label={`${BUDGET_PERIOD_LABELS[period]} limit`}
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
        hint={`You've spent ${formatAmount(spent)} ${BUDGET_PERIOD_WINDOW[period]} in this scope.`}
      />

      {amount && amount > 0 ? (
        <Card muted elevated={false} style={styles.preview}>
          <View style={styles.previewHeader}>
            <Icon
              name={health === 'ok' ? 'checkmark-circle' : 'warning'}
              size={16}
              color={HEALTH_COLOR[health]}
            />
            <Text variant="caption" color="textSecondary" style={styles.previewText}>
              With this limit you are at{' '}
              <Text variant="caption" weight="bold" color={HEALTH_COLOR[health]}>
                {Math.round(progress * 100)}%
              </Text>{' '}
              {BUDGET_PERIOD_WINDOW[period]}
            </Text>
          </View>
          <ProgressBar value={progress} color={colors[HEALTH_COLOR[health]]} height={6} />
        </Card>
      ) : null}

      <View style={styles.group}>
        <Text variant="label" color="textSecondary">
          Warn me at
        </Text>
        <View style={styles.chips}>
          {WARN_OPTIONS.map((value) => (
            <Chip
              key={value}
              label={`${value}%`}
              selected={warnAt === value}
              onPress={() => setWarnAt(value)}
            />
          ))}
        </View>
        <Text variant="caption" color="textMuted">
          A warning appears once spending reaches {warnAt}% of the limit, and an alert when it is
          passed.
        </Text>
      </View>

      {existing ? (
        <View style={styles.actions}>
          <Button
            title={existing.isActive ? 'Pause budget' : 'Resume budget'}
            icon={existing.isActive ? 'pause-outline' : 'play-outline'}
            variant="outline"
            loading={toggle.isPending}
            onPress={handleToggle}
          />
          <Button
            title="Delete budget"
            icon="trash-outline"
            variant="danger"
            loading={remove.isPending}
            onPress={handleDelete}
          />
        </View>
      ) : null}
    </Screen>
  );
}

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
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
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
