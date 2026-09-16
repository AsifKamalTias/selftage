import { router, Stack } from 'expo-router';

import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';

export default function NotFoundScreen() {
  return (
    <Screen scroll={false} contentStyle={{ justifyContent: 'center' }}>
      <Stack.Screen options={{ title: 'Not found' }} />
      <EmptyState
        icon="compass-outline"
        title="This page doesn't exist"
        message="The link may be outdated."
        action={{
          label: 'Go to dashboard',
          icon: 'home-outline',
          onPress: () => router.replace('/'),
        }}
      />
    </Screen>
  );
}
