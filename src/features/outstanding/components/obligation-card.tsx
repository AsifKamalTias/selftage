import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Amount } from '@/components/ui/amount';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Text } from '@/components/ui/text';
import type { Obligation } from '@/db/types';
import { ContactAvatar } from '@/features/contacts/components/contact-avatar';
import { useSettings } from '@/features/settings/settings-provider';
import { daysBetween, todayISO } from '@/lib/date';
import { useTheme } from '@/theme/theme-provider';
import { radius, spacing, type ColorName } from '@/theme/tokens';

/** "Due in 3 days" / "6 days overdue" / "Due today", plus how urgent that is. */
export function describeDue(
  dueDate: string | null,
  today = todayISO()
): { text: string; tone: ColorName } {
  if (!dueDate) return { text: 'No due date', tone: 'textMuted' };
  if (dueDate === today) return { text: 'Due today', tone: 'warning' };
  if (dueDate > today) {
    const days = daysBetween(today, dueDate);
    return { text: `Due in ${days} day${days === 1 ? '' : 's'}`, tone: 'textSecondary' };
  }
  const days = daysBetween(dueDate, today);
  return { text: `${days} day${days === 1 ? '' : 's'} overdue`, tone: 'expense' };
}

export function ObligationCard({
  obligation,
  showContact = true,
}: {
  obligation: Obligation;
  /** Hidden on a contact's own screen, where the name is already the heading. */
  showContact?: boolean;
}) {
  const { colors } = useTheme();
  const { formatAmount } = useSettings();
  const isReceivable = obligation.direction === 'receivable';
  const due = describeDue(obligation.dueDate);
  const progress = obligation.amount > 0 ? obligation.settled / obligation.amount : 0;
  const tint = isReceivable ? colors.income : colors.expense;

  return (
    <PressableScale
      scaleTo={0.99}
      onPress={() => router.push({ pathname: '/outstanding/[id]', params: { id: obligation.id } })}
      accessibilityLabel={`${obligation.title}, ${
        isReceivable ? 'owed to you' : 'you owe'
      }, ${formatAmount(obligation.remaining)} left`}>
      <Card style={styles.card}>
        <View style={styles.head}>
          {showContact ? (
            <ContactAvatar
              name={obligation.contactName}
              photoUri={obligation.contactPhotoUri}
              size={42}
            />
          ) : (
            <View style={[styles.badge, { backgroundColor: `${tint}1A` }]}>
              <Icon
                name={isReceivable ? 'arrow-down' : 'arrow-up'}
                size={18}
                color={isReceivable ? 'income' : 'expense'}
              />
            </View>
          )}
          <View style={styles.headText}>
            <Text variant="callout" weight="semibold" numberOfLines={1}>
              {obligation.title}
            </Text>
            <Text variant="micro" color="textMuted" numberOfLines={1}>
              {showContact ? `${obligation.contactName} · ` : ''}
              {isReceivable ? 'Owed to you' : 'You owe'}
            </Text>
          </View>
          <View style={styles.amounts}>
            <Amount
              value={obligation.remaining}
              variant="callout"
              weight="bold"
              color={obligation.isSettled ? 'textMuted' : isReceivable ? 'income' : 'expense'}
            />
            <Text variant="micro" color="textMuted">
              of {formatAmount(obligation.amount)}
            </Text>
          </View>
        </View>

        {obligation.isSettled ? null : <ProgressBar value={progress} color={tint} height={6} />}

        <View style={styles.footer}>
          {obligation.isSettled ? (
            <View style={styles.meta}>
              <Icon name="checkmark-circle" size={13} color="income" />
              <Text variant="micro" color="income" weight="semibold">
                Settled
              </Text>
            </View>
          ) : (
            <View style={styles.meta}>
              <Icon name="calendar-outline" size={13} color={due.tone} />
              <Text variant="micro" color={due.tone} weight="semibold">
                {due.text}
              </Text>
            </View>
          )}
          {obligation.installmentCount > 0 ? (
            <View style={[styles.pill, { backgroundColor: colors.surfaceMuted }]}>
              <Text variant="micro" color="textSecondary">
                {obligation.paidInstallments}/{obligation.installmentCount} installments
              </Text>
            </View>
          ) : obligation.paymentCount > 0 ? (
            <Text variant="micro" color="textMuted">
              {formatAmount(obligation.settled)} paid
            </Text>
          ) : null}
        </View>
      </Card>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm + 2,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  badge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headText: {
    flex: 1,
    gap: 2,
  },
  amounts: {
    alignItems: 'flex-end',
    gap: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
});
