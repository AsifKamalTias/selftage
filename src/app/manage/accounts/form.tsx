import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Amount } from '@/components/ui/amount';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { ColorPicker } from '@/components/ui/color-picker';
import { confirm } from '@/components/ui/confirm';
import { EmptyState } from '@/components/ui/empty-state';
import { IconBadge } from '@/components/ui/icon-badge';
import { IconPicker } from '@/components/ui/icon-picker';
import { ScreenLoader } from '@/components/ui/loader';
import { Screen } from '@/components/ui/screen';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { SelectField } from '@/components/ui/select-field';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { useToast } from '@/components/ui/toast';
import type { AccountWithBalance } from '@/db/types';
import {
  useAccount,
  useAccountTypes,
  useArchiveAccount,
  useDeleteAccount,
  useSaveAccount,
} from '@/features/accounts/hooks';
import { useSettings } from '@/features/settings/settings-provider';
import { minorToInput, parseAmountInput, sanitizeAmountInput } from '@/lib/money';
import { goBack } from '@/lib/navigation';
import { spacing } from '@/theme/tokens';

export default function AccountFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data, isPending } = useAccount(id);
  if (id && isPending) return <ScreenLoader />;
  if (id && !data) {
    return <EmptyState icon="search-outline" title="Account not found" />;
  }
  return <AccountForm key={data?.id ?? 'new'} existing={data ?? null} />;
}

type Sign = 'positive' | 'negative';

function AccountForm({ existing }: { existing: AccountWithBalance | null }) {
  const toast = useToast();
  const { settings, updateSettings, currency } = useSettings();
  const accountTypes = useAccountTypes();
  const save = useSaveAccount();
  const archive = useArchiveAccount();
  const remove = useDeleteAccount();

  const [name, setName] = useState(existing?.name ?? '');
  const [accountTypeId, setAccountTypeId] = useState<string | null>(
    existing?.accountTypeId ?? null
  );
  const [accountNumber, setAccountNumber] = useState(existing?.accountNumber ?? '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [icon, setIcon] = useState(existing?.icon ?? 'wallet');
  const [color, setColor] = useState(existing?.color ?? '#3B82F6');
  const [openingText, setOpeningText] = useState(
    existing?.openingBalance ? minorToInput(existing.openingBalance) : ''
  );
  const [sign, setSign] = useState<Sign>(
    (existing?.openingBalance ?? 0) < 0 ? 'negative' : 'positive'
  );
  const [makeDefault, setMakeDefault] = useState(
    existing ? settings.defaultAccountId === existing.id : false
  );
  const [errors, setErrors] = useState<{ name?: string; type?: string; opening?: string }>({});

  const typeOptions = (accountTypes.data ?? []).map((t) => ({
    value: t.id,
    label: t.name,
    icon: t.icon,
    color: t.color,
  }));

  const chooseType = (value: string | null) => {
    setAccountTypeId(value);
    setErrors((e) => ({ ...e, type: undefined }));
    const type = accountTypes.data?.find((t) => t.id === value);
    // Adopt the type's look for new accounts so they are recognisable at a glance.
    if (type && !existing) {
      setIcon(type.icon);
      setColor(type.color);
    }
  };

  const submit = async () => {
    const nextErrors: typeof errors = {};
    const opening = openingText ? parseAmountInput(openingText) : 0;
    if (!name.trim()) nextErrors.name = 'Name is required';
    if (!accountTypeId) nextErrors.type = 'Choose an account type';
    if (opening == null) nextErrors.opening = 'Enter a valid amount';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    try {
      const id = await save.mutateAsync({
        id: existing?.id,
        input: {
          name,
          accountTypeId: accountTypeId!,
          accountNumber: accountNumber.trim() || null,
          note: note.trim() || null,
          icon,
          color,
          openingBalance: sign === 'negative' ? -(opening ?? 0) : (opening ?? 0),
        },
      });
      if (makeDefault && settings.defaultAccountId !== id) {
        await updateSettings({ defaultAccountId: id });
      }
      toast.success(existing ? 'Account updated' : 'Account created');
      goBack('/manage/accounts');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save the account');
    }
  };

  const toggleArchive = async () => {
    if (!existing) return;
    try {
      await archive.mutateAsync({ id: existing.id, archived: !existing.isArchived });
      toast.success(existing.isArchived ? 'Account restored' : 'Account archived');
      goBack('/manage/accounts');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update the account');
    }
  };

  const handleDelete = async () => {
    if (!existing) return;
    const ok = await confirm({
      title: `Delete ${existing.name}?`,
      message: 'The account and its opening balance will be removed permanently.',
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(existing.id);
      toast.success('Account deleted');
      goBack('/manage/accounts');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not delete the account');
    }
  };

  const isDefault = existing != null && settings.defaultAccountId === existing.id;

  return (
    <Screen
      keyboard
      safeBottom
      footer={
        <Button
          title={existing ? 'Save changes' : 'Create account'}
          icon="checkmark"
          loading={save.isPending}
          onPress={submit}
        />
      }>
      <Stack.Screen options={{ title: existing ? 'Edit account' : 'New account' }} />

      <Card style={styles.preview}>
        <IconBadge icon={icon} color={color} size={56} solid />
        <View style={styles.flex}>
          <Text variant="subheading" numberOfLines={1}>
            {name.trim() || 'Account name'}
          </Text>
          <Text variant="caption" color="textMuted">
            {typeOptions.find((t) => t.value === accountTypeId)?.label ?? 'Account type'}
          </Text>
        </View>
        {existing ? <Amount value={existing.balance} variant="subheading" weight="bold" /> : null}
      </Card>

      <TextField
        label="Account name"
        value={name}
        onChangeText={(v) => {
          setName(v);
          setErrors((e) => ({ ...e, name: undefined }));
        }}
        placeholder="e.g. City Bank Savings"
        maxLength={40}
        error={errors.name}
        autoFocus={!existing}
      />
      <SelectField
        label="Account type"
        placeholder="Cash, Bank, Mobile Banking…"
        value={accountTypeId}
        options={typeOptions}
        onChange={chooseType}
        error={errors.type}
        onCreate={() => router.push('/manage/account-types/form')}
        createLabel="New account type"
      />
      <TextField
        label="Account / wallet number"
        value={accountNumber}
        onChangeText={setAccountNumber}
        placeholder="Optional"
        maxLength={40}
        icon="keypad-outline"
      />

      <View style={styles.group}>
        <TextField
          label="Opening balance"
          value={openingText}
          onChangeText={(t) => {
            setOpeningText(sanitizeAmountInput(t));
            setErrors((e) => ({ ...e, opening: undefined }));
          }}
          prefix={`${sign === 'negative' ? '-' : ''}${currency.symbol.trim()}`}
          placeholder="0.00"
          keyboardType="decimal-pad"
          error={errors.opening}
          hint="The amount in this account before you started tracking. Posted to the ledger as the first entry."
        />
        <SegmentedControl
          size="sm"
          value={sign}
          onChange={setSign}
          options={[
            { value: 'positive', label: 'Available funds' },
            { value: 'negative', label: 'Owed / overdrawn' },
          ]}
        />
      </View>

      <TextField
        label="Note"
        value={note}
        onChangeText={setNote}
        placeholder="Branch, purpose, etc."
        multiline
        maxLength={200}
      />

      <ColorPicker value={color} onChange={setColor} />
      <IconPicker value={icon} color={color} onChange={setIcon} />

      {!existing?.isArchived ? (
        <View style={styles.row}>
          <Chip
            label={isDefault ? 'Default account' : 'Use as default for new transactions'}
            icon={makeDefault ? 'checkmark-circle' : 'ellipse-outline'}
            selected={makeDefault}
            onPress={isDefault ? undefined : () => setMakeDefault(!makeDefault)}
          />
        </View>
      ) : null}

      {existing ? (
        <View style={styles.dangerZone}>
          <Button
            title={existing.isArchived ? 'Restore account' : 'Archive account'}
            icon={existing.isArchived ? 'arrow-undo-outline' : 'archive-outline'}
            variant="outline"
            loading={archive.isPending}
            onPress={toggleArchive}
          />
          <Button
            title="Delete account"
            icon="trash-outline"
            variant="danger"
            loading={remove.isPending}
            onPress={handleDelete}
          />
          <Text variant="caption" color="textMuted" align="center">
            Accounts with transactions can only be archived, so your history stays intact.
          </Text>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  group: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
  },
  dangerZone: {
    gap: spacing.md,
    marginTop: spacing.md,
  },
});
