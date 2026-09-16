import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { Button, IconButton } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ColorPicker } from '@/components/ui/color-picker';
import { confirm } from '@/components/ui/confirm';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { IconBadge } from '@/components/ui/icon-badge';
import { IconPicker } from '@/components/ui/icon-picker';
import { ListSkeleton, ScreenLoader } from '@/components/ui/loader';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Screen } from '@/components/ui/screen';
import { SearchBar } from '@/components/ui/search-bar';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { useToast } from '@/components/ui/toast';
import type { EntryKind } from '@/db/types';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { goBack } from '@/lib/navigation';
import { useTheme } from '@/theme/theme-provider';
import { maxContentWidth, spacing } from '@/theme/tokens';

import { useCatalog, useCatalogItem, useDeleteCatalogItem, useSaveCatalogItem } from '../hooks';
import { CATALOG_LABELS, type CatalogItem, type CatalogTable } from '../repository';

const ROUTES = {
  categories: '/manage/types/form',
  sources: '/manage/sources/form',
} as const;

const DESCRIPTIONS: Record<CatalogTable, Record<EntryKind, string>> = {
  categories: {
    expense: 'What you spend on, e.g. Groceries or Rent.',
    income: 'What you earn from, e.g. Salary or Freelance.',
  },
  sources: {
    expense: 'Who you pay, e.g. a supermarket or landlord.',
    income: 'Who pays you, e.g. your employer or clients.',
  },
};

function kindParam(value: string | undefined): EntryKind {
  return value === 'income' ? 'income' : 'expense';
}

export function CatalogListScreen({ table }: { table: CatalogTable }) {
  const params = useLocalSearchParams<{ kind?: string }>();
  const { colors } = useTheme();
  const [kind, setKind] = useState<EntryKind>(kindParam(params.kind));
  const [search, setSearch] = useState('');
  const term = useDebouncedValue(search).trim().toLowerCase();
  const { data, isPending } = useCatalog(table, kind);
  const labels = CATALOG_LABELS[table];
  const items = (data ?? []).filter((item) => !term || item.name.toLowerCase().includes(term));

  const openForm = (item?: CatalogItem) =>
    router.push({
      pathname: ROUTES[table],
      params: item ? { id: item.id } : { kind },
    });

  return (
    <View style={styles.flex}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <IconButton
              icon="add"
              variant="plain"
              accessibilityLabel={`Add ${labels.singular}`}
              onPress={() => openForm()}
            />
          ),
        }}
      />
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={styles.header}>
            <SegmentedControl
              value={kind}
              onChange={setKind}
              options={[
                {
                  value: 'expense',
                  label: 'Expense',
                  icon: 'arrow-up',
                  activeColor: colors.expense,
                },
                {
                  value: 'income',
                  label: 'Income',
                  icon: 'arrow-down',
                  activeColor: colors.income,
                },
              ]}
            />
            <Text variant="caption" color="textMuted">
              {DESCRIPTIONS[table][kind]}
            </Text>
            <View style={styles.row}>
              <SearchBar
                value={search}
                onChangeText={setSearch}
                placeholder={`Search ${labels.plural}`}
              />
            </View>
          </View>
        }
        ItemSeparatorComponent={() => (
          <View style={[styles.separator, { backgroundColor: colors.border }]} />
        )}
        renderItem={({ item }) => (
          <PressableScale
            scaleTo={0.98}
            onPress={() => openForm(item)}
            accessibilityLabel={`Edit ${item.name}`}
            style={styles.item}>
            <IconBadge icon={item.icon} color={item.color} size={42} />
            <View style={styles.flex}>
              <Text weight="medium" numberOfLines={1}>
                {item.name}
              </Text>
              <Text variant="caption" color="textMuted">
                {item.usageCount
                  ? `${item.usageCount} transaction${item.usageCount === 1 ? '' : 's'}`
                  : 'Not used yet'}
              </Text>
            </View>
            <Icon name="chevron-forward" size={18} color="textMuted" />
          </PressableScale>
        )}
        ListEmptyComponent={
          isPending ? (
            <ListSkeleton rows={5} />
          ) : (
            <EmptyState
              compact
              icon="pricetags-outline"
              title={term ? 'No matches' : `No ${kind} ${labels.plural} yet`}
              action={{ label: `Add ${labels.singular}`, icon: 'add', onPress: () => openForm() }}
            />
          )
        }
        ListFooterComponent={
          items.length > 0 ? (
            <Button
              title={`Add ${kind} ${labels.singular}`}
              icon="add"
              variant="secondary"
              onPress={() => openForm()}
              style={styles.footerButton}
            />
          ) : null
        }
      />
    </View>
  );
}

export function CatalogFormScreen({ table }: { table: CatalogTable }) {
  const params = useLocalSearchParams<{ id?: string; kind?: string }>();
  const { data: existing, isPending } = useCatalogItem(table, params.id);
  if (params.id && isPending) return <ScreenLoader />;
  if (params.id && !existing) {
    return (
      <EmptyState icon="search-outline" title="Not found" message="It may have been deleted." />
    );
  }
  return (
    <CatalogForm
      key={existing?.id ?? 'new'}
      table={table}
      existing={existing ?? null}
      initialKind={existing?.kind ?? kindParam(params.kind)}
    />
  );
}

function CatalogForm({
  table,
  existing,
  initialKind,
}: {
  table: CatalogTable;
  existing: CatalogItem | null;
  initialKind: EntryKind;
}) {
  const { colors } = useTheme();
  const toast = useToast();
  const save = useSaveCatalogItem(table);
  const remove = useDeleteCatalogItem(table);
  const labels = CATALOG_LABELS[table];
  const [kind, setKind] = useState<EntryKind>(initialKind);
  const [name, setName] = useState(existing?.name ?? '');
  const [icon, setIcon] = useState(existing?.icon ?? 'pricetag');
  const [color, setColor] = useState(existing?.color ?? '#6366F1');
  const [error, setError] = useState<string | null>(null);
  const title = `${existing ? 'Edit' : 'New'} ${kind} ${labels.singular}`;

  const submit = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    try {
      await save.mutateAsync({ id: existing?.id, input: { kind, name, icon, color } });
      toast.success(existing ? 'Changes saved' : `${name.trim()} added`);
      goBack();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save');
    }
  };

  const handleDelete = async () => {
    if (!existing) return;
    const ok = await confirm({
      title: `Delete ${existing.name}?`,
      message: `This ${labels.singular} will be removed permanently.`,
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(existing.id);
      toast.success('Deleted');
      goBack();
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
          title={existing ? 'Save changes' : `Add ${labels.singular}`}
          icon="checkmark"
          loading={save.isPending}
          onPress={submit}
        />
      }>
      <Stack.Screen options={{ title }} />
      <Card style={styles.preview}>
        <IconBadge icon={icon} color={color} size={64} />
        <Text variant="subheading" numberOfLines={1}>
          {name.trim() || 'Preview'}
        </Text>
        <Text variant="caption" color={kind === 'income' ? 'income' : 'expense'}>
          {kind === 'income' ? 'Income' : 'Expense'} {labels.singular}
        </Text>
      </Card>

      {existing ? null : (
        <SegmentedControl
          value={kind}
          onChange={setKind}
          options={[
            { value: 'expense', label: 'Expense', icon: 'arrow-up', activeColor: colors.expense },
            { value: 'income', label: 'Income', icon: 'arrow-down', activeColor: colors.income },
          ]}
        />
      )}
      <TextField
        label="Name"
        value={name}
        onChangeText={(value) => {
          setName(value);
          setError(null);
        }}
        placeholder={table === 'categories' ? 'e.g. Groceries' : 'e.g. City Supermarket'}
        maxLength={40}
        error={error}
        autoFocus={!existing}
        returnKeyType="done"
        onSubmitEditing={submit}
      />
      <ColorPicker value={color} onChange={setColor} />
      <IconPicker value={icon} color={color} onChange={setIcon} />

      {existing ? (
        <Button
          title={`Delete ${labels.singular}`}
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
  flex: {
    flex: 1,
  },
  list: {
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.huge,
  },
  header: {
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  row: {
    flexDirection: 'row',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 42 + spacing.md,
  },
  footerButton: {
    marginTop: spacing.xl,
  },
  preview: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
});
