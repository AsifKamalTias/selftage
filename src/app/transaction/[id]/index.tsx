import { router, Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Amount } from '@/components/ui/amount';
import { Button, IconButton } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { confirm } from '@/components/ui/confirm';
import { EmptyState } from '@/components/ui/empty-state';
import { IconBadge } from '@/components/ui/icon-badge';
import { ListGroup, ListRow } from '@/components/ui/list-row';
import { ScreenLoader } from '@/components/ui/loader';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { Text } from '@/components/ui/text';
import { useToast } from '@/components/ui/toast';
import { AttachmentGallery } from '@/features/attachments/components/attachment-gallery';
import { useSettings } from '@/features/settings/settings-provider';
import { useDeleteTransaction, useTransaction } from '@/features/transactions/hooks';
import { countOf } from '@/lib/text';
import { goBack } from '@/lib/navigation';
import { useTheme } from '@/theme/theme-provider';
import { radius, spacing } from '@/theme/tokens';

function formatTimestamp(iso: string) {
  const date = new Date(iso);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isPending } = useTransaction(id);
  const remove = useDeleteTransaction();
  const { formatDate } = useSettings();
  const { colors } = useTheme();
  const toast = useToast();

  if (isPending) return <ScreenLoader />;
  if (!data) {
    return (
      <EmptyState
        icon="search-outline"
        title="Transaction not found"
        message="It may have been deleted."
        action={{ label: 'Go back', onPress: () => goBack('/transactions') }}
      />
    );
  }

  const isIncome = data.kind === 'income';
  const tint = isIncome ? colors.income : colors.expense;

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Delete transaction?',
      message: 'This removes it from your history and ledger, along with its attachments.',
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(data.id);
      toast.success('Transaction deleted');
      goBack('/transactions');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not delete');
    }
  };

  return (
    <Screen safeBottom>
      <Stack.Screen
        options={{
          headerRight: () => (
            <IconButton
              icon="create-outline"
              variant="plain"
              accessibilityLabel="Edit transaction"
              onPress={() =>
                router.push({ pathname: '/transaction/[id]/edit', params: { id: data.id } })
              }
            />
          ),
        }}
      />

      <Card style={styles.hero}>
        <IconBadge icon={data.categoryIcon} color={data.categoryColor} size={64} />
        <Text variant="heading" align="center">
          {data.title}
        </Text>
        <Amount value={data.amount} kind={data.kind} signed colorize variant="display" />
        <View
          style={[
            styles.badge,
            { backgroundColor: isIncome ? colors.incomeMuted : colors.expenseMuted },
          ]}>
          <Text variant="label" weight="semibold" color={tint}>
            {isIncome ? 'Income' : 'Expense'} · {formatDate(data.date)}
          </Text>
        </View>
      </Card>

      <Section title="Details">
        <ListGroup>
          <ListRow
            icon={data.categoryIcon}
            iconColor={data.categoryColor}
            title={data.categoryName}
            subtitle={isIncome ? 'Income type' : 'Expense type'}
          />
          <ListRow
            icon="people"
            title={data.sourceName ?? 'Not specified'}
            subtitle={isIncome ? 'Received from' : 'Paid to'}
          />
          <ListRow
            icon="wallet"
            title={data.accountName}
            subtitle={
              isIncome ? 'Deposited to · recorded as debit' : 'Paid from · recorded as credit'
            }
            onPress={() =>
              router.push({ pathname: '/ledger', params: { accountId: data.accountId } })
            }
            accessibilityHint="Opens the account ledger"
          />
          {data.groupId ? (
            <ListRow
              icon={data.groupIcon ?? 'albums'}
              iconColor={data.groupColor ?? undefined}
              title={data.groupName ?? 'Group'}
              subtitle="Group"
              onPress={() =>
                router.push({ pathname: '/transactions', params: { groupId: data.groupId! } })
              }
              accessibilityHint="Opens the entries in this group"
            />
          ) : null}
          {data.obligationId ? (
            <ListRow
              icon="reader"
              title={data.obligationTitle ?? 'Outstanding record'}
              subtitle={
                data.contactName
                  ? `Settles what ${data.contactName} ${
                      data.kind === 'income' ? 'owed you' : 'you owed'
                    }`
                  : 'Settles an outstanding record'
              }
              onPress={() =>
                router.push({
                  pathname: '/outstanding/[id]',
                  params: { id: data.obligationId! },
                })
              }
              accessibilityHint="Opens the outstanding record"
            />
          ) : null}
          <ListRow icon="calendar" title={formatDate(data.date)} subtitle="Date" />
          {data.recurringId ? (
            <ListRow
              icon="repeat"
              title={data.recurringName ?? 'Recurring'}
              subtitle="Posted automatically by this recurring"
              onPress={() =>
                router.push({ pathname: '/recurring/form', params: { id: data.recurringId! } })
              }
              accessibilityHint="Opens the recurring"
            />
          ) : null}
          {data.goalId ? (
            <ListRow
              icon="flag"
              title={data.goalName ?? 'Goal'}
              subtitle="Spent from money held for this goal"
              onPress={() => router.push({ pathname: '/goals/[id]', params: { id: data.goalId! } })}
              accessibilityHint="Opens the goal"
            />
          ) : null}
        </ListGroup>
      </Section>

      {data.note ? (
        <Section title="Note">
          <Card>
            <Text color="textSecondary">{data.note}</Text>
          </Card>
        </Section>
      ) : null}

      {data.attachments.length > 0 ? (
        <Section title="Attachments" caption={countOf(data.attachments.length, 'file')}>
          <AttachmentGallery items={data.attachments.map((a) => ({ key: a.id, ...a }))} />
        </Section>
      ) : null}

      <View style={styles.actions}>
        <Button
          title="Edit"
          icon="create-outline"
          variant="secondary"
          style={styles.flex}
          onPress={() =>
            router.push({ pathname: '/transaction/[id]/edit', params: { id: data.id } })
          }
        />
        <Button
          title="Duplicate"
          icon="copy-outline"
          variant="outline"
          style={styles.flex}
          onPress={() =>
            router.push({ pathname: '/transaction/new', params: { duplicateOf: data.id } })
          }
        />
      </View>
      <Button
        title="Delete transaction"
        icon="trash-outline"
        variant="danger"
        loading={remove.isPending}
        onPress={handleDelete}
      />

      <Text variant="micro" color="textMuted" align="center">
        Created {formatTimestamp(data.createdAt)}
        {data.updatedAt !== data.createdAt ? ` · Updated ${formatTimestamp(data.updatedAt)}` : ''}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxl,
  },
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 1,
    borderRadius: radius.pill,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  flex: {
    flex: 1,
  },
});
