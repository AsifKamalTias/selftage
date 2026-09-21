import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { Easing, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/theme-provider';
import { elevation, maxContentWidth, radius, spacing } from '@/theme/tokens';

import { IconButton } from './button';
import { Text } from './text';

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Fraction of the window height the sheet may occupy. */
  maxHeight?: number;
  /** Let the sheet take its full max height (for lists). */
  fill?: boolean;
}

export function BottomSheet({
  visible,
  onClose,
  title,
  children,
  footer,
  maxHeight = 0.85,
  fill = false,
}: BottomSheetProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.wrapper}
          pointerEvents="box-none">
          {visible ? (
            <Animated.View
              entering={SlideInDown.duration(240).easing(Easing.out(Easing.cubic))}
              accessibilityViewIsModal
              style={[
                styles.sheet,
                {
                  backgroundColor: colors.surface,
                  maxHeight: height * maxHeight,
                  height: fill ? height * maxHeight : undefined,
                  // The inset already clears the gesture bar; adding a margin on top of
                  // it leaves a dead strip that reads as the sheet floating.
                  paddingBottom: footer ? 0 : Math.max(insets.bottom, spacing.lg),
                },
                elevation(3, colors.shadow, isDark),
              ]}>
              <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />
              {title ? (
                <View style={styles.header}>
                  <Text variant="heading" style={styles.title} accessibilityRole="header">
                    {title}
                  </Text>
                  <IconButton icon="close" size={34} onPress={onClose} accessibilityLabel="Close" />
                </View>
              ) : null}
              <View style={[styles.body, fill && styles.fill]}>{children}</View>
              {footer ? (
                <View
                  style={[
                    styles.footer,
                    {
                      borderTopColor: colors.border,
                      paddingBottom: Math.max(insets.bottom, spacing.md),
                    },
                  ]}>
                  {footer}
                </View>
              ) : null}
            </Animated.View>
          ) : null}
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  sheet: {
    width: '100%',
    maxWidth: maxContentWidth,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingTop: spacing.sm,
    overflow: 'hidden',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  title: {
    flex: 1,
  },
  body: {
    flexShrink: 1,
  },
  fill: {
    flex: 1,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
});
