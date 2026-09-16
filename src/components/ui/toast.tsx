import {
  createContext,
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptics } from '@/lib/haptics';
import { useTheme } from '@/theme/theme-provider';
import { elevation, maxContentWidth, radius, spacing } from '@/theme/tokens';

import { Icon, type IconName } from './icon';
import { Text } from './text';

type ToastType = 'success' | 'error' | 'info';

interface ToastMessage {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  show: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastType, IconName> = {
  success: 'checkmark-circle',
  error: 'alert-circle',
  info: 'information-circle',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const counter = useRef(0);

  const show = useCallback((message: string, type: ToastType = 'info') => {
    counter.current += 1;
    if (type === 'success') haptics.success();
    if (type === 'error') haptics.error();
    setToast({ id: counter.current, type, message });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), toast.type === 'error' ? 4000 : 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  const value: ToastContextValue = {
    show,
    success: (message) => show(message, 'success'),
    error: (message) => show(message, 'error'),
  };

  return (
    <ToastContext value={value}>
      {children}
      <ToastView toast={toast} />
    </ToastContext>
  );
}

function ToastView({ toast }: { toast: ToastMessage | null }) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const tint =
    toast?.type === 'success'
      ? colors.income
      : toast?.type === 'error'
        ? colors.danger
        : colors.primary;

  return (
    <View pointerEvents="none" style={[styles.host, { top: insets.top + spacing.sm }]}>
      {toast ? (
        <Animated.View
          key={toast.id}
          entering={FadeInUp.springify().damping(18)}
          exiting={FadeOutUp.duration(180)}
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          style={[
            styles.toast,
            { backgroundColor: colors.surface, borderColor: colors.border },
            elevation(3, colors.shadow, isDark),
          ]}>
          <Icon name={ICONS[toast.type]} size={22} color={tint} />
          <Text variant="callout" weight="medium" style={styles.message}>
            {toast.message}
          </Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

export function useToast(): ToastContextValue {
  const context = use(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>');
  return context;
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    alignItems: 'center',
    zIndex: 1000,
  },
  toast: {
    width: '100%',
    maxWidth: maxContentWidth - spacing.xxxl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  message: {
    flex: 1,
  },
});
