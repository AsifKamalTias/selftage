import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type RefreshControlProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/theme-provider';
import { maxContentWidth, spacing } from '@/theme/tokens';

export interface ScreenProps {
  children: ReactNode;
  /** Wrap content in a ScrollView (default) or render it in a flex container. */
  scroll?: boolean;
  /** Pad for the status bar; tab screens need this, stack screens with a header do not. */
  safeTop?: boolean;
  /** Pad for the home indicator; screens without a tab bar need this. */
  safeBottom?: boolean;
  /** Avoid the keyboard (forms). */
  keyboard?: boolean;
  padded?: boolean;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  contentStyle?: StyleProp<ViewStyle>;
  /** Pinned below the scroll area, e.g. a form's save button. */
  footer?: ReactNode;
}

export function Screen({
  children,
  scroll = true,
  safeTop = false,
  safeBottom = false,
  keyboard = false,
  padded = true,
  refreshControl,
  contentStyle,
  footer,
}: ScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const inner = [
    styles.content,
    padded && styles.padded,
    { paddingTop: (safeTop ? insets.top : 0) + (padded ? spacing.lg : 0) },
    { paddingBottom: (safeBottom && !footer ? insets.bottom : 0) + spacing.xxxl },
    contentStyle,
  ];

  const body = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={inner}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets={keyboard}
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl}>
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, inner]}>{children}</View>
  );

  const footerView = footer ? (
    <View
      style={[
        styles.footer,
        {
          paddingBottom: (safeBottom ? insets.bottom : 0) + spacing.md,
          backgroundColor: colors.background,
          borderTopColor: colors.border,
        },
      ]}>
      <View style={styles.footerInner}>{footer}</View>
    </View>
  ) : null;

  const layout = (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      {body}
      {footerView}
    </View>
  );

  if (keyboard && Platform.OS !== 'web') {
    return (
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 96 : 0}>
        {layout}
      </KeyboardAvoidingView>
    );
  }
  return layout;
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
    gap: spacing.xl,
  },
  padded: {
    paddingHorizontal: spacing.lg,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  footerInner: {
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
  },
});
