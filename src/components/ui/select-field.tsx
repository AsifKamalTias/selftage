import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/theme-provider';
import { radius, spacing } from '@/theme/tokens';

import { BottomSheet } from './bottom-sheet';
import { Button } from './button';
import { Icon } from './icon';
import { IconBadge } from './icon-badge';
import { PressableScale } from './pressable-scale';
import { SearchBar } from './search-bar';
import { Text } from './text';

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  icon?: string;
  color?: string;
}

export interface SelectFieldProps {
  label: string;
  placeholder?: string;
  value: string | null;
  options: readonly SelectOption[];
  onChange: (value: string | null) => void;
  error?: string | null;
  /** Shows a "None" row that clears the value. */
  clearable?: boolean;
  onCreate?: () => void;
  createLabel?: string;
}

export function SelectField({
  label,
  placeholder = 'Select',
  value,
  options,
  onChange,
  error,
  clearable = false,
  onCreate,
  createLabel = 'Add new',
}: SelectFieldProps) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = options.find((o) => o.value === value) ?? null;
  const searchable = options.length > 8;
  const term = query.trim().toLowerCase();
  const filtered = term ? options.filter((o) => o.label.toLowerCase().includes(term)) : options;

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  return (
    <View style={styles.container}>
      <Text variant="label" color="textSecondary">
        {label}
      </Text>
      <PressableScale
        scaleTo={0.99}
        onPress={() => setOpen(true)}
        accessibilityLabel={`${label}: ${selected?.label ?? placeholder}`}
        accessibilityHint="Opens a list of options"
        style={[
          styles.field,
          { borderColor: error ? colors.danger : colors.border, backgroundColor: colors.surface },
        ]}>
        {selected?.icon ? (
          <IconBadge icon={selected.icon} color={selected.color ?? colors.primary} size={30} />
        ) : null}
        <Text
          style={styles.fieldText}
          color={selected ? 'text' : 'textMuted'}
          weight={selected ? 'medium' : 'regular'}
          numberOfLines={1}>
          {selected?.label ?? placeholder}
        </Text>
        <Icon name="chevron-down" size={18} color="textMuted" />
      </PressableScale>
      {error ? (
        <Text variant="caption" color="danger">
          {error}
        </Text>
      ) : null}

      <BottomSheet
        visible={open}
        onClose={close}
        title={label}
        fill={options.length > 6}
        footer={
          onCreate ? (
            <Button
              title={createLabel}
              icon="add"
              variant="secondary"
              onPress={() => {
                close();
                onCreate();
              }}
            />
          ) : undefined
        }>
        {searchable ? (
          <View style={styles.search}>
            <SearchBar
              value={query}
              onChangeText={setQuery}
              placeholder={`Search ${label.toLowerCase()}`}
            />
          </View>
        ) : null}
        <FlatList
          data={
            clearable && !term
              ? [{ value: '', label: 'None' } as SelectOption, ...filtered]
              : filtered
          }
          keyExtractor={(item) => item.value || '__none__'}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text color="textMuted" align="center" style={styles.empty}>
              No matches
            </Text>
          }
          renderItem={({ item }) => {
            const isSelected = item.value ? item.value === value : value == null;
            return (
              <PressableScale
                haptic
                scaleTo={0.98}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                onPress={() => {
                  onChange(item.value || null);
                  close();
                }}
                style={[styles.option, isSelected && { backgroundColor: colors.primaryMuted }]}>
                {item.icon ? (
                  <IconBadge icon={item.icon} color={item.color ?? colors.primary} size={36} />
                ) : (
                  <View style={[styles.noneIcon, { borderColor: colors.borderStrong }]}>
                    <Icon name="remove" size={16} color="textMuted" />
                  </View>
                )}
                <View style={styles.optionText}>
                  <Text weight={isSelected ? 'semibold' : 'medium'} numberOfLines={1}>
                    {item.label}
                  </Text>
                  {item.description ? (
                    <Text variant="caption" color="textMuted" numberOfLines={1}>
                      {item.description}
                    </Text>
                  ) : null}
                </View>
                {isSelected ? <Icon name="checkmark-circle" size={22} color="primary" /> : null}
              </PressableScale>
            );
          }}
        />
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs + 2,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 50,
    borderWidth: 1.5,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    gap: spacing.sm + 2,
  },
  fieldText: {
    flex: 1,
  },
  search: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
  },
  list: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
  },
  optionText: {
    flex: 1,
    gap: 2,
  },
  noneIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    paddingVertical: spacing.xxl,
  },
});
