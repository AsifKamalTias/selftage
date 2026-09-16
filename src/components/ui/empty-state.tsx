import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/theme-provider';
import { spacing } from '@/theme/tokens';

import { Button } from './button';
import { Icon, type IconName } from './icon';
import { Text } from './text';

export interface EmptyStateProps {
  icon: IconName;
  title: string;
  message?: string;
  action?: { label: string; onPress: () => void; icon?: IconName };
  compact?: boolean;
}

export function EmptyState({ icon, title, message, action, compact = false }: EmptyStateProps) {
  const { colors } = useTheme();
  const size = compact ? 56 : 80;
  return (
    <View style={[styles.container, { paddingVertical: compact ? spacing.xl : spacing.huge }]}>
      <View
        style={[
          styles.iconWrap,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: colors.primaryMuted,
          },
        ]}>
        <Icon name={icon} size={size * 0.45} color="primary" />
      </View>
      <View style={styles.text}>
        <Text variant={compact ? 'body' : 'subheading'} weight="semibold" align="center">
          {title}
        </Text>
        {message ? (
          <Text variant="callout" color="textSecondary" align="center">
            {message}
          </Text>
        ) : null}
      </View>
      {action ? (
        <Button
          title={action.label}
          icon={action.icon}
          onPress={action.onPress}
          variant="secondary"
          size="sm"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.xxl,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    gap: spacing.xs,
    maxWidth: 320,
  },
});
