import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/ui/icon';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { haptics } from '@/lib/haptics';
import { useTheme } from '@/theme/theme-provider';
import { brandGradient, elevation, maxContentWidth, spacing } from '@/theme/tokens';

const TAB_ICONS: Record<string, { icon: IconName; iconFocused: IconName }> = {
  index: { icon: 'grid-outline', iconFocused: 'grid' },
  transactions: { icon: 'receipt-outline', iconFocused: 'receipt' },
  ledger: { icon: 'book-outline', iconFocused: 'book' },
  settings: { icon: 'settings-outline', iconFocused: 'settings' },
};

function TabItem({
  label,
  focused,
  icon,
  onPress,
  onLongPress,
}: {
  label: string;
  focused: boolean;
  icon: { icon: IconName; iconFocused: IconName };
  onPress: () => void;
  onLongPress: () => void;
}) {
  const { colors } = useTheme();
  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: withTiming(focused ? 1 : 0, { duration: 180 }),
    transform: [{ scaleX: withSpring(focused ? 1 : 0.3, { damping: 16, stiffness: 240 }) }],
  }));

  return (
    <PressableScale
      scaleTo={0.9}
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      style={styles.item}>
      <Animated.View
        style={[styles.indicator, { backgroundColor: colors.primaryMuted }, indicatorStyle]}
      />
      <Icon
        name={focused ? icon.iconFocused : icon.icon}
        size={22}
        color={focused ? 'primary' : 'textMuted'}
      />
      <Text
        variant="micro"
        weight={focused ? 'semibold' : 'medium'}
        color={focused ? 'primary' : 'textMuted'}
        numberOfLines={1}>
        {label}
      </Text>
    </PressableScale>
  );
}

function AddButton() {
  const { colors, isDark } = useTheme();
  return (
    <View style={styles.addSlot}>
      <PressableScale
        scaleTo={0.9}
        onPress={() => {
          haptics.medium();
          router.push('/transaction/new');
        }}
        accessibilityRole="button"
        accessibilityLabel="Add transaction"
        style={[styles.addButton, elevation(2, '#4F46E5', isDark)]}>
        <View style={[styles.addInner, { borderColor: colors.tabBar }]}>
          <LinearGradient
            colors={brandGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Icon name="add" size={30} color="#FFFFFF" />
        </View>
      </PressableScale>
    </View>
  );
}

/** Bottom navigation with a raised "add transaction" action in the middle. */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const half = Math.ceil(state.routes.length / 2);

  const items = state.routes.map((route, index) => {
    const { options } = descriptors[route.key];
    const label = options.title ?? route.name;
    const focused = state.index === index;
    return (
      <TabItem
        key={route.key}
        label={label}
        focused={focused}
        icon={TAB_ICONS[route.name] ?? { icon: 'ellipse-outline', iconFocused: 'ellipse' }}
        onPress={() => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            haptics.selection();
            navigation.navigate(route.name, route.params);
          }
        }}
        onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
      />
    );
  });

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.border,
          paddingBottom: Math.max(insets.bottom, spacing.sm),
        },
      ]}>
      <View style={styles.row}>
        {items.slice(0, half)}
        <AddButton />
        {items.slice(half)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: spacing.sm,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: spacing.xs,
  },
  indicator: {
    position: 'absolute',
    top: 0,
    width: 56,
    height: 30,
    borderRadius: 15,
  },
  addSlot: {
    flex: 1,
    alignItems: 'center',
  },
  addButton: {
    width: 62,
    height: 62,
    borderRadius: 31,
    marginTop: -32,
  },
  addInner: {
    flex: 1,
    borderRadius: 31,
    borderWidth: 4,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
