import { View, type ViewProps } from 'react-native';

import { useTheme } from '@/theme/theme-provider';
import { elevation, radius, spacing } from '@/theme/tokens';

export interface CardProps extends ViewProps {
  padded?: boolean;
  elevated?: boolean;
  muted?: boolean;
}

export function Card({ padded = true, elevated = true, muted = false, style, ...rest }: CardProps) {
  const { colors, isDark } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: muted ? colors.surfaceMuted : colors.surface,
          borderRadius: radius.xl,
          borderWidth: isDark || !elevated ? 1 : 0,
          borderColor: colors.border,
        },
        padded && { padding: spacing.lg },
        elevated && elevation(1, colors.shadow, isDark),
        style,
      ]}
      {...rest}
    />
  );
}
