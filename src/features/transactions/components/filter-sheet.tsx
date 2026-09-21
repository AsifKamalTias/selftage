import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { DateField } from '@/components/ui/date-field';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import type { EntryKind } from '@/db/types';
import { useAccounts } from '@/features/accounts/hooks';
import { useCatalog } from '@/features/catalog/hooks';
import { useGroups } from '@/features/groups/hooks';
import { useSettings } from '@/features/settings/settings-provider';
import { PERIOD_PRESETS, rangeForPreset, type PeriodPreset, type WeekStart } from '@/lib/date';
import { minorToInput, parseAmountInput, sanitizeAmountInput } from '@/lib/money';
import { spacing } from '@/theme/tokens';

import { TRANSACTION_SORTS, type TransactionSort } from '../repository';

export interface HistoryFilters {
  period: PeriodPreset | 'custom';
  from?: string;
  to?: string;
  categoryIds: string[];
  sourceIds: string[];
  accountIds: string[];
  /** Group ids; the empty string selects entries with no group. */
  groupIds: string[];
  minAmount?: number;
  maxAmount?: number;
  withAttachments: boolean;
  sort: TransactionSort;
}

export const EMPTY_FILTERS: HistoryFilters = {
  period: 'all',
  categoryIds: [],
  sourceIds: [],
  accountIds: [],
  groupIds: [],
  withAttachments: false,
  sort: 'newest',
};

export function activeFilterCount(filters: HistoryFilters): number {
  return (
    (filters.period !== 'all' ? 1 : 0) +
    filters.categoryIds.length +
    filters.sourceIds.length +
    filters.accountIds.length +
    filters.groupIds.length +
    (filters.minAmount != null || filters.maxAmount != null ? 1 : 0) +
    (filters.withAttachments ? 1 : 0) +
    (filters.sort !== 'newest' ? 1 : 0)
  );
}

export function resolveRange(filters: HistoryFilters, weekStartsOn: WeekStart) {
  return filters.period === 'custom'
    ? { from: filters.from, to: filters.to }
    : rangeForPreset(filters.period, { weekStartsOn });
}

function toggle(list: string[], id: string) {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      <Text variant="label" color="textSecondary" uppercase>
        {title}
      </Text>
      <View style={styles.chips}>{children}</View>
    </View>
  );
}

export function FilterSheet({
  visible,
  onClose,
  kind,
  value,
  onApply,
}: {
  visible: boolean;
  onClose: () => void;
  /** Limits type/source choices when the list is filtered to one kind. */
  kind?: EntryKind;
  value: HistoryFilters;
  onApply: (filters: HistoryFilters) => void;
}) {
  const { currency, settings } = useSettings();
  const [draft, setDraft] = useState(value);
  const [minText, setMinText] = useState(
    value.minAmount != null ? minorToInput(value.minAmount) : ''
  );
  const [maxText, setMaxText] = useState(
    value.maxAmount != null ? minorToInput(value.maxAmount) : ''
  );
  const [wasVisible, setWasVisible] = useState(visible);

  // Start from the applied filters every time the sheet opens (discarding unapplied edits).
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setDraft(value);
      setMinText(value.minAmount != null ? minorToInput(value.minAmount) : '');
      setMaxText(value.maxAmount != null ? minorToInput(value.maxAmount) : '');
    }
  }

  const accounts = useAccounts();
  const categories = useCatalog('categories', kind);
  const sources = useCatalog('sources', kind);
  const groups = useGroups();

  const apply = () => {
    const min = parseAmountInput(minText) ?? undefined;
    const max = parseAmountInput(maxText) ?? undefined;
    onApply({
      ...draft,
      minAmount: min,
      maxAmount: max != null && min != null && max < min ? min : max,
    });
    onClose();
  };

  const reset = () => {
    setDraft(EMPTY_FILTERS);
    setMinText('');
    setMaxText('');
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Filter & sort"
      fill
      maxHeight={0.9}
      footer={
        <View style={styles.footer}>
          <Button title="Reset" variant="outline" onPress={reset} style={styles.flex} />
          <Button title="Apply filters" icon="checkmark" onPress={apply} style={styles.flex2} />
        </View>
      }>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Group title="Sort by">
          {TRANSACTION_SORTS.map((sort) => (
            <Chip
              key={sort.value}
              label={sort.label}
              selected={draft.sort === sort.value}
              onPress={() => setDraft({ ...draft, sort: sort.value })}
            />
          ))}
        </Group>

        <Group title="Date">
          {PERIOD_PRESETS.map((preset) => (
            <Chip
              key={preset.value}
              label={preset.label}
              selected={draft.period === preset.value}
              onPress={() => setDraft({ ...draft, period: preset.value })}
            />
          ))}
          <Chip
            label="Custom range"
            icon="calendar-outline"
            selected={draft.period === 'custom'}
            onPress={() => {
              const current =
                draft.period === 'custom'
                  ? {}
                  : rangeForPreset(draft.period, { weekStartsOn: settings.weekStartsOn });
              setDraft({ ...draft, period: 'custom', from: current.from, to: current.to });
            }}
          />
        </Group>
        {draft.period === 'custom' ? (
          <View style={styles.row}>
            <View style={styles.flex}>
              <DateField
                label="From"
                value={draft.from ?? null}
                onChange={(from) => setDraft({ ...draft, from: from ?? undefined })}
                maximumDate={draft.to}
                clearable
              />
            </View>
            <View style={styles.flex}>
              <DateField
                label="To"
                value={draft.to ?? null}
                onChange={(to) => setDraft({ ...draft, to: to ?? undefined })}
                minimumDate={draft.from}
                clearable
              />
            </View>
          </View>
        ) : null}

        <Group title="Accounts">
          {(accounts.data ?? []).map((a) => (
            <Chip
              key={a.id}
              label={a.name}
              icon={a.icon}
              color={a.color}
              selected={draft.accountIds.includes(a.id)}
              onPress={() => setDraft({ ...draft, accountIds: toggle(draft.accountIds, a.id) })}
            />
          ))}
        </Group>

        <Group title={kind ? `${kind === 'income' ? 'Income' : 'Expense'} types` : 'Types'}>
          {(categories.data ?? []).map((c) => (
            <Chip
              key={c.id}
              label={kind ? c.name : `${c.name} (${c.kind === 'income' ? 'in' : 'out'})`}
              icon={c.icon}
              color={c.color}
              selected={draft.categoryIds.includes(c.id)}
              onPress={() => setDraft({ ...draft, categoryIds: toggle(draft.categoryIds, c.id) })}
            />
          ))}
        </Group>

        <Group title="Sources">
          {(sources.data ?? []).map((s) => (
            <Chip
              key={s.id}
              label={kind ? s.name : `${s.name} (${s.kind === 'income' ? 'in' : 'out'})`}
              icon={s.icon}
              color={s.color}
              selected={draft.sourceIds.includes(s.id)}
              onPress={() => setDraft({ ...draft, sourceIds: toggle(draft.sourceIds, s.id) })}
            />
          ))}
        </Group>

        {(groups.data ?? []).length > 0 ? (
          <Group title="Groups">
            {(groups.data ?? []).map((g) => (
              <Chip
                key={g.id}
                label={g.name}
                icon={g.icon}
                color={g.color}
                selected={draft.groupIds.includes(g.id)}
                onPress={() => setDraft({ ...draft, groupIds: toggle(draft.groupIds, g.id) })}
              />
            ))}
            <Chip
              label="No group"
              icon="ellipsis-horizontal"
              selected={draft.groupIds.includes('')}
              onPress={() => setDraft({ ...draft, groupIds: toggle(draft.groupIds, '') })}
            />
          </Group>
        ) : null}

        <View style={styles.group}>
          <Text variant="label" color="textSecondary" uppercase>
            Amount
          </Text>
          <View style={styles.row}>
            <TextField
              containerStyle={styles.flex}
              placeholder="Min"
              prefix={currency.symbol.trim()}
              value={minText}
              onChangeText={(t) => setMinText(sanitizeAmountInput(t))}
              keyboardType="decimal-pad"
              accessibilityLabel="Minimum amount"
            />
            <TextField
              containerStyle={styles.flex}
              placeholder="Max"
              prefix={currency.symbol.trim()}
              value={maxText}
              onChangeText={(t) => setMaxText(sanitizeAmountInput(t))}
              keyboardType="decimal-pad"
              accessibilityLabel="Maximum amount"
            />
          </View>
        </View>

        <Group title="Other">
          <Chip
            label="Has attachments"
            icon="attach"
            selected={draft.withAttachments}
            onPress={() => setDraft({ ...draft, withAttachments: !draft.withAttachments })}
          />
        </Group>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.xl,
  },
  group: {
    gap: spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  flex: {
    flex: 1,
  },
  flex2: {
    flex: 2,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
  },
});
