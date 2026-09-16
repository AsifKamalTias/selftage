import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { spacing } from '@/theme/tokens';

import { PressableScale } from './pressable-scale';
import { Text } from './text';

export interface SectionProps {
  title?: string;
  caption?: string;
  action?: { label: string; onPress: () => void };
  right?: ReactNode;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Section({ title, caption, action, right, children, style }: SectionProps) {
  return (
    <View style={[styles.section, style]}>
      {title || action || right ? (
        <View style={styles.header}>
          <View style={styles.titles}>
            {title ? (
              <Text variant="subheading" accessibilityRole="header">
                {title}
              </Text>
            ) : null}
            {caption ? (
              <Text variant="caption" color="textMuted">
                {caption}
              </Text>
            ) : null}
          </View>
          {right}
          {action ? (
            <PressableScale onPress={action.onPress} hitSlop={8} accessibilityRole="link">
              <Text variant="callout" weight="semibold" color="primary">
                {action.label}
              </Text>
            </PressableScale>
          ) : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  titles: {
    flex: 1,
    gap: 2,
  },
});
