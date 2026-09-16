import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ColorPicker } from '@/components/ui/color-picker';
import { confirm } from '@/components/ui/confirm';
import { EmptyState } from '@/components/ui/empty-state';
import { IconBadge } from '@/components/ui/icon-badge';
import { IconPicker } from '@/components/ui/icon-picker';
import { ScreenLoader } from '@/components/ui/loader';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { useToast } from '@/components/ui/toast';
import type { AccountType } from '@/db/types';
import {
  useAccountType,
  useDeleteAccountType,
  useSaveAccountType,
} from '@/features/accounts/hooks';
import { goBack } from '@/lib/navigation';
import { spacing } from '@/theme/tokens';

export default function AccountTypeFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data, isPending } = useAccountType(id);
  if (id && isPending) return <ScreenLoader />;
  if (id && !data) return <EmptyState icon="search-outline" title="Account type not found" />;
  return <AccountTypeForm key={data?.id ?? 'new'} existing={data ?? null} />;
}

function AccountTypeForm({ existing }: { existing: AccountType | null }) {
  const toast = useToast();
  const save = useSaveAccountType();
  const remove = useDeleteAccountType();
  const [name, setName] = useState(existing?.name ?? '');
  const [icon, setIcon] = useState(existing?.icon ?? 'wallet');
  const [color, setColor] = useState(existing?.color ?? '#3B82F6');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    try {
      await save.mutateAsync({ id: existing?.id, input: { name, icon, color } });
      toast.success(existing ? 'Changes saved' : `${name.trim()} added`);
      goBack('/manage/account-types');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save');
    }
  };

  const handleDelete = async () => {
    if (!existing) return;
    const ok = await confirm({ title: `Delete ${existing.name}?` });
    if (!ok) return;
    try {
      await remove.mutateAsync(existing.id);
      toast.success('Account type deleted');
      goBack('/manage/account-types');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not delete');
    }
  };

  return (
    <Screen
      keyboard
      safeBottom
      footer={
        <Button
          title={existing ? 'Save changes' : 'Add account type'}
          icon="checkmark"
          loading={save.isPending}
          onPress={submit}
        />
      }>
      <Stack.Screen options={{ title: existing ? 'Edit account type' : 'New account type' }} />
      <Card style={styles.preview}>
        <IconBadge icon={icon} color={color} size={64} />
        <Text variant="subheading">{name.trim() || 'Preview'}</Text>
      </Card>
      <TextField
        label="Name"
        value={name}
        onChangeText={(v) => {
          setName(v);
          setError(null);
        }}
        placeholder="e.g. Credit Card"
        maxLength={40}
        error={error}
        autoFocus={!existing}
        onSubmitEditing={submit}
      />
      <ColorPicker value={color} onChange={setColor} />
      <IconPicker value={icon} color={color} onChange={setIcon} />
      {existing ? (
        <Button
          title="Delete account type"
          icon="trash-outline"
          variant="danger"
          loading={remove.isPending}
          onPress={handleDelete}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  preview: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
});
