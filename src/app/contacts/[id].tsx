import { router, Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Amount } from '@/components/ui/amount';
import { Button, IconButton } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ListGroup, ListRow } from '@/components/ui/list-row';
import { ScreenLoader } from '@/components/ui/loader';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { Text } from '@/components/ui/text';
import { ContactAvatar } from '@/features/contacts/components/contact-avatar';
import { useContact } from '@/features/contacts/hooks';
import { ObligationCard } from '@/features/outstanding/components/obligation-card';
import { useObligations } from '@/features/outstanding/hooks';
import { goBack } from '@/lib/navigation';
import { useTheme } from '@/theme/theme-provider';
import { spacing } from '@/theme/tokens';

export default function ContactDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { data: contact, isPending } = useContact(id);
  const obligations = useObligations({ contactId: id });

  if (isPending) return <ScreenLoader />;
  if (!contact) {
    return (
      <EmptyState
        icon="search-outline"
        title="Contact not found"
        message="It may have been deleted."
        action={{ label: 'Back to contacts', onPress: () => goBack('/contacts') }}
      />
    );
  }

  const items = obligations.data ?? [];
  const open = items.filter((item) => !item.isSettled);
  const settled = items.filter((item) => item.isSettled);

  return (
    <Screen safeBottom>
      <Stack.Screen
        options={{
          title: contact.name,
          headerRight: () => (
            <IconButton
              icon="create-outline"
              variant="plain"
              accessibilityLabel="Edit contact"
              onPress={() =>
                router.push({ pathname: '/contacts/form', params: { id: contact.id } })
              }
            />
          ),
        }}
      />

      <Card style={styles.hero}>
        <ContactAvatar name={contact.name} photoUri={contact.photoUri} size={84} />
        <Text variant="subheading" weight="bold" align="center" numberOfLines={2}>
          {contact.name}
        </Text>
        {contact.obligationCount > 0 ? (
          <View style={styles.totals}>
            <View style={styles.total}>
              <Text variant="micro" color="textMuted" uppercase>
                Owes you
              </Text>
              <Amount value={contact.receivable} variant="callout" weight="bold" color="income" />
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.total}>
              <Text variant="micro" color="textMuted" uppercase>
                You owe
              </Text>
              <Amount value={contact.payable} variant="callout" weight="bold" color="expense" />
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.total}>
              <Text variant="micro" color="textMuted" uppercase>
                Net
              </Text>
              <Amount value={contact.net} variant="callout" weight="bold" signed colorize />
            </View>
          </View>
        ) : (
          <Text variant="caption" color="textMuted" align="center">
            Nothing outstanding with {contact.name.split(' ')[0]} yet.
          </Text>
        )}
      </Card>

      <View style={styles.actions}>
        <Button
          title="They owe me"
          icon="arrow-down"
          variant="secondary"
          style={styles.flex}
          onPress={() =>
            router.push({
              pathname: '/outstanding/form',
              params: { contactId: contact.id, direction: 'receivable' },
            })
          }
        />
        <Button
          title="I owe them"
          icon="arrow-up"
          variant="secondary"
          style={styles.flex}
          onPress={() =>
            router.push({
              pathname: '/outstanding/form',
              params: { contactId: contact.id, direction: 'payable' },
            })
          }
        />
      </View>

      {contact.phone || contact.email || contact.address ? (
        <Section title="Details">
          <ListGroup>
            {contact.phone ? (
              <ListRow icon="call-outline" title={contact.phone} subtitle="Phone" />
            ) : null}
            {contact.email ? (
              <ListRow icon="mail-outline" title={contact.email} subtitle="Email" />
            ) : null}
            {contact.address ? (
              <ListRow icon="location-outline" title={contact.address} subtitle="Address" />
            ) : null}
          </ListGroup>
        </Section>
      ) : null}

      {contact.note ? (
        <Section title="Note">
          <Card>
            <Text color="textSecondary">{contact.note}</Text>
          </Card>
        </Section>
      ) : null}

      {open.length > 0 ? (
        <Section title="Open" caption="Still to settle">
          <View style={styles.list}>
            {open.map((item) => (
              <ObligationCard key={item.id} obligation={item} showContact={false} />
            ))}
          </View>
        </Section>
      ) : null}

      {settled.length > 0 ? (
        <Section title="Settled">
          <View style={styles.list}>
            {settled.map((item) => (
              <ObligationCard key={item.id} obligation={item} showContact={false} />
            ))}
          </View>
        </Section>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    gap: spacing.md,
  },
  totals: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: spacing.sm,
  },
  total: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  flex: {
    flex: 1,
  },
  list: {
    gap: spacing.md,
  },
});
