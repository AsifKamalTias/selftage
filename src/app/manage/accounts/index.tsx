import { router, Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Amount } from '@/components/ui/amount';
import { Button, IconButton } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { IconBadge } from '@/components/ui/icon-badge';
import { ListSkeleton } from '@/components/ui/loader';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { Text } from '@/components/ui/text';
import type { AccountWithBalance } from '@/db/types';
import { useAccounts } from '@/features/accounts/hooks';
import { useSettings } from '@/features/settings/settings-provider';
import { useTheme } from '@/theme/theme-provider';
import { radius, spacing } from '@/theme/tokens';

function AccountCard({ account, isDefault }: { account: AccountWithBalance; isDefault: boolean }) {
  const { colors } = useTheme();
  return (
    <PressableScale
      scaleTo={0.98}
      accessibilityLabel={`Edit ${account.name}`}
      onPress={() =>
        router.push({ pathname: '/manage/accounts/form', params: { id: account.id } })
      }>
      <Card style={[styles.account, account.isArchived && styles.archived]}>
        <View style={styles.accountTop}>
          <IconBadge icon={account.icon} color={account.color} size={44} />
          <View style={styles.flex}>
            <View style={styles.nameRow}>
              <Text weight="semibold" numberOfLines={1} style={styles.shrink}>
                {account.name}
              </Text>
              {isDefault ? (
                <View style={[styles.tag, { backgroundColor: colors.primaryMuted }]}>
                  <Text variant="micro" weight="semibold" color="primary">
                    Default
                  </Text>
                </View>
              ) : null}
              {account.isArchived ? (
                <View style={[styles.tag, { backgroundColor: colors.surfaceMuted }]}>
                  <Text variant="micro" weight="semibold" color="textMuted">
                    Archived
                  </Text>
                </View>
              ) : null}
            </View>
            <Text variant="caption" color="textMuted" numberOfLines={1}>
              {account.accountTypeName}
              {account.accountNumber ? ` · ${account.accountNumber}` : ''}
            </Text>
          </View>
          <Amount
            value={account.balance}
            variant="subheading"
            weight="bold"
            colorize={account.balance < 0}
          />
        </View>
        <View style={[styles.stats, { borderTopColor: colors.border }]}>
          <View style={styles.stat}>
            <Text variant="micro" color="textMuted">
              Income
            </Text>
            <Amount value={account.totalIncome} variant="caption" color="income" />
          </View>
          <View style={styles.stat}>
            <Text variant="micro" color="textMuted">
              Expense
            </Text>
            <Amount value={account.totalExpense} variant="caption" color="expense" />
          </View>
          <View style={styles.stat}>
            <Text variant="micro" color="textMuted">
              Transactions
            </Text>
            <Text variant="caption" weight="semibold">
              {account.transactionCount}
            </Text>
          </View>
        </View>
      </Card>
    </PressableScale>
  );
}

export default function AccountsScreen() {
  const { data, isPending } = useAccounts();
  const { settings } = useSettings();
  const active = (data ?? []).filter((a) => !a.isArchived);
  const archived = (data ?? []).filter((a) => a.isArchived);
  const total = active.reduce((sum, a) => sum + a.balance, 0);

  return (
    <Screen safeBottom>
      <Stack.Screen
        options={{
          headerRight: () => (
            <IconButton
              icon="add"
              variant="plain"
              accessibilityLabel="Add account"
              onPress={() => router.push('/manage/accounts/form')}
            />
          ),
        }}
      />
      <Card muted elevated={false} style={styles.total}>
        <Text variant="caption" color="textSecondary">
          Balance across {active.length} active account{active.length === 1 ? '' : 's'}
        </Text>
        <Amount value={total} variant="title" weight="bold" />
      </Card>

      {isPending ? (
        <ListSkeleton rows={3} />
      ) : (
        <>
          <Section title="Active">
            {active.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                isDefault={account.id === settings.defaultAccountId}
              />
            ))}
          </Section>
          {archived.length > 0 ? (
            <Section title="Archived" caption="Hidden from new transactions, kept in reports">
              {archived.map((account) => (
                <AccountCard key={account.id} account={account} isDefault={false} />
              ))}
            </Section>
          ) : null}
        </>
      )}

      <View style={styles.actions}>
        <Button
          title="Add account"
          icon="add"
          onPress={() => router.push('/manage/accounts/form')}
          style={styles.flex}
        />
        <Button
          title="Account types"
          icon="pricetags-outline"
          variant="outline"
          onPress={() => router.push('/manage/account-types')}
          style={styles.flex}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  shrink: {
    flexShrink: 1,
  },
  total: {
    gap: spacing.xs,
  },
  account: {
    gap: spacing.md,
  },
  archived: {
    opacity: 0.7,
  },
  accountTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  tag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  stats: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.md,
  },
  stat: {
    flex: 1,
    gap: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
});
