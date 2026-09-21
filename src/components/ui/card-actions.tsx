import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/theme-provider';
import { spacing } from '@/theme/tokens';

import { Icon, type IconName } from './icon';
import { Loader } from './loader';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

export interface CardAction {
  key: string;
  label: string;
  icon: IconName;
  onPress: () => void;
  /** Paints the action in the danger colour. */
  destructive?: boolean;
  loading?: boolean;
  disabled?: boolean;
}

/**
 * A row of compact actions along the bottom of a card, so a list item can be acted on
 * without opening it. Taps here never reach the card underneath.
 */
export function CardActions({ actions }: { actions: CardAction[] }) {
  const { colors } = useTheme();
  if (actions.length === 0) return null;

  return (
    <View style={[styles.row, { borderTopColor: colors.border }]}>
      {actions.map((action) => {
        const disabled = action.disabled || action.loading;
        const tint = action.destructive ? colors.danger : colors.primary;
        return (
          <PressableScale
            key={action.key}
            scaleTo={0.94}
            disabled={disabled}
            onPress={action.onPress}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            accessibilityState={{ disabled: !!disabled }}
            style={[styles.action, disabled && styles.disabled]}>
            {action.loading ? (
              <Loader size={15} strokeWidth={2} />
            ) : (
              <Icon name={action.icon} size={15} color={tint} />
            )}
            <Text variant="micro" weight="semibold" style={{ color: tint }} numberOfLines={1}>
              {action.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  action: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs + 2,
  },
  disabled: {
    opacity: 0.45,
  },
});
