import { Platform, type TextStyle, type ViewStyle } from 'react-native';

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  borderStrong: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  primaryMuted: string;
  onPrimary: string;
  income: string;
  incomeMuted: string;
  expense: string;
  expenseMuted: string;
  warning: string;
  warningMuted: string;
  danger: string;
  dangerMuted: string;
  overlay: string;
  skeleton: string;
  chartGrid: string;
  tabBar: string;
  shadow: string;
}

export type ColorName = keyof ThemeColors;

export const lightColors: ThemeColors = {
  background: '#F4F5FA',
  surface: '#FFFFFF',
  surfaceMuted: '#EEF0F6',
  border: '#E3E6EE',
  borderStrong: '#CBD1DD',
  text: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#8A94A6',
  primary: '#4F46E5',
  primaryMuted: '#EEF0FF',
  onPrimary: '#FFFFFF',
  income: '#059669',
  incomeMuted: '#E7F8F1',
  expense: '#E11D48',
  expenseMuted: '#FDECF0',
  warning: '#D97706',
  warningMuted: '#FEF6E7',
  danger: '#DC2626',
  dangerMuted: '#FDEEEE',
  overlay: 'rgba(15, 23, 42, 0.45)',
  skeleton: '#E4E7EF',
  chartGrid: '#E9ECF3',
  tabBar: '#FFFFFF',
  shadow: '#0F172A',
};

export const darkColors: ThemeColors = {
  background: '#0A0C12',
  surface: '#141722',
  surfaceMuted: '#1C2030',
  border: '#252A3A',
  borderStrong: '#343B50',
  text: '#F1F4F9',
  textSecondary: '#A7B0C2',
  textMuted: '#6B7489',
  primary: '#7B80F7',
  primaryMuted: 'rgba(123, 128, 247, 0.16)',
  onPrimary: '#FFFFFF',
  income: '#34D399',
  incomeMuted: 'rgba(52, 211, 153, 0.14)',
  expense: '#FB7185',
  expenseMuted: 'rgba(251, 113, 133, 0.14)',
  warning: '#FBBF24',
  warningMuted: 'rgba(251, 191, 36, 0.14)',
  danger: '#F87171',
  dangerMuted: 'rgba(248, 113, 113, 0.14)',
  overlay: 'rgba(0, 0, 0, 0.6)',
  skeleton: '#1E2231',
  chartGrid: '#222738',
  tabBar: '#121521',
  shadow: '#000000',
};

/** Brand gradient used on the splash screen, hero cards and primary actions. */
export const brandGradient = ['#6366F1', '#7C3AED'] as const;
export const brandSplashBackground = '#4F46E5';

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

export const radius = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  pill: 999,
} as const;

/** Content never grows wider than this on tablets and desktop web. */
export const maxContentWidth = 760;

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export type FontWeight = keyof typeof fonts;

export const typography = {
  display: { fontSize: 34, lineHeight: 40, letterSpacing: -0.8 },
  title: { fontSize: 26, lineHeight: 32, letterSpacing: -0.5 },
  heading: { fontSize: 20, lineHeight: 26, letterSpacing: -0.3 },
  subheading: { fontSize: 17, lineHeight: 22, letterSpacing: -0.2 },
  body: { fontSize: 15, lineHeight: 21 },
  callout: { fontSize: 14, lineHeight: 20 },
  caption: { fontSize: 13, lineHeight: 18 },
  label: { fontSize: 12, lineHeight: 16 },
  micro: { fontSize: 11, lineHeight: 14, letterSpacing: 0.2 },
} as const satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;

export const defaultWeights: Record<TypographyVariant, FontWeight> = {
  display: 'bold',
  title: 'bold',
  heading: 'semibold',
  subheading: 'semibold',
  body: 'regular',
  callout: 'regular',
  caption: 'regular',
  label: 'medium',
  micro: 'medium',
};

export function elevation(level: 1 | 2 | 3, shadowColor: string, isDark: boolean): ViewStyle {
  if (isDark) return {};
  const config = {
    1: { opacity: 0.05, radius: 8, offset: 2 },
    2: { opacity: 0.08, radius: 16, offset: 6 },
    3: { opacity: 0.14, radius: 24, offset: 10 },
  }[level];
  if (Platform.OS === 'web') {
    return {
      boxShadow: `0 ${config.offset}px ${config.radius}px rgba(15, 23, 42, ${config.opacity})`,
    };
  }
  return {
    shadowColor,
    shadowOpacity: config.opacity,
    shadowRadius: config.radius,
    shadowOffset: { width: 0, height: config.offset },
    elevation: level * 2,
  };
}

/** Appends an alpha channel to a #RRGGBB color. */
export function withAlpha(hex: string, alpha: number): string {
  const value = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex.slice(0, 7)}${value}`;
}

/** Colors offered when creating types, sources and accounts. */
export const PICKER_COLORS = [
  '#6366F1',
  '#8B5CF6',
  '#A855F7',
  '#EC4899',
  '#F43F5E',
  '#EF4444',
  '#F97316',
  '#F59E0B',
  '#EAB308',
  '#84CC16',
  '#22C55E',
  '#10B981',
  '#14B8A6',
  '#06B6D4',
  '#0EA5E9',
  '#3B82F6',
  '#64748B',
  '#78716C',
] as const;
