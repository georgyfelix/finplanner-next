const REGION_TO_CURRENCY: Record<string, string> = {
  US: 'USD',
  IN: 'INR',
  GB: 'GBP',
  EU: 'EUR',
  DE: 'EUR',
  FR: 'EUR',
  ES: 'EUR',
  IT: 'EUR',
  NL: 'EUR',
  IE: 'EUR',
  PT: 'EUR',
  CA: 'CAD',
  AU: 'AUD',
  NZ: 'NZD',
  JP: 'JPY',
  CN: 'CNY',
  SG: 'SGD',
  MY: 'MYR',
  AE: 'AED',
  SA: 'SAR',
};

export function parsePrimaryLocale(acceptLanguage: string | null | undefined): string {
  if (!acceptLanguage) return 'en-US';
  const first = acceptLanguage.split(',')[0]?.trim();
  return first || 'en-US';
}

export function inferCurrencyFromLocale(locale: string): string {
  const parts = locale.replace('_', '-').split('-');
  const region = parts[1]?.toUpperCase();
  if (!region) return 'USD';
  return REGION_TO_CURRENCY[region] ?? 'USD';
}

export function inferSettingsFromAcceptLanguage(acceptLanguage: string | null | undefined) {
  const locale = parsePrimaryLocale(acceptLanguage);
  return {
    locale,
    currency: inferCurrencyFromLocale(locale),
  };
}

export function formatMoney(amount: number, currency: string, locale = 'en-US') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}
