import type { Rates } from '@/core/money';

/**
 * Fixed exchange rates for scenario demo sessions, so budget QA links show the same numbers every
 * time and never call Frankfurter. Euro-based, roughly ECB reference rates for autumn 2026.
 */
const EUR_RATES: Record<string, number> = {
  EUR: 1,
  USD: 1.16,
  GBP: 0.87,
  JPY: 178,
  CAD: 1.6,
  AUD: 1.77,
  NZD: 1.98,
  CHF: 0.93,
  MXN: 21.4,
  BRL: 6.3,
  CNY: 8.3,
  HKD: 9.05,
  SGD: 1.5,
  KRW: 1620,
  INR: 101,
  IDR: 19200,
  MYR: 4.9,
  PHP: 66,
  THB: 38,
  ZAR: 20.3,
  TRY: 48,
  ILS: 3.9,
  SEK: 11,
  NOK: 11.7,
  DKK: 7.46,
  ISK: 143,
  PLN: 4.25,
  CZK: 24.3,
  HUF: 390,
  RON: 5.08,
};

export const DEMO_RATES_DATE = '2026-11-13';

/** The demo rates against any base the table has (rebased from the euro). */
export function demoRates(base: string): Rates {
  const baseRate = EUR_RATES[base] ?? 1;
  const known = base in EUR_RATES;
  const rates: Record<string, number> = {};
  for (const [code, rate] of Object.entries(EUR_RATES)) {
    if (code !== (known ? base : 'EUR')) rates[code] = rate / baseRate;
  }
  return { base: known ? base : 'EUR', date: DEMO_RATES_DATE, rates };
}
