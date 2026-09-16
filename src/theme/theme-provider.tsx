import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { createContext, use, useEffect, type ReactNode } from 'react';
import { Appearance, Platform, useColorScheme } from 'react-native';

import type { ThemeMode } from '@/features/settings/settings';

import { darkColors, fonts, lightColors, type ThemeColors } from './tokens';

export interface Theme {
  scheme: 'light' | 'dark';
  isDark: boolean;
  colors: ThemeColors;
}

const ThemeContext = createContext<Theme | null>(null);

function navigationTheme(isDark: boolean, colors: ThemeColors) {
  const base = isDark ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      notification: colors.expense,
    },
    fonts: {
      regular: { fontFamily: fonts.regular, fontWeight: '400' as const },
      medium: { fontFamily: fonts.medium, fontWeight: '500' as const },
      bold: { fontFamily: fonts.semibold, fontWeight: '600' as const },
      heavy: { fontFamily: fonts.bold, fontWeight: '700' as const },
    },
  };
}

export function ThemeProvider({ mode, children }: { mode: ThemeMode; children: ReactNode }) {
  const systemScheme = useColorScheme();

  useEffect(() => {
    // Keeps native UI (date pickers, alerts, keyboards) in sync with the in-app choice.
    if (Platform.OS !== 'web' && typeof Appearance.setColorScheme === 'function') {
      Appearance.setColorScheme(mode === 'system' ? 'unspecified' : mode);
    }
  }, [mode]);

  const scheme = mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode;
  const isDark = scheme === 'dark';
  const colors = isDark ? darkColors : lightColors;
  const theme: Theme = { scheme, isDark, colors };

  return (
    <ThemeContext value={theme}>
      <NavigationThemeProvider value={navigationTheme(isDark, colors)}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        {children}
      </NavigationThemeProvider>
    </ThemeContext>
  );
}

export function useTheme(): Theme {
  const theme = use(ThemeContext);
  if (!theme) throw new Error('useTheme must be used inside <ThemeProvider>');
  return theme;
}
