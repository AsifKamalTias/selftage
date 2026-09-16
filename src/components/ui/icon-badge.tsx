import { View } from 'react-native';

import { useTheme } from '@/theme/theme-provider';
import { withAlpha } from '@/theme/tokens';

import { Icon } from './icon';

export interface IconBadgeProps {
  icon: string;
  color: string;
  size?: number;
  /** Solid background with white glyph instead of a tinted one. */
  solid?: boolean;
}

/** Rounded colored tile used as the avatar for types, sources and accounts. */
export function IconBadge({ icon, color, size = 40, solid = false }: IconBadgeProps) {
  const { isDark } = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: solid ? color : withAlpha(color, isDark ? 0.2 : 0.14),
      }}>
      <Icon name={icon} size={Math.round(size * 0.5)} color={solid ? '#FFFFFF' : color} />
    </View>
  );
}
