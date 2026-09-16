import { Chip } from '@/components/ui/chip';
import { HorizontalScroll } from '@/components/ui/horizontal-scroll';
import { PERIOD_PRESETS, type PeriodPreset } from '@/lib/date';

export function PeriodSelector({
  value,
  onChange,
  exclude = [],
}: {
  value: PeriodPreset;
  onChange: (value: PeriodPreset) => void;
  exclude?: PeriodPreset[];
}) {
  return (
    <HorizontalScroll accessibilityRole="tablist">
      {PERIOD_PRESETS.filter((p) => !exclude.includes(p.value)).map((preset) => (
        <Chip
          key={preset.value}
          label={preset.label}
          selected={preset.value === value}
          onPress={() => onChange(preset.value)}
        />
      ))}
    </HorizontalScroll>
  );
}
