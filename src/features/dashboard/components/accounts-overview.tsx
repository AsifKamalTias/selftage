import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Amount } from '@/components/ui/amount';
import { Card } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { HorizontalScroll } from '@/components/ui/horizontal-scroll';
import { IconBadge } from '@/components/ui/icon-badge';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Section } from '@/components/ui/section';
import { Text } from '@/components/ui/text';
import type { Transaction } from '@/db/types';
import { useSettings } from '@/features/settings/settings-provider';
import { radius, spacing, withAlpha } from '@/theme/tokens';
import { useTheme } from '@/theme/theme-provider';

import type { AccountActivity } from '../repository';

export function AccountsStrip({ accounts }: { accounts: AccountActivity[] }) {
  const { colors } = useTheme();
  return (
    <Section
      title="Accounts"
      action={{ label: 'Manage', onPress: () => router.push('/manage/accounts') }}>
      <HorizontalScroll gap={spacing.md}>
        {accounts.map((account) => (
          <PressableScale
            key={account.id}
            scaleTo={0.97}
            accessibilityLabel={`${account.name} ledger`}
            onPress={() => router.push({ pathname: '/ledger', params: { accountId: account.id } })}
            style={[
              styles.accountCard,
              {
                backgroundColor: colors.surface,
                borderColor: withAlpha(account.color, 0.35),
              },
            ]}>
            <View style={styles.accountTop}>
              <IconBadge icon={account.icon} color={account.color} size={36} />
              <View style={styles.accountTitle}>
                <Text variant="callout" weight="semibold" numberOfLines={1}>
                  {account.name}
                </Text>
                <Text variant="micro" color="textMuted" numberOfLines={1}>
                  {account.accountTypeName}
                </Text>
              </View>
            </View>
            <Amount
              value={account.balance}
              variant="heading"
              weight="bold"
              colorize={account.balance < 0}
            />
            <View style={[styles.accountBar, { backgroundColor: withAlpha(account.color, 0.9) }]} />
          </PressableScale>
        ))}
      </HorizontalScroll>
    </Section>
  );
}

export function AccountTable({ accounts }: { accounts: AccountActivity[] }) {
  const { formatAmount } = useSettings();
  const income = accounts.reduce((s, a) => s + a.income, 0);
  const expense = accounts.reduce((s, a) => s + a.expense, 0);
  const balance = accounts.reduce((s, a) => s + a.balance, 0);

  return (
    <Section title="Account summary" caption="Activity in this period and current balance">
      <DataTable
        rows={accounts}
        keyExtractor={(a) => a.id}
        onRowPress={(a) => router.push({ pathname: '/ledger', params: { accountId: a.id } })}
        columns={[
          {
            key: 'name',
            title: 'Account',
            flex: 1.4,
            render: (a) => (
              <View style={styles.nameCell}>
                <View style={[styles.dot, { backgroundColor: a.color }]} />
                <Text variant="caption" weight="medium" numberOfLines={1} style={styles.flex}>
                  {a.name}
                </Text>
              </View>
            ),
          },
          {
            key: 'flow',
            title: 'In / Out',
            align: 'right',
            flex: 1.2,
            render: (a) => (
              <View style={styles.flowCell}>
                <Amount
                  value={a.income}
                  variant="caption"
                  weight="medium"
                  color={a.income ? 'income' : 'textMuted'}
                />
                <Amount
                  value={a.expense}
                  variant="caption"
                  weight="medium"
                  color={a.expense ? 'expense' : 'textMuted'}
                />
              </View>
            ),
          },
          {
            key: 'balance',
            title: 'Balance',
            align: 'right',
            render: (a) => <Amount value={a.balance} variant="caption" weight="semibold" />,
          },
        ]}
        footer={{
          name: 'Total',
          flow: (
            <View style={styles.flowCell}>
              <Text variant="caption" weight="bold" color="income" tabular>
                {formatAmount(income)}
              </Text>
              <Text variant="caption" weight="bold" color="expense" tabular>
                {formatAmount(expense)}
              </Text>
            </View>
          ),
          balance: formatAmount(balance),
        }}
      />
    </Section>
  );
}

export function TopExpensesTable({ items }: { items: Transaction[] }) {
  const { formatDate } = useSettings();
  if (items.length === 0) return null;
  return (
    <Section title="Largest expenses" caption="Top spending in this period">
      <DataTable
        rows={items}
        keyExtractor={(t) => t.id}
        onRowPress={(t) => router.push({ pathname: '/transaction/[id]', params: { id: t.id } })}
        columns={[
          {
            key: 'title',
            title: 'Expense',
            flex: 1.6,
            render: (t) => (
              <View style={styles.titleCell}>
                <Text variant="caption" weight="medium" numberOfLines={1}>
                  {t.title}
                </Text>
                <Text variant="micro" color="textMuted" numberOfLines={1}>
                  {t.categoryName}
                </Text>
              </View>
            ),
          },
          { key: 'date', title: 'Date', render: (t) => formatDate(t.date) },
          {
            key: 'amount',
            title: 'Amount',
            align: 'right',
            render: (t) => <Amount value={t.amount} variant="caption" color="expense" />,
          },
        ]}
      />
    </Section>
  );
}

export function RecentCard({ children }: { children: React.ReactNode }) {
  return (
    <Section
      title="Recent transactions"
      action={{ label: 'See all', onPress: () => router.push('/transactions') }}>
      <Card style={styles.recent}>{children}</Card>
    </Section>
  );
}

const styles = StyleSheet.create({
  accountCard: {
    width: 180,
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.md + 2,
    gap: spacing.md,
    overflow: 'hidden',
  },
  accountTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  accountTitle: {
    flex: 1,
  },
  accountBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
  },
  nameCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  flowCell: {
    alignItems: 'flex-end',
    gap: 2,
  },
  titleCell: {
    gap: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  flex: {
    flex: 1,
  },
  recent: {
    paddingVertical: spacing.xs,
  },
});
