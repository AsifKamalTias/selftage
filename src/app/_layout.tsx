import { isRunningInExpoGo } from 'expo';
import { useFonts } from 'expo-font';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { Suspense, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AppErrorBoundary } from '@/components/app-error-boundary';
import { AppMenuProvider } from '@/components/navigation/app-menu';
import { AnimatedSplash } from '@/components/brand/animated-splash';
import { ToastProvider } from '@/components/ui/toast';
import { DATABASE_NAME, DomainError } from '@/db/client';
import { migrateDatabase } from '@/db/migrations';
import { ReminderRunner } from '@/features/notifications/reminder-runner';
import { RecurringRunner } from '@/features/recurring/recurring-runner';
import { SettingsProvider, useSettings } from '@/features/settings/settings-provider';
import { installGlobalErrorHandlers } from '@/lib/global-errors';
import { startLogPersistence } from '@/lib/log-persistence';
import { logger } from '@/lib/logger';
import { ThemeProvider, useTheme } from '@/theme/theme-provider';
import { fonts } from '@/theme/tokens';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  anchor: '(tabs)',
};

SplashScreen.preventAutoHideAsync();
// Expo Go cannot customise the native splash and warns if asked; dev and production
// builds get the fade that hands over to <AnimatedSplash />.
if (!isRunningInExpoGo()) {
  SplashScreen.setOptions({ duration: 250, fade: true });
}

const log = logger('app');

installGlobalErrorHandlers();
void startLogPersistence();

function createQueryClient() {
  return new QueryClient({
    // One place to notice every failed read or write; screens still show their own message.
    queryCache: new QueryCache({
      onError: (error, query) => {
        report('Query failed', error, describeKey(query.queryKey));
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        report('Mutation failed', error, describeKey(mutation.options.mutationKey));
      },
    }),
    defaultOptions: {
      // Data is local: never pause for connectivity, and refetch only when invalidated.
      queries: { networkMode: 'always', staleTime: Infinity, retry: false },
      mutations: { networkMode: 'always', retry: false },
    },
  });
}

/**
 * A DomainError is a rule the person ran into — a duplicate name, an amount over the
 * limit — and the screen already tells them. Recording those as errors would drown the
 * genuine faults, so they are kept as warnings.
 */
function report(message: string, error: unknown, key: string) {
  if (error instanceof DomainError) log.warn(message, error, { key, expected: true });
  else log.error(message, error, { key });
}

/** Keys hold ids, not record contents, so they are safe to log. */
function describeKey(key: readonly unknown[] | undefined): string {
  return key ? key.map((part) => String(part)).join('/') : 'unknown';
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const [queryClient] = useState(createQueryClient);
  const [appReady, setAppReady] = useState(false);
  const [splashVisible, setSplashVisible] = useState(true);
  const assetsReady = fontsLoaded || !!fontError;

  useEffect(() => {
    // Hand over from the native splash to the identical animated one.
    if (assetsReady) SplashScreen.hide();
  }, [assetsReady]);

  if (!assetsReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <AppErrorBoundary onError={() => setAppReady(true)}>
          <Suspense fallback={null}>
            <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDatabase} useSuspense>
              <SettingsProvider>
                <ThemedApp onReady={setAppReady} />
              </SettingsProvider>
            </SQLiteProvider>
          </Suspense>
        </AppErrorBoundary>
        {splashVisible ? (
          <AnimatedSplash ready={appReady} onFinish={() => setSplashVisible(false)} />
        ) : null}
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

function ThemedApp({ onReady }: { onReady: (ready: boolean) => void }) {
  const { settings } = useSettings();

  useEffect(() => {
    onReady(true);
  }, [onReady]);

  return (
    <ThemeProvider mode={settings.themeMode}>
      <ToastProvider>
        <AppMenuProvider>
          <RecurringRunner />
          <ReminderRunner />
          <RootStack />
        </AppMenuProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

function RootStack() {
  const { colors } = useTheme();
  const modal = Platform.OS === 'ios' ? 'modal' : 'card';

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTintColor: colors.text,
        headerTitleStyle: { fontFamily: fonts.semibold, fontSize: 17 },
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: colors.background },
        animation: Platform.OS === 'android' ? 'slide_from_right' : 'default',
      }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="transaction/new"
        options={{ presentation: modal, title: 'New transaction', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="transaction/[id]/edit"
        options={{ presentation: modal, title: 'Edit transaction', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name="transaction/[id]/index" options={{ title: 'Transaction' }} />
      <Stack.Screen name="calendar" options={{ title: 'Calendar' }} />
      <Stack.Screen name="outstanding/index" options={{ title: 'Outstanding' }} />
      <Stack.Screen name="outstanding/[id]" options={{ title: 'Record' }} />
      <Stack.Screen
        name="outstanding/form"
        options={{ presentation: modal, title: 'Outstanding' }}
      />
      <Stack.Screen name="contacts/index" options={{ title: 'Contacts' }} />
      <Stack.Screen name="contacts/[id]" options={{ title: 'Contact' }} />
      <Stack.Screen name="contacts/form" options={{ presentation: modal, title: 'Contact' }} />
      <Stack.Screen name="goals/index" options={{ title: 'Goals' }} />
      <Stack.Screen name="goals/[id]" options={{ title: 'Goal' }} />
      <Stack.Screen name="goals/form" options={{ presentation: modal, title: 'Goal' }} />
      <Stack.Screen name="recurring/index" options={{ title: 'Recurring' }} />
      <Stack.Screen name="recurring/form" options={{ presentation: modal, title: 'Recurring' }} />
      <Stack.Screen name="budgets/index" options={{ title: 'Budgets' }} />
      <Stack.Screen name="budgets/form" options={{ presentation: modal, title: 'Budget' }} />
      <Stack.Screen name="manage/types/index" options={{ title: 'Income & expense types' }} />
      <Stack.Screen name="manage/types/form" options={{ presentation: modal, title: 'Type' }} />
      <Stack.Screen name="manage/sources/index" options={{ title: 'Sources' }} />
      <Stack.Screen name="manage/sources/form" options={{ presentation: modal, title: 'Source' }} />
      <Stack.Screen name="manage/groups/index" options={{ title: 'Groups' }} />
      <Stack.Screen name="manage/groups/form" options={{ presentation: modal, title: 'Group' }} />
      <Stack.Screen name="manage/accounts/index" options={{ title: 'Accounts' }} />
      <Stack.Screen
        name="manage/accounts/form"
        options={{ presentation: modal, title: 'Account' }}
      />
      <Stack.Screen name="manage/account-types/index" options={{ title: 'Account types' }} />
      <Stack.Screen
        name="manage/account-types/form"
        options={{ presentation: modal, title: 'Account type' }}
      />
      <Stack.Screen name="reports/ledger" options={{ title: 'Ledger report' }} />
      <Stack.Screen name="reports/groups" options={{ title: 'Group report' }} />
      <Stack.Screen name="currency" options={{ title: 'Currency' }} />
      <Stack.Screen name="diagnostics" options={{ title: 'Diagnostics' }} />
    </Stack>
  );
}
