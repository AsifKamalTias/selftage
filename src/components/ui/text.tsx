import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { useTheme } from '@/theme/theme-provider';
import {
  defaultWeights,
  fonts,
  typography,
  type ColorName,
  type FontWeight,
  type TypographyVariant,
} from '@/theme/tokens';

export interface TextProps extends RNTextProps {
  variant?: TypographyVariant;
  weight?: FontWeight;
  /** A theme color name or any raw color value. */
  color?: ColorName | (string & {});
  align?: 'left' | 'center' | 'right';
  /** Fixed-width digits, for amounts in lists and tables. */
  tabular?: boolean;
  uppercase?: boolean;
}

export function Text({
  variant = 'body',
  weight,
  color = 'text',
  align,
  tabular,
  uppercase,
  style,
  maxFontSizeMultiplier = 1.4,
  ...rest
}: TextProps) {
  const { colors } = useTheme();
  const resolvedColor = color in colors ? colors[color as ColorName] : color;

  return (
    <RNText
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[
        typography[variant],
        { fontFamily: fonts[weight ?? defaultWeights[variant]], color: resolvedColor },
        align && { textAlign: align },
        tabular && { fontVariant: ['tabular-nums'] },
        uppercase && { textTransform: 'uppercase', letterSpacing: 0.6 },
        style,
      ]}
      {...rest}
    />
  );
}
