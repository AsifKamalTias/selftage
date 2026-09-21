import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Amount } from '@/components/ui/amount';
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
import type { Group } from '@/db/types';
import { DEFAULT_GROUP_COLOR, DEFAULT_GROUP_ICON } from '@/features/groups/components/group-field';
import {
  useDeleteGroup,
  useGroup,
  useSaveGroup,
  useSetGroupArchived,
} from '@/features/groups/hooks';
import { goBack } from '@/lib/navigation';
import { spacing } from '@/theme/tokens';

export default function GroupFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data, isPending } = useGroup(id);
  if (id && isPending) return <ScreenLoader />;
  if (id && !data) return <EmptyState icon="search-outline" title="Group not found" />;
  return <GroupForm key={data?.id ?? 'new'} existing={data ?? null} />;
}

function GroupForm({ existing }: { existing: Group | null }) {
  const toast = useToast();
  const save = useSaveGroup();
  const archive = useSetGroupArchived();
  const remove = useDeleteGroup();

  const [name, setName] = useState(existing?.name ?? '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [icon, setIcon] = useState(existing?.icon ?? DEFAULT_GROUP_ICON);
  const [color, setColor] = useState(existing?.color ?? DEFAULT_GROUP_COLOR);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    try {
      await save.mutateAsync({
        id: existing?.id,
        input: { name: name.trim(), note: note.trim() || null, icon, color },
      });
      toast.success(existing ? 'Group updated' : 'Group created');
      goBack('/manage/groups');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the group');
    }
  };

  const toggleArchive = async () => {
    if (!existing) return;
    try {
      await archive.mutateAsync({ id: existing.id, isArchived: !existing.isArchived });
      toast.success(existing.isArchived ? 'Group restored' : 'Group archived');
      goBack('/manage/groups');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update the group');
    }
  };

  const handleDelete = async () => {
    if (!existing) return;
    const ok = await confirm({
      title: `Delete ${existing.name}?`,
      message: existing.transactionCount
        ? `The ${existing.transactionCount} entr${
            existing.transactionCount === 1 ? 'y' : 'ies'
          } in this group stay in your history; they just stop being grouped.`
        : 'This group will be removed.',
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(existing.id);
      toast.success('Group deleted');
      goBack('/manage/groups');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not delete the group');
    }
  };

  return (
    <Screen
      keyboard
      safeBottom
      footer={
        <Button
          title={existing ? 'Save changes' : 'Create group'}
          icon="checkmark"
          loading={save.isPending}
          onPress={submit}
        />
      }>
      <Stack.Screen options={{ title: existing ? 'Edit group' : 'New group' }} />

      <Card style={styles.preview}>
        <IconBadge icon={icon} color={color} size={56} solid />
        <View style={styles.previewText}>
          <Text variant="subheading" numberOfLines={1}>
            {name.trim() || 'Group name'}
          </Text>
          <Text variant="caption" color="textMuted">
            {existing
              ? `${existing.transactionCount} entr${existing.transactionCount === 1 ? 'y' : 'ies'}`
              : 'A trip, a project, an event'}
          </Text>
        </View>
        {existing && existing.transactionCount > 0 ? (
          <Amount value={existing.net} variant="callout" weight="bold" signed colorize />
        ) : null}
      </Card>

      <TextField
        label="Group name"
        value={name}
        onChangeText={(value) => {
          setName(value);
          setError(null);
        }}
        placeholder="e.g. Sylhet trip"
        maxLength={60}
        error={error}
        autoFocus={!existing}
      />

      <TextField
        label="Note"
        value={note}
        onChangeText={setNote}
        placeholder="What does this group cover?"
        multiline
        maxLength={500}
      />

      <ColorPicker value={color} onChange={setColor} />
      <IconPicker value={icon} color={color} onChange={setIcon} />

      {existing ? (
        <View style={styles.actions}>
          {existing.transactionCount > 0 ? (
            <Button
              title="See entries"
              icon="list-outline"
              variant="outline"
              onPress={() =>
                router.push({ pathname: '/transactions', params: { groupId: existing.id } })
              }
            />
          ) : null}
          <Button
            title={existing.isArchived ? 'Restore group' : 'Archive group'}
            icon={existing.isArchived ? 'refresh-outline' : 'archive-outline'}
            variant="outline"
            loading={archive.isPending}
            onPress={toggleArchive}
          />
          <Button
            title="Delete group"
            icon="trash-outline"
            variant="danger"
            loading={remove.isPending}
            onPress={handleDelete}
          />
          <Text variant="caption" color="textMuted" align="center">
            Archiving keeps the group in reports but hides it when adding an entry.
          </Text>
        </View>
      ) : null}
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
  actions: {
    gap: spacing.md,
  },
});
