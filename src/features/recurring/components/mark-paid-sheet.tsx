import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DateField } from '@/components/ui/date-field';
import { IconBadge } from '@/components/ui/icon-badge';
import { SelectField } from '@/components/ui/select-field';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { useToast } from '@/components/ui/toast';
import type { RecurringOccurrence } from '@/db/types';
import { useAccounts } from '@/features/accounts/hooks';
import { useSettings } from '@/features/settings/settings-provider';
import { todayISO } from '@/lib/date';
import { minorToInput, parseAmountInput, sanitizeAmountInput } from '@/lib/money';
import { spacing } from '@/theme/tokens';

import { useMarkOccurrencePaid } from '../hooks';

/**
 * Confirms a manual occurrence: the entry is posted on the day it was actually paid,
 * which may be the due date or any day after it.
 */
export function MarkPaidSheet({
  occurrence,
  visible,
  onClose,
}: {
  occurrence: RecurringOccurrence | null;
  visible: boolean;
  onClose: () => void;
}) {
  const { currency, formatAmount, formatDate } = useSettings();
  const toast = useToast();
  const accounts = useAccounts({ includeArchived: false });
  const markPaid = useMarkOccurrencePaid();

  const [amountText, setAmountText] = useState('');
  const [accountId, setAccountId] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState<string | null>(null);

  // Reload the defaults whenever a different occurrence opens the sheet.
  const nextKey = visible && occurrence ? occurrence.id : null;
  if (key !== nextKey) {
    setKey(nextKey);
    if (occurrence) {
      setAmountText(minorToInput(occurrence.amount));
      setAccountId(occurrence.accountId);
      // Paid today unless the due date is still ahead.
      setDate(occurrence.dueDate > todayISO() ? occurrence.dueDate : todayISO());
      setError(null);
    }
  }

  if (!occurrence) return null;

  const amount = parseAmountInput(amountText);
  const isIncome = occurrence.kind === 'income';

  const submit = async () => {
    if (amount == null || amount <= 0) {
      setError('Enter an amount greater than zero');
      return;
    }
    try {
      const result = await markPaid.mutateAsync({
        occurrenceId: occurrence.id,
        amount,
        accountId: accountId ?? occurrence.accountId,
        date: date ?? occurrence.dueDate,
      });
      toast.success(`${result.name} recorded · ${formatAmount(result.amount)}`);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not record this entry');
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={isIncome ? 'Mark as received' : 'Mark as paid'}
      maxHeight={0.9}
      footer={
        <Button
          title={isIncome ? 'Record as received' : 'Record as paid'}
          icon="checkmark-done"
          loading={markPaid.isPending}
          onPress={submit}
        />
      }>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card muted elevated={false} style={styles.summary}>
          <IconBadge
            icon={occurrence.categoryIcon}
            color={occurrence.categoryColor}
            size={40}
            solid
          />
          <View style={styles.summaryText}>
            <Text variant="callout" weight="semibold" numberOfLines={1}>
              {occurrence.name}
            </Text>
            <Text variant="micro" color="textMuted">
              {occurrence.categoryName} · due {formatDate(occurrence.dueDate)}
            </Text>
          </View>
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
          hint={`Scheduled for ${formatAmount(occurrence.amount)} — change it if the real amount differs`}
        />

        <SelectField
          label={isIncome ? 'Added to account' : 'Paid from account'}
          placeholder="Choose an account"
          value={accountId}
          options={(accounts.data ?? []).map((account) => ({
            value: account.id,
            label: account.name,
            description: account.accountTypeName,
            icon: account.icon,
            color: account.color,
          }))}
          onChange={setAccountId}
        />

        <DateField
          label={isIncome ? 'Received on' : 'Paid on'}
          value={date}
          onChange={setDate}
          shortcuts
        />

        <Text variant="caption" color="textMuted">
          This posts the entry to your ledger and clears it from the due list. The schedule itself
          keeps running.
        </Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  summaryText: {
    flex: 1,
    gap: 1,
  },
});
