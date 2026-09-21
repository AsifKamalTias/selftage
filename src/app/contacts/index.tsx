import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Amount } from '@/components/ui/amount';
import { Button, IconButton } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ListSkeleton } from '@/components/ui/loader';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Screen } from '@/components/ui/screen';
import { SearchBar } from '@/components/ui/search-bar';
import { Text } from '@/components/ui/text';
import type { Contact } from '@/db/types';
import { ContactAvatar } from '@/features/contacts/components/contact-avatar';
import { useContacts } from '@/features/contacts/hooks';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { spacing } from '@/theme/tokens';

function ContactRow({ contact }: { contact: Contact }) {
  const balanceLine =
    contact.net > 0
      ? 'owes you'
      : contact.net < 0
        ? 'you owe'
        : contact.obligationCount
          ? 'all settled'
          : contact.phone || 'No outstanding';

  return (
    <PressableScale
      onPress={() => router.push({ pathname: '/contacts/[id]', params: { id: contact.id } })}
      accessibilityLabel={`${contact.name}, ${balanceLine}`}>
      <Card style={styles.row}>
        <ContactAvatar name={contact.name} photoUri={contact.photoUri} size={46} />
        <View style={styles.rowText}>
          <Text variant="callout" weight="semibold" numberOfLines={1}>
            {contact.name}
          </Text>
          <Text variant="micro" color="textMuted" numberOfLines={1}>
            {contact.openCount
              ? `${contact.openCount} open · ${balanceLine}`
              : (contact.phone ?? balanceLine)}
          </Text>
        </View>
        {contact.net !== 0 ? (
          <Amount
            value={contact.net}
            variant="callout"
            weight="bold"
            signed
            colorize
            accessibilityLabel={undefined}
          />
        ) : null}
      </Card>
    </PressableScale>
  );
}

export default function ContactsScreen() {
  const [search, setSearch] = useState('');
  const term = useDebouncedValue(search).trim();
  const { data, isPending } = useContacts({ search: term || undefined });
  const contacts = data ?? [];

  return (
    <Screen safeBottom>
      <Stack.Screen
        options={{
          headerRight: () => (
            <IconButton
              icon="person-add-outline"
              variant="plain"
              accessibilityLabel="Add contact"
              onPress={() => router.push('/contacts/form')}
            />
          ),
        }}
      />

      {isPending ? (
        <ListSkeleton rows={4} />
      ) : contacts.length === 0 && !term ? (
        <EmptyState
          icon="people-outline"
          title="No contacts yet"
          message="Add the people you lend to or borrow from, then track what is still owed either way."
          action={{
            label: 'Add a contact',
            icon: 'person-add-outline',
            onPress: () => router.push('/contacts/form'),
          }}
        />
      ) : (
        <>
          <SearchBar value={search} onChangeText={setSearch} placeholder="Search name or phone" />
          {contacts.length === 0 ? (
            <EmptyState compact icon="search-outline" title="No contacts match that search" />
          ) : (
            <View style={styles.list}>
              {contacts.map((contact) => (
                <ContactRow key={contact.id} contact={contact} />
              ))}
            </View>
          )}
          <Button
            title="Add contact"
            icon="person-add-outline"
            variant="secondary"
            onPress={() => router.push('/contacts/form')}
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
});
