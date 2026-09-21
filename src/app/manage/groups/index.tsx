import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Amount } from '@/components/ui/amount';
import { Button, IconButton } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { IconBadge } from '@/components/ui/icon-badge';
import { ListSkeleton } from '@/components/ui/loader';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Screen } from '@/components/ui/screen';
import { SearchBar } from '@/components/ui/search-bar';
import { Section } from '@/components/ui/section';
import { Text } from '@/components/ui/text';
import type { Group } from '@/db/types';
import { useGroups } from '@/features/groups/hooks';
import { useSettings } from '@/features/settings/settings-provider';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useTheme } from '@/theme/theme-provider';
import { radius, spacing } from '@/theme/tokens';

function GroupCard({ group }: { group: Group }) {
  const { colors } = useTheme();
  const { formatDate } = useSettings();

  const span =
    group.firstDate && group.lastDate
      ? group.firstDate === group.lastDate
        ? formatDate(group.firstDate)
        : `${formatDate(group.firstDate)} – ${formatDate(group.lastDate)}`
      : 'No entries yet';

  return (
    <PressableScale
      onPress={() => router.push({ pathname: '/manage/groups/form', params: { id: group.id } })}
      accessibilityLabel={`${group.name}, ${group.transactionCount} entries`}>
      <Card style={styles.card}>
        <View style={styles.cardHead}>
          <IconBadge icon={group.icon} color={group.color} size={44} />
          <View style={styles.cardText}>
            <View style={styles.titleRow}>
              <Text variant="callout" weight="semibold" numberOfLines={1} style={styles.flex}>
                {group.name}
              </Text>
              {group.isArchived ? (
                <View style={[styles.pill, { backgroundColor: colors.surfaceMuted }]}>
                  <Text variant="micro" color="textMuted">
                    Archived
                  </Text>
                </View>
              ) : null}
            </View>
            <Text variant="caption" color="textMuted" numberOfLines={1}>
              {span}
            </Text>
          </View>
          <Amount value={group.net} variant="callout" weight="bold" signed colorize />
        </View>

        <View style={[styles.stats, { borderTopColor: colors.border }]}>
          <View style={styles.stat}>
            <Text variant="micro" color="textMuted" uppercase>
              Income
            </Text>
            <Amount value={group.income} variant="caption" weight="semibold" color="income" />
          </View>
          <View style={styles.stat}>
            <Text variant="micro" color="textMuted" uppercase>
              Expense
            </Text>
            <Amount value={group.expense} variant="caption" weight="semibold" color="expense" />
          </View>
          <View style={styles.stat}>
            <Text variant="micro" color="textMuted" uppercase>
              Entries
            </Text>
            <Text variant="caption" weight="semibold">
              {group.transactionCount}
            </Text>
          </View>
        </View>
      </Card>
    </PressableScale>
  );
}

export default function GroupsScreen() {
  const [search, setSearch] = useState('');
  const term = useDebouncedValue(search).trim().toLowerCase();
  const { data, isPending } = useGroups();

  const matches = (data ?? []).filter((g) => !term || g.name.toLowerCase().includes(term));
  const active = matches.filter((g) => !g.isArchived);
  const archived = matches.filter((g) => g.isArchived);

  return (
    <Screen safeBottom>
      <Stack.Screen
        options={{
          headerRight: () => (
            <IconButton
              icon="add"
              variant="plain"
              accessibilityLabel="Add group"
              onPress={() => router.push('/manage/groups/form')}
            />
          ),
        }}
      />

      {isPending ? (
        <ListSkeleton rows={3} />
      ) : (data ?? []).length === 0 ? (
        <EmptyState
          icon="albums-outline"
          title="No groups yet"
          message="Bundle entries that belong together — a trip, a project, a renovation — then see how each one adds up."
          action={{
            label: 'Create a group',
            icon: 'add',
            onPress: () => router.push('/manage/groups/form'),
          }}
        />
      ) : (
        <>
          {(data ?? []).length > 4 ? (
            <SearchBar value={search} onChangeText={setSearch} placeholder="Search groups" />
          ) : null}

          {active.length > 0 ? (
            <Section title="Active" caption="Pick these while adding an entry">
              <View style={styles.list}>
                {active.map((group) => (
                  <GroupCard key={group.id} group={group} />
                ))}
              </View>
            </Section>
          ) : null}

          {archived.length > 0 ? (
            <Section title="Archived" caption="Kept for reports, hidden from pickers">
              <View style={styles.list}>
                {archived.map((group) => (
                  <GroupCard key={group.id} group={group} />
                ))}
              </View>
            </Section>
          ) : null}

          {matches.length === 0 ? (
            <EmptyState compact icon="search-outline" title="No groups match that search" />
          ) : null}

          <Button
            title="Add group"
            icon="add"
            variant="secondary"
            onPress={() => router.push('/manage/groups/form')}
          />
          <Button
            title="Group-wise report"
            icon="pie-chart-outline"
            variant="outline"
            onPress={() => router.push('/reports/groups')}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.md,
  },
  card: {
    gap: spacing.md,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  cardText: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  flex: {
    flex: 1,
  },
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  stats: {
    flexDirection: 'row',
    gap: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.md,
  },
  stat: {
    flex: 1,
    gap: 2,
  },
});
