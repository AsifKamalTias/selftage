import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Amount } from '@/components/ui/amount';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { DateField } from '@/components/ui/date-field';
import { SelectField } from '@/components/ui/select-field';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { useToast } from '@/components/ui/toast';
import type { Goal } from '@/db/types';
import { useAccounts } from '@/features/accounts/hooks';
import { useSettings } from '@/features/settings/settings-provider';
import { todayISO } from '@/lib/date';
import { minorToInput, parseAmountInput, sanitizeAmountInput } from '@/lib/money';
import { spacing } from '@/theme/tokens';

import { useAccountAvailability, useReleaseFromGoal, useReserveForGoal } from '../hooks';

export type MoneyMode = 'reserve' | 'release';

/** Moves money between an account's available balance and the goal's reserve. */
export function GoalMoneySheet({
  goal,
  mode,
  visible,
  onClose,
  heldByAccount,
}: {
  goal: Goal;
  mode: MoneyMode;
  visible: boolean;
  onClose: () => void;
  /** Net held per account, used to cap a release. */
  heldByAccount: Map<string, number>;
}) {
  const { settings, currency, formatAmount } = useSettings();
  const toast = useToast();
  const accounts = useAccounts({ includeArchived: false });
  const reserve = useReserveForGoal();
  const release = useReleaseFromGoal();

  const [accountId, setAccountId] = useState<string | null>(settings.defaultAccountId);
  const [amountText, setAmountText] = useState('');
  const [date, setDate] = useState<string | null>(todayISO());
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [wasVisible, setWasVisible] = useState(visible);

  // Start fresh every time the sheet opens.
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setAmountText('');
      setNote('');
      setError(null);
      setDate(todayISO());
      if (mode === 'release') {
        const [first] = [...heldByAccount.entries()].filter(([, held]) => held > 0);
        setAccountId(first ? first[0] : settings.defaultAccountId);
      } else {
        setAccountId(settings.defaultAccountId);
      }
    }
  }

  const availability = useAccountAvailability(mode === 'reserve' ? accountId : null);
  const held = accountId ? (heldByAccount.get(accountId) ?? 0) : 0;
  const ceiling = mode === 'reserve' ? (availability.data?.available ?? 0) : Math.max(0, held);
  const remainingToTarget = Math.max(0, goal.targetAmount - goal.saved);
  const amount = parseAmountInput(amountText);

  const options = (accounts.data ?? [])
    .filter((account) => mode === 'reserve' || (heldByAccount.get(account.id) ?? 0) > 0)
    .map((account) => ({
      value: account.id,
      label: account.name,
      description:
        mode === 'reserve'
          ? `${formatAmount(account.available)} available`
          : `${formatAmount(heldByAccount.get(account.id) ?? 0)} held`,
      icon: account.icon,
      color: account.color,
    }));

  const quickAmounts = [
    ...(mode === 'reserve' && remainingToTarget > 0 && remainingToTarget <= ceiling
      ? [{ label: 'Rest of goal', value: remainingToTarget }]
      : []),
    ...(ceiling > 0
      ? [{ label: mode === 'reserve' ? 'All available' : 'All held', value: ceiling }]
      : []),
  ];

  const submit = async () => {
    if (!accountId) {
      setError('Choose an account');
      return;
    }
    if (amount == null || amount <= 0) {
      setError('Enter an amount greater than zero');
      return;
    }
    if (amount > ceiling) {
      setError(
        mode === 'reserve'
          ? `Only ${formatAmount(ceiling)} is available in that account`
          : `This goal holds ${formatAmount(ceiling)} from that account`
      );
      return;
    }
    try {
      const input = {
        goalId: goal.id,
        accountId,
        amount,
        date: date ?? todayISO(),
        note: note.trim() || null,
      };
      if (mode === 'reserve') {
        await reserve.mutateAsync(input);
        toast.success(`${formatAmount(amount)} held for ${goal.name}`);
      } else {
        await release.mutateAsync(input);
        toast.success(`${formatAmount(amount)} released back`);
      }
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not move the money');
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={mode === 'reserve' ? 'Hold money for this goal' : 'Release money'}
      maxHeight={0.9}
      footer={
        <Button
          title={mode === 'reserve' ? 'Hold money' : 'Release'}
          icon={mode === 'reserve' ? 'lock-closed-outline' : 'lock-open-outline'}
          loading={reserve.isPending || release.isPending}
          onPress={submit}
        />
      }>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text variant="caption" color="textSecondary">
          {mode === 'reserve'
            ? 'The money stays in the account but is set aside for this goal, so it no longer counts as available.'
            : 'Released money becomes available in the account again.'}
        </Text>

        <SelectField
          label={mode === 'reserve' ? 'Hold from account' : 'Return to account'}
          placeholder="Choose an account"
          value={accountId}
          options={options}
          onChange={(value) => {
            setAccountId(value);
            setError(null);
          }}
        />

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
          hint={
            mode === 'reserve'
              ? `${formatAmount(ceiling)} available · ${formatAmount(remainingToTarget)} left to reach the target`
              : `${formatAmount(ceiling)} held from this account`
          }
        />

        {quickAmounts.length > 0 ? (
          <View style={styles.chips}>
            {quickAmounts.map((quick) => (
              <Chip
                key={quick.label}
                label={`${quick.label} · ${formatAmount(quick.value)}`}
                selected={amount === quick.value}
                onPress={() => {
                  setAmountText(minorToInput(quick.value));
                  setError(null);
                }}
              />
            ))}
          </View>
        ) : null}

        <DateField label="Date" value={date} onChange={setDate} shortcuts />

        <TextField
          label="Note"
          value={note}
          onChangeText={setNote}
          placeholder="Optional"
          maxLength={200}
        />

        <View style={styles.summary}>
          <Text variant="caption" color="textMuted">
            After this, the goal holds
          </Text>
          <Amount
            value={goal.saved + (amount ?? 0) * (mode === 'reserve' ? 1 : -1)}
            variant="subheading"
            weight="bold"
          />
        </View>
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
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: -spacing.sm,
  },
  summary: {
    alignItems: 'center',
    gap: 2,
  },
});
