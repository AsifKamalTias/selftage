export interface Currency {
  code: string;
  name: string;
  symbol: string;
  decimals: number;
  /** Indian numbering groups digits as 12,34,567 instead of 1,234,567. */
  grouping?: 'standard' | 'indian';
}

export const CURRENCIES: readonly Currency[] = [
  { code: 'USD', name: 'US Dollar', symbol: '$', decimals: 2 },
  { code: 'EUR', name: 'Euro', symbol: '€', decimals: 2 },
  { code: 'GBP', name: 'British Pound', symbol: '£', decimals: 2 },
  { code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳', decimals: 2, grouping: 'indian' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', decimals: 2, grouping: 'indian' },
  { code: 'PKR', name: 'Pakistani Rupee', symbol: 'Rs ', decimals: 2 },
  { code: 'NPR', name: 'Nepalese Rupee', symbol: 'Rs ', decimals: 2, grouping: 'indian' },
  { code: 'LKR', name: 'Sri Lankan Rupee', symbol: 'Rs ', decimals: 2 },
  { code: 'AED', name: 'UAE Dirham', symbol: 'AED ', decimals: 2 },
  { code: 'SAR', name: 'Saudi Riyal', symbol: 'SAR ', decimals: 2 },
  { code: 'QAR', name: 'Qatari Riyal', symbol: 'QAR ', decimals: 2 },
  { code: 'KWD', name: 'Kuwaiti Dinar', symbol: 'KD ', decimals: 2 },
  { code: 'OMR', name: 'Omani Rial', symbol: 'OMR ', decimals: 2 },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM', decimals: 2 },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', decimals: 2 },
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp', decimals: 0 },
  { code: 'THB', name: 'Thai Baht', symbol: '฿', decimals: 2 },
  { code: 'PHP', name: 'Philippine Peso', symbol: '₱', decimals: 2 },
  { code: 'VND', name: 'Vietnamese Dong', symbol: '₫', decimals: 0 },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', decimals: 2 },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', decimals: 0 },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩', decimals: 0 },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', decimals: 2 },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', decimals: 2 },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$', decimals: 2 },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', decimals: 2 },
  { code: 'MXN', name: 'Mexican Peso', symbol: 'MX$', decimals: 2 },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', decimals: 2 },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF ', decimals: 2 },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr ', decimals: 2 },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr ', decimals: 2 },
  { code: 'DKK', name: 'Danish Krone', symbol: 'kr ', decimals: 2 },
  { code: 'PLN', name: 'Polish Zloty', symbol: 'zł ', decimals: 2 },
  { code: 'TRY', name: 'Turkish Lira', symbol: '₺', decimals: 2 },
  { code: 'RUB', name: 'Russian Ruble', symbol: '₽', decimals: 2 },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R ', decimals: 2 },
  { code: 'NGN', name: 'Nigerian Naira', symbol: '₦', decimals: 2 },
  { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh ', decimals: 2 },
  { code: 'EGP', name: 'Egyptian Pound', symbol: 'E£', decimals: 2 },
];

export const FALLBACK_CURRENCY_CODE = 'USD';

const byCode = new Map(CURRENCIES.map((c) => [c.code, c]));

export function getCurrency(code: string | null | undefined): Currency {
  return (code && byCode.get(code)) || byCode.get(FALLBACK_CURRENCY_CODE)!;
}

export function isSupportedCurrency(code: string | null | undefined): code is string {
  return !!code && byCode.has(code);
}
