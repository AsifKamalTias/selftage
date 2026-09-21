import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { logger } from './logger';

const log = logger('haptics');

const enabled = Platform.OS === 'ios' || Platform.OS === 'android';

function run(effect: () => Promise<void>) {
  if (enabled) {
    effect().catch((error: unknown) => {
      // Cosmetic only: never surface this, but do not hide it either.
      log.debug('Haptic feedback failed', { reason: String(error) });
    });
  }
}

export const haptics = {
  selection: () => run(() => Haptics.selectionAsync()),
  light: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  medium: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  error: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
