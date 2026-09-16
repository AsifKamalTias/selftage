import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useSettings } from '@/features/settings/settings-provider';
import { useTheme } from '@/theme/theme-provider';
import { brandGradient, elevation, radius, spacing } from '@/theme/tokens';

function Flow({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View style={styles.flow}>
      <View style={styles.flowIcon}>
        <Icon name={icon} size={16} color="#FFFFFF" />
      </View>
      <View style={styles.flowText}>
        <Text variant="micro" color="rgba(255,255,255,0.72)">
          {label}
        </Text>
        <Text variant="body" weight="semibold" color="#FFFFFF" tabular numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

export function BalanceHero({
  totalBalance,
  income,
  expense,
  periodLabel,
}: {
  totalBalance: number;
  income: number;
  expense: number;
  periodLabel: string;
}) {
  const { formatAmount } = useSettings();
  const { isDark } = useTheme();
  const net = income - expense;
  const savingsRate = income > 0 ? Math.round((net / income) * 100) : null;

  return (
    <View style={[styles.shadow, elevation(3, '#4F46E5', isDark)]}>
      <View style={styles.card}>
        <LinearGradient
          colors={brandGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, styles.gradient]}
        />
        <View style={[styles.orb, styles.orbLarge]} />
        <View style={[styles.orb, styles.orbSmall]} />

        <View style={styles.top}>
          <Text variant="caption" weight="medium" color="rgba(255,255,255,0.75)">
            Total balance
          </Text>
          <View style={styles.pill}>
            <Text variant="micro" weight="semibold" color="#FFFFFF">
              {periodLabel}
            </Text>
          </View>
        </View>
        <Text
          variant="display"
          color="#FFFFFF"
          tabular
          numberOfLines={1}
          adjustsFontSizeToFit
          accessibilityLabel={`Total balance ${formatAmount(totalBalance)}`}>
          {formatAmount(totalBalance)}
        </Text>
        <Text variant="caption" color="rgba(255,255,255,0.75)">
          {net >= 0 ? 'Saved ' : 'Overspent '}
          <Text variant="caption" weight="semibold" color="#FFFFFF">
            {formatAmount(Math.abs(net))}
          </Text>
          {savingsRate != null && savingsRate > 0 ? ` · ${savingsRate}% of income` : ''}
        </Text>

        <View style={[styles.flows, { borderTopColor: 'rgba(255,255,255,0.18)' }]}>
          <Flow icon="arrow-down" label="Income" value={formatAmount(income)} />
          <View style={[styles.divider, { backgroundColor: 'rgba(255,255,255,0.18)' }]} />
          <Flow icon="arrow-up" label="Expense" value={formatAmount(expense)} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    borderRadius: radius.xxl,
  },
  card: {
    borderRadius: radius.xxl,
    padding: spacing.xl,
    gap: spacing.sm,
    overflow: 'hidden',
    backgroundColor: '#5B4FE9',
  },
  gradient: {
    borderRadius: radius.xxl,
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  orbLarge: {
    width: 220,
    height: 220,
    top: -90,
    right: -70,
  },
  orbSmall: {
    width: 120,
    height: 120,
    bottom: -50,
    left: -30,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pill: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  flows: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  flow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
  },
  flowIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  flowText: {
    flex: 1,
    gap: 1,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginHorizontal: spacing.md,
  },
});
