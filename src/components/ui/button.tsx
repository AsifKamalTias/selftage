import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/theme-provider';
import { brandGradient, radius, spacing, type ThemeColors } from '@/theme/tokens';

import { Icon, type IconName } from './icon';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

export type ButtonVariant = 'primary' | 'gradient' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  iconRight?: IconName;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  /** Overrides the background of primary/gradient buttons (e.g. income/expense color). */
  tint?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

const SIZES: Record<ButtonSize, { height: number; paddingX: number; icon: number }> = {
  sm: { height: 36, paddingX: spacing.md, icon: 16 },
  md: { height: 48, paddingX: spacing.lg, icon: 18 },
  lg: { height: 56, paddingX: spacing.xl, icon: 20 },
};

function variantColors(variant: ButtonVariant, colors: ThemeColors, tint?: string) {
  switch (variant) {
    case 'secondary':
      return { background: colors.primaryMuted, foreground: colors.primary, border: 'transparent' };
    case 'outline':
      return { background: 'transparent', foreground: colors.text, border: colors.borderStrong };
    case 'ghost':
      return { background: 'transparent', foreground: colors.primary, border: 'transparent' };
    case 'danger':
      return { background: colors.dangerMuted, foreground: colors.danger, border: 'transparent' };
    default:
      return {
        background: tint ?? colors.primary,
        foreground: colors.onPrimary,
        border: 'transparent',
      };
  }
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  loading = false,
  disabled = false,
  fullWidth = false,
  tint,
  style,
  accessibilityLabel,
}: ButtonProps) {
  const { colors } = useTheme();
  const dims = SIZES[size];
  const palette = variantColors(variant, colors, tint);
  const useGradient = variant === 'gradient' && !tint;

  const content = (
    <View style={[styles.content, { paddingHorizontal: dims.paddingX }]}>
      {loading ? (
        <ActivityIndicator size="small" color={palette.foreground} />
      ) : (
        icon && <Icon name={icon} size={dims.icon} color={palette.foreground} />
      )}
      <Text
        variant={size === 'sm' ? 'callout' : 'body'}
        weight="semibold"
        color={palette.foreground}
        numberOfLines={1}>
        {title}
      </Text>
      {iconRight && !loading && (
        <Icon name={iconRight} size={dims.icon} color={palette.foreground} />
      )}
    </View>
  );

  return (
    <PressableScale
      haptic
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={[
        styles.base,
        {
          height: dims.height,
          backgroundColor: useGradient ? undefined : palette.background,
          borderColor: palette.border,
          borderRadius: size === 'sm' ? radius.md : radius.lg,
        },
        fullWidth && styles.fullWidth,
        style,
      ]}>
      {useGradient ? (
        <LinearGradient
          colors={brandGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: size === 'sm' ? radius.md : radius.lg }]}
        />
      ) : null}
      {content}
    </PressableScale>
  );
}

export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  variant = 'muted',
  size = 40,
  color,
  disabled,
}: {
  icon: IconName;
  onPress?: () => void;
  accessibilityLabel: string;
  variant?: 'muted' | 'plain' | 'primary';
  size?: number;
  color?: string;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  const background =
    variant === 'primary'
      ? colors.primary
      : variant === 'muted'
        ? colors.surfaceMuted
        : 'transparent';
  const foreground = color ?? (variant === 'primary' ? colors.onPrimary : colors.text);
  return (
    <PressableScale
      haptic
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
      scaleTo={0.9}
      style={[
        styles.iconButton,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: background },
      ]}>
      <Icon name={icon} size={Math.round(size * 0.5)} color={foreground} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
