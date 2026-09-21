import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DateField } from '@/components/ui/date-field';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { SelectField } from '@/components/ui/select-field';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { useToast } from '@/components/ui/toast';
import type { EntryKind, TransactionDetail } from '@/db/types';
import { useAccounts } from '@/features/accounts/hooks';
import {
  AttachmentGallery,
  type GalleryItem,
} from '@/features/attachments/components/attachment-gallery';
import {
  PermissionDeniedError,
  pickDocuments,
  pickImages,
  takePhoto,
} from '@/features/attachments/picker';
import { MAX_ATTACHMENTS_PER_TRANSACTION, type PickedFile } from '@/features/attachments/types';
import { useCatalog } from '@/features/catalog/hooks';
import { GroupField } from '@/features/groups/components/group-field';
import { useSettings } from '@/features/settings/settings-provider';
import { todayISO } from '@/lib/date';
import { newId } from '@/lib/id';
import { minorToInput, parseAmountInput, sanitizeAmountInput } from '@/lib/money';
import { goBack } from '@/lib/navigation';
import { useTheme } from '@/theme/theme-provider';
import { radius, spacing } from '@/theme/tokens';

import type { TransactionInput } from '../repository';

export interface TransactionFormResult {
  input: TransactionInput;
  added: PickedFile[];
  removedIds: string[];
}

export interface TransactionFormProps {
  /** Existing transaction when editing. */
  initial?: TransactionDetail;
  /** Prefill from another transaction (duplicate) without attachments. */
  template?: TransactionDetail;
  defaultKind?: EntryKind;
  /** Preselected date for new entries (the calendar adds one to a chosen day). */
  defaultDate?: string;
  submitLabel?: string;
  /** Resolve to reset the form for another entry; reject to keep values. */
  onSubmit: (result: TransactionFormResult) => Promise<void>;
  /** Offer "Save & add another" (new transactions only). */
  allowSaveAndNew?: boolean;
}

type FieldErrors = Partial<Record<'amount' | 'categoryId' | 'accountId' | 'date', string>>;

interface NewFile extends PickedFile {
  key: string;
}

export function TransactionForm({
  initial,
  template,
  defaultKind = 'expense',
  defaultDate,
  submitLabel = 'Save transaction',
  onSubmit,
  allowSaveAndNew = false,
}: TransactionFormProps) {
  const { colors } = useTheme();
  const { settings, currency } = useSettings();
  const toast = useToast();
  const seed = initial ?? template;

  const [kind, setKind] = useState<EntryKind>(seed?.kind ?? defaultKind);
  const [amountText, setAmountText] = useState(seed ? minorToInput(seed.amount) : '');
  const [categoryId, setCategoryId] = useState<string | null>(seed?.categoryId ?? null);
  const [sourceId, setSourceId] = useState<string | null>(seed?.sourceId ?? null);
  const [accountId, setAccountId] = useState<string | null>(
    seed?.accountId ?? settings.defaultAccountId
  );
  const [groupId, setGroupId] = useState<string | null>(seed?.groupId ?? null);
  const [date, setDate] = useState<string | null>(initial?.date ?? defaultDate ?? todayISO());
  const [title, setTitle] = useState(seed?.title ?? '');
  const [note, setNote] = useState(seed?.note ?? '');
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [newFiles, setNewFiles] = useState<NewFile[]>([]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState<'save' | 'save-new' | null>(null);

  const categories = useCatalog('categories', kind);
  const sources = useCatalog('sources', kind);
  const accounts = useAccounts();

  const accountOptions = (accounts.data ?? [])
    .filter((a) => !a.isArchived || a.id === initial?.accountId)
    .map((a) => ({
      value: a.id,
      label: a.name,
      description: a.accountTypeName,
      icon: a.icon,
      color: a.color,
    }));
  const categoryOptions = (categories.data ?? []).map((c) => ({
    value: c.id,
    label: c.name,
    icon: c.icon,
    color: c.color,
  }));
  const sourceOptions = (sources.data ?? []).map((s) => ({
    value: s.id,
    label: s.name,
    icon: s.icon,
    color: s.color,
  }));
  const selectedCategory = categoryOptions.find((c) => c.value === categoryId);

  const keptAttachments = (initial?.attachments ?? []).filter((a) => !removedIds.includes(a.id));
  const gallery: GalleryItem[] = [
    ...keptAttachments.map((a) => ({ key: a.id, ...a })),
    ...newFiles,
  ];
  const remainingSlots = MAX_ATTACHMENTS_PER_TRANSACTION - gallery.length;
  const tint = kind === 'income' ? colors.income : colors.expense;

  const changeKind = (next: EntryKind) => {
    setKind(next);
    // Types and sources are kind-specific.
    setCategoryId(null);
    setSourceId(null);
  };

  const addFiles = async (pick: () => Promise<PickedFile[]>) => {
    try {
      const picked = await pick();
      if (!picked.length) return;
      const accepted = picked.slice(0, remainingSlots);
      if (accepted.length < picked.length) {
        toast.show(`You can attach up to ${MAX_ATTACHMENTS_PER_TRANSACTION} files.`);
      }
      const withKeys = accepted.map((file) => ({ ...file, key: `new-${newId()}` }));
      setNewFiles((current) => [...current, ...withKeys]);
    } catch (error) {
      toast.error(
        error instanceof PermissionDeniedError
          ? error.message
          : 'Could not add the file. Please try again.'
      );
    }
  };

  const removeFile = (key: string) => {
    if (key.startsWith('new-')) {
      setNewFiles((current) => current.filter((f) => f.key !== key));
    } else {
      setRemovedIds((current) => [...current, key]);
    }
  };

  const validate = (): TransactionInput | null => {
    const next: FieldErrors = {};
    const amount = parseAmountInput(amountText);
    if (amount == null || amount <= 0) next.amount = 'Enter an amount greater than zero';
    if (!categoryId) next.categoryId = `Choose an ${kind} type`;
    if (!accountId) next.accountId = 'Choose an account';
    if (!date) next.date = 'Choose a date';
    setErrors(next);
    if (Object.keys(next).length > 0) return null;
    return {
      kind,
      amount: amount!,
      categoryId: categoryId!,
      sourceId,
      accountId: accountId!,
      title: title.trim(),
      note: note.trim() || null,
      date: date!,
      groupId,
    };
  };

  const submit = async (mode: 'save' | 'save-new') => {
    const input = validate();
    if (!input) {
      toast.error('Please fix the highlighted fields.');
      return;
    }
    setSubmitting(mode);
    try {
      await onSubmit({
        input,
        added: newFiles.map(({ key: _key, ...file }) => file),
        removedIds,
      });
      if (mode === 'save-new') {
        setAmountText('');
        setTitle('');
        setNote('');
        setNewFiles([]);
        setErrors({});
      } else {
        goBack('/transactions');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the transaction');
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <Screen
      keyboard
      safeBottom
      footer={
        <View style={styles.footer}>
          {allowSaveAndNew ? (
            <Button
              title="Save & new"
              variant="outline"
              loading={submitting === 'save-new'}
              disabled={submitting != null}
              onPress={() => submit('save-new')}
              style={styles.footerSecondary}
            />
          ) : null}
          <Button
            title={submitLabel}
            icon="checkmark"
            tint={tint}
            loading={submitting === 'save'}
            disabled={submitting != null}
            onPress={() => submit('save')}
            style={styles.footerPrimary}
          />
        </View>
      }>
      <SegmentedControl
        value={kind}
        onChange={changeKind}
        options={[
          { value: 'expense', label: 'Expense', icon: 'arrow-up', activeColor: colors.expense },
          { value: 'income', label: 'Income', icon: 'arrow-down', activeColor: colors.income },
        ]}
      />

      <Card style={[styles.amountCard, { borderColor: tint, borderWidth: 1.5 }]} elevated={false}>
        <Text variant="label" color="textSecondary" align="center">
          {kind === 'income' ? 'Amount received' : 'Amount spent'}
        </Text>
        <TextField
          size="xl"
          prefix={currency.symbol.trim()}
          value={amountText}
          onChangeText={(text) => {
            setAmountText(sanitizeAmountInput(text));
            if (errors.amount) setErrors((e) => ({ ...e, amount: undefined }));
          }}
          placeholder="0.00"
          keyboardType="decimal-pad"
          inputMode="decimal"
          autoFocus={!initial && Platform.OS !== 'web'}
          error={errors.amount}
          accessibilityLabel="Amount"
          containerStyle={styles.amountField}
        />
      </Card>

      <Section title="Details">
        <TextField
          label="Title"
          value={title}
          onChangeText={setTitle}
          placeholder={selectedCategory ? selectedCategory.label : 'e.g. Weekly groceries'}
          hint="Optional — defaults to the type name"
          maxLength={80}
          returnKeyType="next"
        />
        <SelectField
          label={kind === 'income' ? 'Income type' : 'Expense type'}
          placeholder="Choose a type"
          value={categoryId}
          options={categoryOptions}
          onChange={(value) => {
            setCategoryId(value);
            if (errors.categoryId) setErrors((e) => ({ ...e, categoryId: undefined }));
          }}
          error={errors.categoryId}
          onCreate={() => router.push({ pathname: '/manage/types/form', params: { kind } })}
          createLabel={`New ${kind} type`}
        />
        <SelectField
          label={kind === 'income' ? 'Received from' : 'Paid to'}
          placeholder="Choose a source (optional)"
          value={sourceId}
          options={sourceOptions}
          onChange={setSourceId}
          clearable
          onCreate={() => router.push({ pathname: '/manage/sources/form', params: { kind } })}
          createLabel={`New ${kind} source`}
        />
        <SelectField
          label={kind === 'income' ? 'Deposit to account' : 'Pay from account'}
          placeholder="Choose an account"
          value={accountId}
          options={accountOptions}
          onChange={(value) => {
            setAccountId(value);
            if (errors.accountId) setErrors((e) => ({ ...e, accountId: undefined }));
          }}
          error={errors.accountId}
          onCreate={() => router.push('/manage/accounts/form')}
          createLabel="New account"
        />
        <GroupField value={groupId} onChange={setGroupId} />
        <DateField label="Date" value={date} onChange={setDate} shortcuts error={errors.date} />
        <TextField
          label="Note"
          value={note}
          onChangeText={setNote}
          placeholder="Add details, reference numbers, etc."
          multiline
          maxLength={500}
        />
      </Section>

      <Section
        title="Attachments"
        caption={`Receipts, invoices or bills · ${gallery.length}/${MAX_ATTACHMENTS_PER_TRANSACTION}`}>
        {gallery.length > 0 ? <AttachmentGallery items={gallery} onRemove={removeFile} /> : null}
        <View style={styles.attachActions}>
          <Button
            title="Photo"
            icon="image-outline"
            variant="outline"
            size="sm"
            disabled={remainingSlots <= 0}
            onPress={() => addFiles(() => pickImages(remainingSlots))}
          />
          {Platform.OS !== 'web' ? (
            <Button
              title="Camera"
              icon="camera-outline"
              variant="outline"
              size="sm"
              disabled={remainingSlots <= 0}
              onPress={() => addFiles(takePhoto)}
            />
          ) : null}
          <Button
            title="Document"
            icon="document-attach-outline"
            variant="outline"
            size="sm"
            disabled={remainingSlots <= 0}
            onPress={() => addFiles(pickDocuments)}
          />
        </View>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  amountCard: {
    gap: spacing.sm,
    borderRadius: radius.xl,
  },
  amountField: {
    marginTop: spacing.xs,
  },
  attachActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  footerSecondary: {
    flex: 1.3,
  },
  footerPrimary: {
    flex: 2,
  },
});
