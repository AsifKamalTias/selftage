import { reloadAppAsync } from 'expo';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { LogoMark } from '@/components/brand/logo-mark';
import { brandSplashBackground, fonts } from '@/theme/tokens';
import { logger } from '@/lib/logger';

const log = logger('app');

/** The first frames are the ones that point at the broken component. */
function shortStack(stack: string | null | undefined): string | undefined {
  if (!stack) return undefined;
  return stack.split('\n').slice(0, 8).join('\n');
}

interface State {
  error: Error | null;
}

interface Props {
  children: ReactNode;
  /** Called once the fallback is shown, e.g. to dismiss the splash overlay. */
  onError?: (error: Error) => void;
}

/**
 * Last-resort boundary for failures before the themed app exists (e.g. the
 * database cannot be opened or migrated). Route-level errors are handled by
 * expo-router's ErrorBoundary export instead.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    log.error('Fatal app error', error, {
      componentStack: shortStack(info.componentStack),
    });
    this.props.onError?.(error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={styles.container}>
        <LogoMark size={72} />
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.message}>
          Selftage could not start. Your data has not been changed.{'\n'}
          {this.state.error.message}
        </Text>
        <Text
          style={styles.button}
          accessibilityRole="button"
          onPress={() => {
            reloadAppAsync('Retry after fatal error').catch((error: unknown) => {
              log.warn('Could not reload the app; clearing the boundary instead', error);
              this.setState({ error: null });
            });
          }}>
          Try again
        </Text>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
    backgroundColor: brandSplashBackground,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontFamily: fonts.bold,
  },
  message: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    fontFamily: fonts.regular,
  },
  button: {
    marginTop: 8,
    color: brandSplashBackground,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
    overflow: 'hidden',
    fontSize: 15,
    fontFamily: fonts.semibold,
  },
});
