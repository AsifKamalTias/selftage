import { isRunningInExpoGo } from 'expo';
import { useFonts } from 'expo-font';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
import { DATABASE_NAME } from '@/db/client';
import { migrateDatabase } from '@/db/migrations';
import { RecurringRunner } from '@/features/recurring/recurring-runner';
import { SettingsProvider, useSettings } from '@/features/settings/settings-provider';
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

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      // Data is local: never pause for connectivity, and refetch only when invalidated.
      queries: { networkMode: 'always', staleTime: Infinity, retry: false },
      mutations: { networkMode: 'always', retry: false },
    },
  });
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
    </Stack>
  );
}
