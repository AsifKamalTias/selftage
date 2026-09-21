import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { DateField } from '@/components/ui/date-field';
import { SelectField } from '@/components/ui/select-field';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { useToast } from '@/components/ui/toast';
import type { Installment, Obligation } from '@/db/types';
import { useAccounts } from '@/features/accounts/hooks';
import { useCatalog } from '@/features/catalog/hooks';
import { useSettings } from '@/features/settings/settings-provider';
import { todayISO } from '@/lib/date';
import { minorToInput, parseAmountInput, sanitizeAmountInput } from '@/lib/money';
import { spacing } from '@/theme/tokens';

import { useSettleObligation } from '../hooks';

/**
 * Records money changing hands for an outstanding record — either a whole installment
 * or any amount at all. A receivable posts income, a payable posts an expense.
 */
export function SettleSheet({
  obligation,
  installment,
  visible,
  onClose,
  onSettled,
}: {
  obligation: Obligation;
  /** Set when settling one installment; the amount is then fixed to it. */
  installment?: Installment | null;
  visible: boolean;
  onClose: () => void;
  onSettled?: (remaining: number) => void;
}) {
  const { settings, currency, formatAmount } = useSettings();
  const toast = useToast();
  const isReceivable = obligation.direction === 'receivable';
  const kind = isReceivable ? 'income' : 'expense';
  const accounts = useAccounts({ includeArchived: false });
  const categories = useCatalog('categories', kind);
  const settle = useSettleObligation();

  const [amountText, setAmountText] = useState('');
  const [accountId, setAccountId] = useState<string | null>(settings.defaultAccountId);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(todayISO());
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState<string | null>(null);

  // Reset whenever the sheet opens for a different installment or record.
  const nextKey = visible ? (installment?.id ?? obligation.id) : null;
  if (key !== nextKey) {
    setKey(nextKey);
    if (visible) {
      const suggested = installment
        ? Math.min(installment.amount, obligation.remaining)
        : obligation.remaining;
      setAmountText(minorToInput(suggested));
      setAccountId(settings.defaultAccountId);
      setCategoryId(obligation.categoryId);
      setDate(todayISO());
      setNote('');
      setError(null);
    }
  }

  const amount = parseAmountInput(amountText);
  const quick = installment
    ? []
    : [
        { label: 'Everything left', value: obligation.remaining },
        ...(obligation.remaining > 1
          ? [{ label: 'Half', value: Math.round(obligation.remaining / 2) }]
          : []),
      ];

  const submit = async () => {
    if (!categoryId) {
      setError('Choose the type to record this under');
      return;
    }
    if (!accountId) {
      setError('Choose an account');
      return;
    }
    if (amount == null || amount <= 0) {
      setError('Enter an amount greater than zero');
      return;
    }
    if (amount > obligation.remaining) {
      setError(`Only ${formatAmount(obligation.remaining)} is still outstanding`);
      return;
    }
    try {
      const result = await settle.mutateAsync({
        obligationId: obligation.id,
        installmentId: installment?.id ?? null,
        amount,
        accountId,
        categoryId,
        date: date ?? todayISO(),
        note: note.trim() || null,
      });
      toast.success(
        result.remaining === 0
          ? `${obligation.title} is fully settled`
          : `${formatAmount(amount)} recorded · ${formatAmount(result.remaining)} left`
      );
      onClose();
      onSettled?.(result.remaining);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not record this payment');
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={isReceivable ? 'Record money received' : 'Record a payment'}
      maxHeight={0.92}
      footer={
        <Button
          title={isReceivable ? 'Record receipt' : 'Record payment'}
          icon="checkmark-done"
          loading={settle.isPending}
          onPress={submit}
        />
      }>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card muted elevated={false} style={styles.summary}>
          <Text variant="caption" color="textSecondary">
            {installment
              ? `Installment ${installment.sequence} of ${obligation.title}`
              : obligation.title}
            {' · '}
            {obligation.contactName}
          </Text>
          <View style={styles.summaryRow}>
            <Text variant="caption" color="textMuted">
              Outstanding
            </Text>
            <Text variant="callout" weight="bold">
              {formatAmount(obligation.remaining)}
            </Text>
          </View>
          <Text variant="micro" color="textMuted">
            This posts {isReceivable ? 'an income' : 'an expense'} entry to your ledger.
          </Text>
        </Card>

        <TextField
          label="Amount"
          value={amountText}
          onChangeText={(text) => {
            setAmountText(sanitizeAmountInput(text));
            setError(null);
          }}
          prefix={currency.symbol.trim()}
          placeholder="0.00"
          keyboardType="decimal-pad"
          inputMode="decimal"
          error={error}
        />

        {quick.length > 0 ? (
          <View style={styles.chips}>
            {quick.map((option) => (
              <Chip
                key={option.label}
                label={`${option.label} · ${formatAmount(option.value)}`}
                selected={amount === option.value}
                onPress={() => {
                  setAmountText(minorToInput(option.value));
                  setError(null);
                }}
              />
            ))}
          </View>
        ) : null}

        <SelectField
          label={isReceivable ? 'Record as income type' : 'Record as expense type'}
          placeholder="Choose a type"
          value={categoryId}
          options={(categories.data ?? []).map((category) => ({
            value: category.id,
            label: category.name,
            icon: category.icon,
            color: category.color,
          }))}
          onChange={(value) => {
            setCategoryId(value);
            setError(null);
          }}
        />

        <SelectField
          label={isReceivable ? 'Received into' : 'Paid from'}
          placeholder="Choose an account"
          value={accountId}
          options={(accounts.data ?? []).map((account) => ({
            value: account.id,
            label: account.name,
            description: account.accountTypeName,
            icon: account.icon,
            color: account.color,
          }))}
          onChange={(value) => {
            setAccountId(value);
            setError(null);
          }}
        />

        <DateField
          label={isReceivable ? 'Received on' : 'Paid on'}
          value={date}
          onChange={setDate}
          shortcuts
        />

        <TextField
          label="Note"
          value={note}
          onChangeText={setNote}
          placeholder="Optional"
          maxLength={200}
        />
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  summary: {
    gap: spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: -spacing.sm,
  },
});
