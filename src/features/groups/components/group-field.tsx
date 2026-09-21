import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { ColorPicker } from '@/components/ui/color-picker';
import { IconPicker } from '@/components/ui/icon-picker';
import { SelectField } from '@/components/ui/select-field';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { useToast } from '@/components/ui/toast';
import { spacing } from '@/theme/tokens';

import { useGroups, useSaveGroup } from '../hooks';

export const DEFAULT_GROUP_ICON = 'albums';
export const DEFAULT_GROUP_COLOR = '#F59E0B';

/**
 * Picks the group an entry belongs to, and creates one without leaving the form —
 * a new group is selected as soon as it is saved.
 */
export function GroupField({
  value,
  onChange,
  label = 'Group',
  hint,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  label?: string;
  hint?: string;
}) {
  const groups = useGroups({ includeArchived: false });
  const [creating, setCreating] = useState(false);

  const options = (groups.data ?? []).map((group) => ({
    value: group.id,
    label: group.name,
    description: group.transactionCount
      ? `${group.transactionCount} entr${group.transactionCount === 1 ? 'y' : 'ies'}`
      : 'No entries yet',
    icon: group.icon,
    color: group.color,
  }));

  return (
    <>
      <SelectField
        label={label}
        placeholder={hint ?? 'Choose a group (optional)'}
        value={value}
        options={options}
        onChange={onChange}
        clearable
        onCreate={() => setCreating(true)}
        createLabel="New group"
      />
      <NewGroupSheet
        visible={creating}
        onClose={() => setCreating(false)}
        onCreated={(id) => {
          onChange(id);
          setCreating(false);
        }}
      />
    </>
  );
}

export function NewGroupSheet({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const toast = useToast();
  const save = useSaveGroup();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState(DEFAULT_GROUP_ICON);
  const [color, setColor] = useState(DEFAULT_GROUP_COLOR);
  const [error, setError] = useState<string | null>(null);
  const [wasVisible, setWasVisible] = useState(visible);

  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setName('');
      setIcon(DEFAULT_GROUP_ICON);
      setColor(DEFAULT_GROUP_COLOR);
      setError(null);
    }
  }

  const submit = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    try {
      const id = await save.mutateAsync({ input: { name: name.trim(), note: null, icon, color } });
      toast.success(`${name.trim()} created`);
      onCreated(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the group');
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="New group"
      maxHeight={0.9}
      footer={
        <Button title="Create group" icon="checkmark" loading={save.isPending} onPress={submit} />
      }>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text variant="caption" color="textSecondary">
          Bundle entries that belong together — a trip, a project, a month of renovations — and
          report on them as one.
        </Text>
        <TextField
          label="Group name"
          value={name}
          onChangeText={(text) => {
            setName(text);
            setError(null);
          }}
          placeholder="e.g. Sylhet trip"
          maxLength={60}
          error={error}
        />
        <ColorPicker value={color} onChange={setColor} />
        <IconPicker value={icon} color={color} onChange={setIcon} />
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
});
