import { router, Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button, IconButton } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { ListSkeleton } from '@/components/ui/loader';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { Text } from '@/components/ui/text';
import { RecurringRow } from '@/features/recurring/components/recurring-row';
import { useRecurringRules } from '@/features/recurring/hooks';
import { useSettings } from '@/features/settings/settings-provider';
import { formatDate, todayISO } from '@/lib/date';
import { spacing } from '@/theme/tokens';

export default function RecurringScreen() {
  const { settings } = useSettings();
  const { data, isPending } = useRecurringRules();
  const rules = data ?? [];
  const active = rules.filter((rule) => rule.isActive);
  const paused = rules.filter((rule) => !rule.isActive);
  const upcoming = active[0];

  const openForm = (id?: string) =>
    router.push(id ? { pathname: '/recurring/form', params: { id } } : '/recurring/form');

  return (
    <Screen safeBottom>
      <Stack.Screen
        options={{
          headerRight: () => (
            <IconButton
              icon="add"
              variant="plain"
              accessibilityLabel="Add recurring"
              onPress={() => openForm()}
            />
          ),
        }}
      />

      {isPending ? (
        <ListSkeleton rows={3} />
      ) : rules.length === 0 ? (
        <EmptyState
          icon="repeat"
          title="No recurring yet"
          message="Set up salary, rent, subscriptions or any entry that repeats. They are added automatically on their date — daily, weekly, monthly or yearly."
          action={{ label: 'Add recurring', icon: 'add', onPress: () => openForm() }}
        />
      ) : (
        <>
          <Card muted elevated={false} style={styles.summary}>
            <Icon name="repeat" size={22} color="primary" />
            <Text variant="callout" style={styles.summaryText}>
              {active.length === 0
                ? 'Everything recurring is paused.'
                : upcoming
                  ? `${active.length} active · next is ${upcoming.name} on ${formatDate(
                      upcoming.nextDate > todayISO() ? upcoming.nextDate : todayISO(),
                      settings.dateFormat
                    )}.`
                  : `${active.length} active.`}
            </Text>
          </Card>

          {active.length > 0 ? (
            <Section title="Active" caption="Posted automatically on their date">
              <View style={styles.list}>
                {active.map((rule) => (
                  <RecurringRow key={rule.id} rule={rule} onPress={() => openForm(rule.id)} />
                ))}
              </View>
            </Section>
          ) : null}

          {paused.length > 0 ? (
            <Section title="Paused" caption="Nothing is posted until you resume them">
              <View style={styles.list}>
                {paused.map((rule) => (
                  <RecurringRow key={rule.id} rule={rule} onPress={() => openForm(rule.id)} />
                ))}
              </View>
            </Section>
          ) : null}

          <Button title="Add recurring" icon="add" variant="secondary" onPress={() => openForm()} />
          <Text variant="caption" color="textMuted" align="center">
            Entries missed while the app was closed are added the next time you open it.
          </Text>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.md,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  summaryText: {
    flex: 1,
  },
});
