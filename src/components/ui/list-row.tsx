import { Children, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/theme-provider';
import { radius, spacing } from '@/theme/tokens';

import { Icon } from './icon';
import { IconBadge } from './icon-badge';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

export interface ListRowProps {
  title: string;
  subtitle?: string | null;
  icon?: string;
  iconColor?: string;
  /** Text or element shown on the right. */
  value?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  destructive?: boolean;
  accessibilityHint?: string;
}

export function ListRow({
  title,
  subtitle,
  icon,
  iconColor,
  value,
  onPress,
  chevron = !!onPress,
  destructive = false,
  accessibilityHint,
}: ListRowProps) {
  const { colors } = useTheme();
  const tint = destructive ? colors.danger : (iconColor ?? colors.primary);
  return (
    <PressableScale
      onPress={onPress}
      disabled={!onPress}
      scaleTo={0.985}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      accessibilityHint={accessibilityHint}
      style={styles.row}>
      {icon ? <IconBadge icon={icon} color={tint} size={36} /> : null}
      <View style={styles.text}>
        <Text weight="medium" color={destructive ? 'danger' : 'text'} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" color="textMuted" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {typeof value === 'string' ? (
        <Text variant="callout" color="textSecondary" numberOfLines={1} style={styles.value}>
          {value}
        </Text>
      ) : (
        value
      )}
      {chevron ? <Icon name="chevron-forward" size={18} color={colors.textMuted} /> : null}
    </PressableScale>
  );
}

/** Groups rows inside a rounded card with hairline separators. */
export function ListGroup({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const items = Children.toArray(children);
  return (
    <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {items.map((child, index) => (
        <View key={(child as { key?: string }).key ?? index}>
          {index > 0 ? (
            <View style={[styles.separator, { backgroundColor: colors.border }]} />
          ) : null}
          {child}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 56,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  value: {
    maxWidth: '45%',
  },
  group: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: spacing.lg + 36 + spacing.md,
  },
});
