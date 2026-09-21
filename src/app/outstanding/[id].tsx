import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Amount } from '@/components/ui/amount';
import { Button, IconButton } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { confirm } from '@/components/ui/confirm';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { ListRow } from '@/components/ui/list-row';
import { ScreenLoader } from '@/components/ui/loader';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { Text } from '@/components/ui/text';
import { useToast } from '@/components/ui/toast';
import type { Installment } from '@/db/types';
import { ContactAvatar } from '@/features/contacts/components/contact-avatar';
import { describeDue } from '@/features/outstanding/components/obligation-card';
import { SettleSheet } from '@/features/outstanding/components/settle-sheet';
import { useDeleteObligation, useInstallments, useObligation } from '@/features/outstanding/hooks';
import { useSettings } from '@/features/settings/settings-provider';
import { TransactionRow } from '@/features/transactions/components/transaction-row';
import { useTransactionList } from '@/features/transactions/hooks';
import { countOf, verbFor } from '@/lib/text';
import { todayISO } from '@/lib/date';
import { goBack } from '@/lib/navigation';
import { useTheme } from '@/theme/theme-provider';
import { radius, spacing } from '@/theme/tokens';

function InstallmentRow({
  item,
  onSettle,
  disabled,
}: {
  item: Installment;
  onSettle: () => void;
  disabled: boolean;
}) {
  const { colors } = useTheme();
  const { formatDate } = useSettings();
  const paid = !!item.transactionId;
  const due = describeDue(item.dueDate);

  return (
    <View style={styles.installment}>
      <View
        style={[
          styles.sequence,
          { backgroundColor: paid ? `${colors.income}1A` : colors.surfaceMuted },
        ]}>
        {paid ? (
          <Icon name="checkmark" size={15} color="income" />
        ) : (
          <Text variant="micro" weight="bold" color="textSecondary">
            {item.sequence}
          </Text>
        )}
      </View>
      <View style={styles.installmentText}>
        <Amount value={item.amount} variant="callout" weight="semibold" />
        <Text variant="micro" color={paid ? 'textMuted' : due.tone}>
          {paid ? `Paid ${formatDate(item.paidDate ?? item.dueDate)}` : due.text}
          {!paid ? ` · ${formatDate(item.dueDate)}` : ''}
        </Text>
      </View>
      {paid ? (
        <PressableScale
          onPress={() =>
            router.push({ pathname: '/transaction/[id]', params: { id: item.transactionId! } })
          }
          accessibilityLabel={`Open the entry for installment ${item.sequence}`}>
          <Icon name="receipt-outline" size={18} color="textMuted" />
        </PressableScale>
      ) : (
        <Button title="Settle" size="sm" variant="outline" disabled={disabled} onPress={onSettle} />
      )}
    </View>
  );
}

export default function ObligationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { formatAmount, formatDate } = useSettings();
  const toast = useToast();
  const { data: obligation, isPending } = useObligation(id);
  const installments = useInstallments(id);
  const payments = useTransactionList({ obligationId: id, sort: 'newest' });
  const remove = useDeleteObligation();
  const [settling, setSettling] = useState<Installment | null | 'free'>(null);

  if (isPending) return <ScreenLoader />;
  if (!obligation) {
    return (
      <EmptyState
        icon="search-outline"
        title="Record not found"
        message="It may have been deleted."
        action={{ label: 'Back to outstanding', onPress: () => goBack('/outstanding') }}
      />
    );
  }

  const isReceivable = obligation.direction === 'receivable';
  const tint = isReceivable ? colors.income : colors.expense;
  const due = describeDue(obligation.dueDate, todayISO());
  const progress = obligation.amount > 0 ? obligation.settled / obligation.amount : 0;
  const entries = payments.data?.pages.flat() ?? [];

  const handleDelete = async () => {
    const ok = await confirm({
      title: `Delete ${obligation.title}?`,
      message: obligation.paymentCount
        ? `The ${countOf(obligation.paymentCount, 'payment')} already recorded ${verbFor(
            obligation.paymentCount,
            'stays',
            'stay'
          )} in your ledger; only this record is removed.`
        : 'This record will be removed.',
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(obligation.id);
      toast.success('Record deleted');
      goBack('/outstanding');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not delete the record');
    }
  };

  return (
    <Screen safeBottom>
      <Stack.Screen
        options={{
          title: obligation.title,
          headerRight: () => (
            <IconButton
              icon="create-outline"
              variant="plain"
              accessibilityLabel="Edit record"
              onPress={() =>
                router.push({ pathname: '/outstanding/form', params: { id: obligation.id } })
              }
            />
          ),
        }}
      />

      <Card style={styles.hero}>
        <PressableScale
          onPress={() =>
            router.push({ pathname: '/contacts/[id]', params: { id: obligation.contactId } })
          }
          accessibilityLabel={`Open ${obligation.contactName}`}
          style={styles.contact}>
          <ContactAvatar
            name={obligation.contactName}
            photoUri={obligation.contactPhotoUri}
            size={40}
          />
          <View style={styles.contactText}>
            <Text variant="callout" weight="semibold" numberOfLines={1}>
              {obligation.contactName}
            </Text>
            <Text variant="micro" color="textMuted">
              {isReceivable ? 'Owes you' : 'You owe them'}
            </Text>
          </View>
          <Icon name="chevron-forward" size={16} color="textMuted" />
        </PressableScale>

        <View style={styles.amountBlock}>
          <Text variant="micro" color="textMuted" uppercase>
            {obligation.isSettled ? 'Settled in full' : 'Still outstanding'}
          </Text>
          <Amount
            value={obligation.remaining}
            variant="display"
            weight="bold"
            color={obligation.isSettled ? 'income' : isReceivable ? 'income' : 'expense'}
          />
          <Text variant="caption" color="textMuted">
            {formatAmount(obligation.settled)} of {formatAmount(obligation.amount)} settled
          </Text>
        </View>

        <ProgressBar value={progress} color={tint} height={8} />

        <View style={[styles.dueRow, { backgroundColor: colors.surfaceMuted }]}>
          <Icon
            name={obligation.isSettled ? 'checkmark-circle' : 'calendar-outline'}
            size={14}
            color={obligation.isSettled ? 'income' : due.tone}
          />
          <Text
            variant="label"
            weight="semibold"
            color={obligation.isSettled ? 'income' : due.tone}>
            {obligation.isSettled
              ? `Closed ${obligation.lastPaymentDate ? formatDate(obligation.lastPaymentDate) : ''}`
              : due.text}
          </Text>
        </View>
      </Card>

      {obligation.isSettled ? null : (
        <Button
          title={isReceivable ? 'Record money received' : 'Record a payment'}
          icon="checkmark-done"
          tint={tint}
          onPress={() => setSettling('free')}
        />
      )}

      {obligation.note ? (
        <Section title="Note">
          <Card>
            <Text color="textSecondary">{obligation.note}</Text>
          </Card>
        </Section>
      ) : null}

      {installments.data && installments.data.length > 0 ? (
        <Section
          title="Installments"
          caption={`${obligation.paidInstallments} of ${installments.data.length} settled`}>
          <Card style={styles.installments}>
            {installments.data.map((item) => (
              <InstallmentRow
                key={item.id}
                item={item}
                disabled={obligation.remaining <= 0}
                onSettle={() => setSettling(item)}
              />
            ))}
          </Card>
        </Section>
      ) : null}

      <Section
        title="Payments"
        caption={
          obligation.paymentCount
            ? `${countOf(obligation.paymentCount, 'payment')} in your ledger`
            : undefined
        }>
        {entries.length > 0 ? (
          <Card padded={false} style={styles.payments}>
            {entries.map((item) => (
              <TransactionRow key={item.id} item={item} showDate />
            ))}
          </Card>
        ) : (
          <Card padded={false}>
            <EmptyState
              compact
              icon="wallet-outline"
              title="Nothing settled yet"
              message={
                isReceivable
                  ? 'Record money as it comes in — each receipt posts to your ledger.'
                  : 'Record each payment as you make it — every one posts to your ledger.'
              }
            />
          </Card>
        )}
      </Section>

      <ListRow
        icon="calendar-outline"
        title={obligation.dueDate ? formatDate(obligation.dueDate) : 'No due date'}
        subtitle={`Opened ${formatDate(obligation.date)}`}
      />

      <Button
        title="Delete record"
        icon="trash-outline"
        variant="danger"
        loading={remove.isPending}
        onPress={handleDelete}
      />

      <SettleSheet
        obligation={obligation}
        installment={settling === 'free' ? null : settling}
        visible={settling !== null}
        onClose={() => setSettling(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: spacing.md,
  },
  contact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  contactText: {
    flex: 1,
    gap: 1,
  },
  amountBlock: {
    alignItems: 'center',
    gap: 2,
  },
  dueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs + 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
  },
  installments: {
    gap: spacing.md,
  },
  installment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  sequence: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  installmentText: {
    flex: 1,
    gap: 1,
  },
  payments: {
    overflow: 'hidden',
  },
});
