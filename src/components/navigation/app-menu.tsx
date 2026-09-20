import { router, type Href } from 'expo-router';
import { createContext, use, useCallback, useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { SlideInLeft } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LogoMark } from '@/components/brand/logo-mark';
import { IconButton } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icon';
import { IconBadge } from '@/components/ui/icon-badge';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { useAccounts, useAccountTypes } from '@/features/accounts/hooks';
import { useBudgetStatuses } from '@/features/budgets/hooks';
import { useCatalog } from '@/features/catalog/hooks';
import { useGoals } from '@/features/goals/hooks';
import { useRecurringRules } from '@/features/recurring/hooks';
import { useTheme } from '@/theme/theme-provider';
import { brandGradient, elevation, radius, spacing } from '@/theme/tokens';

interface MenuContextValue {
  open: () => void;
  close: () => void;
}

const MenuContext = createContext<MenuContextValue | null>(null);

export function useAppMenu(): MenuContextValue {
  const context = use(MenuContext);
  if (!context) throw new Error('useAppMenu must be used inside <AppMenuProvider>');
  return context;
}

/** Opens the side menu; sits on the left of every tab screen header. */
export function MenuButton() {
  const { open } = useAppMenu();
  return <IconButton icon="menu" accessibilityLabel="Open menu" onPress={open} size={42} />;
}

export function AppMenuProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const open = useCallback(() => setVisible(true), []);
  const close = useCallback(() => setVisible(false), []);

  return (
    <MenuContext value={{ open, close }}>
      {children}
      <AppMenu visible={visible} onClose={close} />
    </MenuContext>
  );
}

interface MenuItem {
  icon: IconName;
  color: string;
  title: string;
  subtitle: string;
  href: Href;
}

function MenuRow({ item, onPress }: { item: MenuItem; onPress: () => void }) {
  return (
    <PressableScale
      scaleTo={0.98}
      onPress={onPress}
      accessibilityLabel={`${item.title}, ${item.subtitle}`}
      style={styles.row}>
      <IconBadge icon={item.icon} color={item.color} size={38} />
      <View style={styles.rowText}>
        <Text weight="medium" numberOfLines={1}>
          {item.title}
        </Text>
        <Text variant="caption" color="textMuted" numberOfLines={1}>
          {item.subtitle}
        </Text>
      </View>
      <Icon name="chevron-forward" size={16} color="textMuted" />
    </PressableScale>
  );
}

function AppMenu({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const accounts = useAccounts({ includeArchived: false });
  const accountTypes = useAccountTypes();
  const categories = useCatalog('categories');
  const sources = useCatalog('sources');
  const budgets = useBudgetStatuses({ includeInactive: true });
  const recurring = useRecurringRules();
  const goals = useGoals();

  const count = (value: number | undefined, one: string, many = `${one}s`) =>
    value == null ? '—' : `${value} ${value === 1 ? one : many}`;

  const attention = (budgets.data ?? []).filter((b) => b.isActive && b.health !== 'ok').length;
  const activeRecurring = (recurring.data ?? []).filter((r) => r.isActive).length;
  const activeGoals = (goals.data ?? []).filter((g) => g.status === 'active').length;

  const groups: { title: string; items: MenuItem[] }[] = [
    {
      title: 'Plan',
      items: [
        {
          icon: 'speedometer-outline',
          color: '#6366F1',
          title: 'Budgets',
          subtitle: attention
            ? `${attention} need${attention === 1 ? 's' : ''} attention`
            : count(budgets.data?.length, 'budget'),
          href: '/budgets',
        },
        {
          icon: 'flag-outline',
          color: '#14B8A6',
          title: 'Goals',
          subtitle: goals.data?.length
            ? `${activeGoals} in progress of ${goals.data.length}`
            : 'Save towards a target',
          href: '/goals',
        },
        {
          icon: 'repeat',
          color: '#0EA5E9',
          title: 'Recurring',
          subtitle: recurring.data?.length
            ? `${activeRecurring} active of ${recurring.data.length}`
            : 'Repeat income or expenses',
          href: '/recurring',
        },
      ],
    },
    {
      title: 'Organise',
      items: [
        {
          icon: 'wallet-outline',
          color: '#10B981',
          title: 'Accounts',
          subtitle: count(accounts.data?.length, 'active account'),
          href: '/manage/accounts',
        },
        {
          icon: 'albums-outline',
          color: '#3B82F6',
          title: 'Account types',
          subtitle: count(accountTypes.data?.length, 'type'),
          href: '/manage/account-types',
        },
        {
          icon: 'pricetags-outline',
          color: '#F97316',
          title: 'Income & expense types',
          subtitle: count(categories.data?.length, 'type'),
          href: '/manage/types',
        },
        {
          icon: 'people-outline',
          color: '#EC4899',
          title: 'Sources',
          subtitle: count(sources.data?.length, 'source'),
          href: '/manage/sources',
        },
      ],
    },
    {
      title: 'Reports',
      items: [
        {
          icon: 'document-text-outline',
          color: '#8B5CF6',
          title: 'Ledger report',
          subtitle: 'Statements, PDF and CSV',
          href: '/reports/ledger',
        },
      ],
    },
  ];

  const go = (href: Href) => {
    onClose();
    router.push(href);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close menu"
        />
        {visible ? (
          <Animated.View
            entering={SlideInLeft.duration(240)}
            accessibilityViewIsModal
            style={[
              styles.panel,
              {
                backgroundColor: colors.background,
                width: Math.min(320, width * 0.86),
                paddingTop: insets.top + spacing.lg,
                paddingBottom: insets.bottom + spacing.lg,
              },
              elevation(3, colors.shadow, isDark),
            ]}>
            <View style={styles.header}>
              <View style={[styles.logo, { backgroundColor: brandGradient[0] }]}>
                <LogoMark size={28} />
              </View>
              <View style={styles.rowText}>
                <Text variant="subheading">Selftage</Text>
                <Text variant="caption" color="textMuted">
                  Manage your setup
                </Text>
              </View>
              <IconButton
                icon="close"
                size={36}
                accessibilityLabel="Close menu"
                onPress={onClose}
              />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
              {groups.map((group) => (
                <View key={group.title} style={styles.group}>
                  <Text variant="label" color="textSecondary" uppercase>
                    {group.title}
                  </Text>
                  <View
                    style={[
                      styles.card,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                    ]}>
                    {group.items.map((item, index) => (
                      <View key={String(item.href)}>
                        {index > 0 ? (
                          <View style={[styles.separator, { backgroundColor: colors.border }]} />
                        ) : null}
                        <MenuRow item={item} onPress={() => go(item.href)} />
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>

            <PressableScale
              scaleTo={0.98}
              onPress={() => go('/settings')}
              accessibilityLabel="Settings"
              style={[styles.footer, { borderTopColor: colors.border }]}>
              <Icon name="settings-outline" size={18} color="textSecondary" />
              <Text variant="callout" weight="medium" color="textSecondary" style={styles.rowText}>
                Settings
              </Text>
              <Icon name="chevron-forward" size={16} color="textMuted" />
            </PressableScale>
          </Animated.View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    borderTopRightRadius: radius.xxl,
    borderBottomRightRadius: radius.xxl,
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    gap: spacing.xl,
    paddingBottom: spacing.lg,
  },
  group: {
    gap: spacing.sm,
  },
  card: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  rowText: {
    flex: 1,
    gap: 1,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: spacing.md + 38 + spacing.md,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.md,
  },
});
