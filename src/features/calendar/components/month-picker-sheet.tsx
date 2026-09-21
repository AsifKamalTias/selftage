import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button, IconButton } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { MONTHS_SHORT, startOfMonth } from '@/lib/date';
import { useTheme } from '@/theme/theme-provider';
import { radius, spacing } from '@/theme/tokens';

/** Jumps straight to any month without stepping through the ones in between. */
export function MonthPickerSheet({
  visible,
  monthStart,
  onClose,
  onSelect,
}: {
  visible: boolean;
  monthStart: Date;
  onClose: () => void;
  onSelect: (month: Date) => void;
}) {
  const { colors } = useTheme();
  const [year, setYear] = useState(monthStart.getFullYear());
  const [wasVisible, setWasVisible] = useState(visible);

  // Open on the year being viewed, not wherever the sheet was left.
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setYear(monthStart.getFullYear());
  }

  const now = new Date();
  const pick = (month: number) => {
    onSelect(new Date(year, month, 1));
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Jump to month" maxHeight={0.7}>
      <View style={styles.content}>
        <View style={styles.years}>
          <IconButton
            icon="chevron-back"
            variant="plain"
            accessibilityLabel={`Go to ${year - 1}`}
            onPress={() => setYear(year - 1)}
          />
          <Text variant="subheading" weight="bold" tabular>
            {year}
          </Text>
          <IconButton
            icon="chevron-forward"
            variant="plain"
            accessibilityLabel={`Go to ${year + 1}`}
            onPress={() => setYear(year + 1)}
          />
        </View>

        <View style={styles.grid}>
          {MONTHS_SHORT.map((label, month) => {
            const selected = year === monthStart.getFullYear() && month === monthStart.getMonth();
            const isCurrent = year === now.getFullYear() && month === now.getMonth();
            return (
              <PressableScale
                key={label}
                scaleTo={0.95}
                onPress={() => pick(month)}
                style={styles.cell}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${label} ${year}`}>
                <View
                  style={[
                    styles.month,
                    { backgroundColor: selected ? colors.primary : colors.surfaceMuted },
                    !selected && isCurrent && { borderColor: colors.primary, borderWidth: 1.5 },
                  ]}>
                  <Text
                    variant="callout"
                    weight={selected || isCurrent ? 'bold' : 'medium'}
                    color={selected ? 'onPrimary' : 'text'}>
                    {label}
                  </Text>
                </View>
              </PressableScale>
            );
          })}
        </View>

        <Button
          title="This month"
          icon="today-outline"
          variant="outline"
          onPress={() => {
            onSelect(startOfMonth(new Date()));
            onClose();
          }}
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  years: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: '25%',
    padding: spacing.xs,
  },
  month: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
});
