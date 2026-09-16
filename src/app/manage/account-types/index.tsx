import { router, Stack } from 'expo-router';
import { StyleSheet } from 'react-native';

import { Button, IconButton } from '@/components/ui/button';
import { ListGroup, ListRow } from '@/components/ui/list-row';
import { ListSkeleton } from '@/components/ui/loader';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useAccountTypes } from '@/features/accounts/hooks';
import { spacing } from '@/theme/tokens';

export default function AccountTypesScreen() {
  const { data, isPending } = useAccountTypes();

  return (
    <Screen safeBottom>
      <Stack.Screen
        options={{
          headerRight: () => (
            <IconButton
              icon="add"
              variant="plain"
              accessibilityLabel="Add account type"
              onPress={() => router.push('/manage/account-types/form')}
            />
          ),
        }}
      />
      <Text variant="callout" color="textSecondary" style={styles.intro}>
        Group your accounts by kind — cash, bank, mobile banking, cheque and more.
      </Text>
      {isPending ? (
        <ListSkeleton rows={4} />
      ) : (
        <ListGroup>
          {(data ?? []).map((type) => (
            <ListRow
              key={type.id}
              icon={type.icon}
              iconColor={type.color}
              title={type.name}
              subtitle={
                type.accountCount
                  ? `${type.accountCount} account${type.accountCount === 1 ? '' : 's'}`
                  : 'No accounts yet'
              }
              onPress={() =>
                router.push({ pathname: '/manage/account-types/form', params: { id: type.id } })
              }
            />
          ))}
        </ListGroup>
      )}
      <Button
        title="Add account type"
        icon="add"
        variant="secondary"
        onPress={() => router.push('/manage/account-types/form')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: {
    marginBottom: -spacing.sm,
  },
});
