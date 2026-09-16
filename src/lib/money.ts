import { type Currency } from '@/features/settings/currencies';

/**
 * All amounts are persisted as integers in hundredths of the currency unit
 * (1234 = 12.34), independent of the selected currency. This avoids floating
 * point drift and keeps stored data valid when the display currency changes.
 */
export const AMOUNT_SCALE = 100;

export function toMinor(value: number): number {
  return Math.round(value * AMOUNT_SCALE);
}

export function fromMinor(minor: number): number {
  return minor / AMOUNT_SCALE;
}

/** Keeps only characters valid for a positive amount while the user is typing. */
export function sanitizeAmountInput(input: string): string {
  const cleaned = input.replace(/[^\d.]/g, '');
  const dot = cleaned.indexOf('.');
  if (dot === -1) return cleaned.replace(/^0+(?=\d)/, '');
  const whole = cleaned.slice(0, dot).replace(/^0+(?=\d)/, '');
  const fraction = cleaned
    .slice(dot + 1)
    .replace(/\./g, '')
    .slice(0, 2);
  return `${whole || '0'}.${fraction}`;
}

/** Parses user input such as "1,234.5" into minor units. Returns null when invalid. */
export function parseAmountInput(input: string): number | null {
  const normalized = input.replace(/[\s,]/g, '');
  if (!/^(\d+(\.\d{0,2})?|\.\d{1,2})$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? toMinor(value) : null;
}

/** Formats minor units for an editable text input (no grouping, trailing zeros trimmed). */
export function minorToInput(minor: number): string {
  const value = fromMinor(Math.abs(minor));
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0$/, '');
}

function groupDigits(digits: string, style: Currency['grouping']): string {
  if (style === 'indian' && digits.length > 3) {
    const last3 = digits.slice(-3);
    const rest = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    return `${rest},${last3}`;
  }
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export interface FormatMoneyOptions {
  /** `always` prefixes positive values with "+", `never` drops the minus sign. */
  sign?: 'auto' | 'always' | 'never';
  /** Hide the currency symbol. */
  plain?: boolean;
  /** Abbreviate large values (1.2K, 3.4M). */
  compact?: boolean;
}

function signPrefix(minor: number, sign: FormatMoneyOptions['sign']): string {
  if (sign === 'never' || minor === 0) return '';
  if (minor < 0) return '-';
  return sign === 'always' ? '+' : '';
}

const COMPACT_UNITS = [
  { value: 1e12, suffix: 'T' },
  { value: 1e9, suffix: 'B' },
  { value: 1e6, suffix: 'M' },
  { value: 1e3, suffix: 'K' },
] as const;

export function formatMoney(
  minor: number,
  currency: Currency,
  { sign = 'auto', plain = false, compact = false }: FormatMoneyOptions = {}
): string {
  const value = Math.abs(fromMinor(minor));
  const symbol = plain ? '' : currency.symbol;
  const prefix = signPrefix(minor, sign);

  if (compact) {
    const unit = COMPACT_UNITS.find((u) => value >= u.value);
    if (unit) {
      const scaled = value / unit.value;
      const text = scaled >= 100 ? scaled.toFixed(0) : scaled.toFixed(1).replace(/\.0$/, '');
      return `${prefix}${symbol}${text}${unit.suffix}`;
    }
  }

  const decimals = compact ? 0 : currency.decimals;
  const [whole, fraction] = value.toFixed(decimals).split('.');
  const grouped = groupDigits(whole, currency.grouping);
  return `${prefix}${symbol}${fraction ? `${grouped}.${fraction}` : grouped}`;
}

/** Percentage change helper that tolerates a zero baseline. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}
