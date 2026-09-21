import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { DateField } from '@/components/ui/date-field';
import { EmptyState } from '@/components/ui/empty-state';
import { ScreenLoader } from '@/components/ui/loader';
import { Screen } from '@/components/ui/screen';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { SelectField } from '@/components/ui/select-field';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { useToast } from '@/components/ui/toast';
import type { Obligation, ObligationDirection } from '@/db/types';
import { useCatalog } from '@/features/catalog/hooks';
import { useContacts } from '@/features/contacts/hooks';
import { useObligation, useSaveObligation } from '@/features/outstanding/hooks';
import {
  INSTALLMENT_FREQUENCIES,
  planInstallments,
  type InstallmentFrequency,
} from '@/features/outstanding/repository';
import { useSettings } from '@/features/settings/settings-provider';
import { addDays, formatDate, toISODate, todayISO } from '@/lib/date';
import { minorToInput, parseAmountInput, sanitizeAmountInput } from '@/lib/money';
import { goBack } from '@/lib/navigation';
import { useTheme } from '@/theme/theme-provider';
import { spacing } from '@/theme/tokens';

const COUNTS = [2, 3, 4, 6, 12];

export default function ObligationFormScreen() {
  const { id, contactId, direction } = useLocalSearchParams<{
    id?: string;
    contactId?: string;
    direction?: string;
  }>();
  const { data, isPending } = useObligation(id);
  if (id && isPending) return <ScreenLoader />;
  if (id && !data) return <EmptyState icon="search-outline" title="Record not found" />;
  return (
    <ObligationForm
      key={data?.id ?? 'new'}
      existing={data ?? null}
      defaultContactId={contactId}
      defaultDirection={direction === 'payable' ? 'payable' : 'receivable'}
    />
  );
}

function ObligationForm({
  existing,
  defaultContactId,
  defaultDirection,
}: {
  existing: Obligation | null;
  defaultContactId?: string;
  defaultDirection: ObligationDirection;
}) {
  const { colors } = useTheme();
  const { currency, settings, formatAmount } = useSettings();
  const toast = useToast();
  const contacts = useContacts();
  const save = useSaveObligation();

  const [contactId, setContactId] = useState<string | null>(
    existing?.contactId ?? defaultContactId ?? null
  );
  const [dir, setDir] = useState<ObligationDirection>(existing?.direction ?? defaultDirection);
  const [title, setTitle] = useState(existing?.title ?? '');
  const [amountText, setAmountText] = useState(existing ? minorToInput(existing.amount) : '');
  const [date, setDate] = useState<string | null>(existing?.date ?? todayISO());
  const [dueDate, setDueDate] = useState<string | null>(
    existing?.dueDate ?? toISODate(addDays(new Date(), 30))
  );
  const [categoryId, setCategoryId] = useState<string | null>(existing?.categoryId ?? null);
  const [note, setNote] = useState(existing?.note ?? '');
  const [byInstallments, setByInstallments] = useState(false);
  const [count, setCount] = useState(3);
  const [frequency, setFrequency] = useState<InstallmentFrequency>('monthly');
  const [startDate, setStartDate] = useState<string | null>(toISODate(addDays(new Date(), 30)));
  const [errors, setErrors] = useState<{ contactId?: string; title?: string; amount?: string }>({});

  const categories = useCatalog('categories', dir === 'receivable' ? 'income' : 'expense');
  const amount = parseAmountInput(amountText);
  const preview =
    byInstallments && amount && amount > 0 && startDate
      ? planInstallments(amount, { count, frequency, startDate })
      : [];

  const submit = async () => {
    const next: typeof errors = {};
    if (!contactId) next.contactId = 'Choose a contact';
    if (!title.trim()) next.title = 'Add a short title';
    if (amount == null || amount <= 0) next.amount = 'Enter an amount greater than zero';
    setErrors(next);
    if (Object.keys(next).length) return;

    try {
      const id = await save.mutateAsync({
        id: existing?.id,
        input: {
          contactId: contactId!,
          direction: dir,
          title: title.trim(),
          amount: amount!,
          categoryId,
          date: date ?? todayISO(),
          dueDate,
          note: note.trim() || null,
        },
        plan: !existing && byInstallments && startDate ? { count, frequency, startDate } : null,
      });
      toast.success(existing ? 'Record updated' : 'Record added');
      goBack(existing ? { pathname: '/outstanding/[id]', params: { id } } : '/outstanding');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save the record');
    }
  };

  return (
    <Screen
      keyboard
      safeBottom
      footer={
        <Button
          title={existing ? 'Save changes' : 'Add record'}
          icon="checkmark"
          loading={save.isPending}
          onPress={submit}
        />
      }>
      <Stack.Screen options={{ title: existing ? 'Edit record' : 'New record' }} />

      <SegmentedControl
        value={dir}
        onChange={(next) => {
          setDir(next);
          setCategoryId(null);
        }}
        options={[
          {
            value: 'receivable',
            label: 'They owe me',
            icon: 'arrow-down',
            activeColor: colors.income,
          },
          { value: 'payable', label: 'I owe them', icon: 'arrow-up', activeColor: colors.expense },
        ]}
      />

      <SelectField
        label="Contact"
        placeholder="Choose a contact"
        value={contactId}
        options={(contacts.data ?? []).map((contact) => ({
          value: contact.id,
          label: contact.name,
          description: contact.phone ?? undefined,
        }))}
        onChange={(value) => {
          setContactId(value);
          setErrors((e) => ({ ...e, contactId: undefined }));
        }}
        error={errors.contactId}
        onCreate={() => router.push('/contacts/form')}
        createLabel="New contact"
      />

      <TextField
        label="What is it for"
        value={title}
        onChangeText={(value) => {
          setTitle(value);
          setErrors((e) => ({ ...e, title: undefined }));
        }}
        placeholder={dir === 'receivable' ? 'e.g. Loan to Rahim' : 'e.g. Borrowed for repairs'}
        maxLength={80}
        error={errors.title}
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
        hint={
          existing && existing.settled > 0
            ? `${formatAmount(existing.settled)} already settled`
            : undefined
        }
      />

      <SelectField
        label={dir === 'receivable' ? 'Income type when received' : 'Expense type when paid'}
        placeholder="Choose a type (optional)"
        value={categoryId}
        options={(categories.data ?? []).map((category) => ({
          value: category.id,
          label: category.name,
          icon: category.icon,
          color: category.color,
        }))}
        onChange={setCategoryId}
        clearable
      />

      <DateField label="Date" value={date} onChange={setDate} shortcuts />
      <DateField label="Due date" value={dueDate} onChange={setDueDate} clearable />

      <TextField
        label="Note"
        value={note}
        onChangeText={setNote}
        placeholder="Terms, what it covers, anything to remember"
        multiline
        maxLength={500}
      />

      {existing ? null : (
        <Card style={styles.plan}>
          <View style={styles.planText}>
            <Text variant="callout" weight="semibold">
              How it gets settled
            </Text>
            <Text variant="micro" color="textMuted">
              A schedule is optional — either way you can settle any amount at any time.
            </Text>
          </View>
          <SegmentedControl
            size="sm"
            value={byInstallments ? 'installments' : 'open'}
            onChange={(value) => setByInstallments(value === 'installments')}
            options={[
              { value: 'open', label: 'Whenever', icon: 'time-outline' },
              { value: 'installments', label: 'Installments', icon: 'list-outline' },
            ]}
          />

          {byInstallments ? (
            <>
              <View style={styles.group}>
                <Text variant="label" color="textSecondary">
                  How many
                </Text>
                <View style={styles.chips}>
                  {COUNTS.map((value) => (
                    <Chip
                      key={value}
                      label={`${value}×`}
                      selected={count === value}
                      onPress={() => setCount(value)}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.group}>
                <Text variant="label" color="textSecondary">
                  How often
                </Text>
                <SegmentedControl
                  size="sm"
                  value={frequency}
                  onChange={setFrequency}
                  options={INSTALLMENT_FREQUENCIES.map((option) => ({
                    value: option.value,
                    label: option.label,
                  }))}
                />
              </View>

              <DateField label="First installment" value={startDate} onChange={setStartDate} />

              {preview.length > 0 ? (
                <View style={styles.preview}>
                  <Text variant="micro" color="textMuted">
                    {preview.length} × {formatAmount(preview[0].amount)}
                    {preview[preview.length - 1].amount !== preview[0].amount
                      ? ` (last ${formatAmount(preview[preview.length - 1].amount)})`
                      : ''}
                    {' · first on '}
                    {formatDate(preview[0].dueDate, settings.dateFormat)}
                    {' · last on '}
                    {formatDate(preview[preview.length - 1].dueDate, settings.dateFormat)}
                  </Text>
                </View>
              ) : null}
            </>
          ) : null}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  plan: {
    gap: spacing.lg,
  },
  planText: {
    flex: 1,
    gap: 2,
  },
  group: {
    gap: spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  preview: {
    marginTop: -spacing.sm,
  },
});
