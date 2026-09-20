import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { createContext, use, useEffect, useRef, useState, type ReactNode } from 'react';
import { Appearance, Platform, StyleSheet, useColorScheme, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

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
        <View style={styles.root}>
          {children}
          <ThemeTransition background={colors.background} />
        </View>
      </NavigationThemeProvider>
    </ThemeContext>
  );
}

/**
 * Cross-fades between palettes: when the background changes, the previous color is painted
 * over the app and faded out, so switching appearance dissolves instead of snapping.
 */
function ThemeTransition({ background }: { background: string }) {
  const reduceMotion = useReducedMotion();
  const previous = useRef(background);
  const [fadeFrom, setFadeFrom] = useState<string | null>(null);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (previous.current === background) return;
    const from = previous.current;
    previous.current = background;
    if (reduceMotion) return;

    setFadeFrom(from);
    opacity.set(1);
    opacity.set(
      withTiming(0, { duration: 420, easing: Easing.out(Easing.cubic) }, (finished) => {
        if (finished) scheduleOnRN(setFadeFrom, null);
      })
    );
  }, [background, opacity, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  if (!fadeFrom) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        styles.overlay,
        { backgroundColor: fadeFrom },
        animatedStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  overlay: {
    zIndex: 9998,
  },
});

export function useTheme(): Theme {
  const theme = use(ThemeContext);
  if (!theme) throw new Error('useTheme must be used inside <ThemeProvider>');
  return theme;
}
