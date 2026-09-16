import type { ReactNode } from 'react';
import { ScrollView, type AccessibilityRole } from 'react-native';

import { spacing } from '@/theme/tokens';

/**
 * Horizontal strip that bleeds past the screen's side padding, so items scroll
 * to the edge instead of being clipped. Assumes the parent uses `spacing.lg` padding.
 */
export function HorizontalScroll({
  children,
  gap = spacing.sm,
  accessibilityRole,
}: {
  children: ReactNode;
  gap?: number;
  accessibilityRole?: AccessibilityRole;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole={accessibilityRole}
      style={{ marginHorizontal: -spacing.lg, flexGrow: 0 }}
      contentContainerStyle={{ gap, paddingHorizontal: spacing.lg }}>
      {children}
    </ScrollView>
  );
}
