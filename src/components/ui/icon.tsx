import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import type { StyleProp, TextStyle } from 'react-native';

import { useTheme } from '@/theme/theme-provider';
import type { ColorName } from '@/theme/tokens';

export type IconName = ComponentProps<typeof Ionicons>['name'];

const FALLBACK_ICON: IconName = 'ellipse-outline';

/** Narrows icon names coming from the database, which are plain strings. */
export function toIconName(name: string | null | undefined): IconName {
  return name && name in Ionicons.glyphMap ? (name as IconName) : FALLBACK_ICON;
}

export interface IconProps {
  name: IconName | (string & {});
  size?: number;
  color?: ColorName | (string & {});
  style?: StyleProp<TextStyle>;
}

export function Icon({ name, size = 20, color = 'text', style }: IconProps) {
  const { colors } = useTheme();
  const resolvedColor = color in colors ? colors[color as ColorName] : color;
  return (
    <Ionicons
      name={toIconName(name)}
      size={size}
      color={resolvedColor}
      style={style}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}
