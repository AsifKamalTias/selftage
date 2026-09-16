import type { EntryKind } from '@/db/types';
import { useSettings } from '@/features/settings/settings-provider';

import { Text, type TextProps } from './text';

export interface AmountProps extends Omit<TextProps, 'children'> {
  /** Minor units. For transactions pass the positive amount together with `kind`. */
  value: number;
  kind?: EntryKind;
  /** Color the value green/red by kind (or by sign when no kind is given). */
  colorize?: boolean;
  /** Prefix income with "+" and expense with "-". */
  signed?: boolean;
  compact?: boolean;
}

export function Amount({
  value,
  kind,
  colorize = false,
  signed = false,
  compact = false,
  color,
  weight = 'semibold',
  ...rest
}: AmountProps) {
  const { formatAmount } = useSettings();
  const signedValue =
    kind === 'expense' ? -Math.abs(value) : kind === 'income' ? Math.abs(value) : value;
  const text = formatAmount(signedValue, {
    sign: signed ? 'always' : kind ? 'never' : 'auto',
    compact,
  });
  const tone =
    kind === 'income' || (!kind && signedValue > 0)
      ? 'income'
      : kind === 'expense' || (!kind && signedValue < 0)
        ? 'expense'
        : 'text';

  return (
    <Text
      tabular
      weight={weight}
      numberOfLines={1}
      color={color ?? (colorize ? tone : 'text')}
      {...rest}>
      {text}
    </Text>
  );
}
