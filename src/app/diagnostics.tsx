import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { confirm } from '@/components/ui/confirm';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useToast } from '@/components/ui/toast';
import { shareTextFile } from '@/features/export/share';
import { clearPersistedLogs } from '@/lib/log-persistence';
import {
  clearLogs,
  formatLogs,
  logger,
  recentLogs,
  subscribeToLogs,
  type LogEntry,
  type LogLevel,
} from '@/lib/logger';
import { countOf } from '@/lib/text';
import { todayISO } from '@/lib/date';
import { useTheme } from '@/theme/theme-provider';
import { radius, spacing, type ColorName } from '@/theme/tokens';

const log = logger('diagnostics');

const LEVEL_TONE: Record<LogLevel, ColorName> = {
  debug: 'textMuted',
  info: 'textSecondary',
  warn: 'warning',
  error: 'expense',
};

const FILTERS: { value: 'problems' | 'all'; label: string }[] = [
  { value: 'problems', label: 'Warnings & errors' },
  { value: 'all', label: 'Everything' },
];

function EntryCard({ entry }: { entry: LogEntry }) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const time = entry.at.slice(11, 19);

  return (
    <Card style={styles.entry}>
      <View style={styles.entryHead}>
        <View style={[styles.level, { backgroundColor: colors.surfaceMuted }]}>
          <Text variant="micro" weight="bold" color={LEVEL_TONE[entry.level]} uppercase>
            {entry.level}
          </Text>
        </View>
        <Text variant="micro" color="textMuted" tabular>
          {time}
        </Text>
        <Text variant="micro" color="textMuted" numberOfLines={1} style={styles.flex}>
          {entry.scope}
        </Text>
      </View>

      <Text variant="caption" weight="medium">
        {entry.message}
      </Text>

      {entry.error ? (
        <Text variant="micro" color="expense" numberOfLines={expanded ? undefined : 2}>
          {entry.error.name}: {entry.error.message}
        </Text>
      ) : null}

      {expanded ? (
        <>
          {entry.context ? (
            <Text variant="micro" color="textMuted">
              {JSON.stringify(entry.context, null, 2)}
            </Text>
          ) : null}
          {entry.error?.stack ? (
            <Text variant="micro" color="textMuted">
              {entry.error.stack}
            </Text>
          ) : null}
        </>
      ) : null}

      {entry.error?.stack || entry.context ? (
        <Text
          variant="micro"
          color="primary"
          weight="semibold"
          accessibilityRole="button"
          onPress={() => setExpanded((value) => !value)}>
          {expanded ? 'Show less' : 'Show details'}
        </Text>
      ) : null}
    </Card>
  );
}

export default function DiagnosticsScreen() {
  const toast = useToast();
  const [entries, setEntries] = useState<LogEntry[]>(() => recentLogs());
  const [filter, setFilter] = useState<'problems' | 'all'>('problems');
  const [sharing, setSharing] = useState(false);

  useEffect(() => subscribeToLogs(() => setEntries(recentLogs())), []);

  const problems = entries.filter((entry) => entry.level === 'warn' || entry.level === 'error');
  const shown = (filter === 'problems' ? problems : entries).slice().reverse();
  const errors = entries.filter((entry) => entry.level === 'error').length;

  const handleExport = async () => {
    if (entries.length === 0) return;
    setSharing(true);
    try {
      await shareTextFile(`selftage-log-${todayISO()}.txt`, formatLogs(entries), 'text/plain');
    } catch (error) {
      log.error('Could not export the log', error);
      toast.error(error instanceof Error ? error.message : 'Could not export the log');
    } finally {
      setSharing(false);
    }
  };

  const handleClear = async () => {
    const ok = await confirm({
      title: 'Clear this log?',
      message: 'Only the entries on this screen are removed. Nothing else is affected.',
      confirmLabel: 'Clear',
    });
    if (!ok) return;
    clearLogs();
    await clearPersistedLogs();
    setEntries([]);
  };

  return (
    <Screen safeBottom>
      <Stack.Screen options={{ title: 'Diagnostics' }} />

      <Card muted elevated={false} style={styles.summary}>
        <Text variant="caption" color="textSecondary">
          What the app recorded, including the session before this one. Kept on this device only,
          never sent anywhere.
          {errors > 0 ? ` ${countOf(errors, 'error')} so far.` : ' No errors so far.'}
        </Text>
      </Card>

      <View style={styles.filters}>
        {FILTERS.map((option) => (
          <Chip
            key={option.value}
            label={
              option.value === 'problems'
                ? `${option.label} (${problems.length})`
                : `${option.label} (${entries.length})`
            }
            selected={filter === option.value}
            onPress={() => setFilter(option.value)}
          />
        ))}
      </View>

      {shown.length === 0 ? (
        <EmptyState
          icon="checkmark-circle-outline"
          title={filter === 'problems' ? 'Nothing has gone wrong' : 'Nothing recorded yet'}
          message="Warnings and errors show up here as they happen, newest first."
        />
      ) : (
        <View style={styles.list}>
          {shown.map((entry) => (
            <EntryCard key={entry.id} entry={entry} />
          ))}
        </View>
      )}

      {entries.length > 0 ? (
        <View style={styles.actions}>
          <Button
            title="Export log"
            icon="download-outline"
            variant="outline"
            style={styles.flex}
            loading={sharing}
            onPress={handleExport}
          />
          <Button
            title="Clear"
            icon="trash-outline"
            variant="ghost"
            style={styles.flex}
            onPress={handleClear}
          />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: {
    gap: spacing.sm,
  },
  filters: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  list: {
    gap: spacing.md,
  },
  entry: {
    gap: spacing.xs + 2,
  },
  entryHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  level: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
    borderRadius: radius.pill,
  },
  flex: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
});
