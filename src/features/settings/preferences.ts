import type { DistanceUnit } from '@/core/travel';
import { temperatureUnitForLocale, type TemperatureUnit } from '@/core/weather';

export type { DistanceUnit };

/**
 * The traveller's display preferences (TR-11). A real account keeps them in its Supabase auth
 * `user_metadata.preferences`; a scenario demo session keeps them in memory.
 */
export interface Preferences {
  temperatureUnit: TemperatureUnit;
  distanceUnit: DistanceUnit;
  /** ISO 4217 code budgets convert to. */
  homeCurrency: string;
}

/** Currencies Frankfurter (the TDD's rate source, ECB data) can convert, with a traveller's name. */
export const HOME_CURRENCIES: readonly { code: string; name: string }[] = [
  { code: 'USD', name: 'US dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British pound' },
  { code: 'CAD', name: 'Canadian dollar' },
  { code: 'AUD', name: 'Australian dollar' },
  { code: 'NZD', name: 'New Zealand dollar' },
  { code: 'JPY', name: 'Japanese yen' },
  { code: 'CHF', name: 'Swiss franc' },
  { code: 'MXN', name: 'Mexican peso' },
  { code: 'BRL', name: 'Brazilian real' },
  { code: 'CNY', name: 'Chinese yuan' },
  { code: 'HKD', name: 'Hong Kong dollar' },
  { code: 'SGD', name: 'Singapore dollar' },
  { code: 'KRW', name: 'South Korean won' },
  { code: 'INR', name: 'Indian rupee' },
  { code: 'IDR', name: 'Indonesian rupiah' },
  { code: 'MYR', name: 'Malaysian ringgit' },
  { code: 'PHP', name: 'Philippine peso' },
  { code: 'THB', name: 'Thai baht' },
  { code: 'ZAR', name: 'South African rand' },
  { code: 'TRY', name: 'Turkish lira' },
  { code: 'ILS', name: 'Israeli new shekel' },
  { code: 'SEK', name: 'Swedish krona' },
  { code: 'NOK', name: 'Norwegian krone' },
  { code: 'DKK', name: 'Danish krone' },
  { code: 'ISK', name: 'Icelandic krona' },
  { code: 'PLN', name: 'Polish zloty' },
  { code: 'CZK', name: 'Czech koruna' },
  { code: 'HUF', name: 'Hungarian forint' },
  { code: 'RON', name: 'Romanian leu' },
  { code: 'BGN', name: 'Bulgarian lev' },
];

const CURRENCY_CODES = new Set(HOME_CURRENCIES.map((c) => c.code));

// Countries that measure road distances in miles.
const MILES_REGIONS = new Set(['US', 'GB', 'LR', 'MM']);

function region(locale: string): string | undefined {
  return locale
    .split(/[-_]/)
    .slice(1)
    .find((part) => /^[A-Za-z]{2}$/.test(part))
    ?.toUpperCase();
}

/** What a new account starts with: units from the phone's region, home currency USD. */
export function defaultPreferences(locale: string): Preferences {
  const r = region(locale);
  return {
    temperatureUnit: temperatureUnitForLocale(locale),
    distanceUnit: r && MILES_REGIONS.has(r) ? 'miles' : 'km',
    homeCurrency: 'USD',
  };
}

/** The phone's locale, e.g. `en-US`. */
export function deviceLocale(): string {
  return Intl.DateTimeFormat().resolvedOptions().locale;
}

/**
 * Stored preferences (`user_metadata.preferences`) over the defaults. Anything missing or invalid
 * (an older app version, a hand-edited value) falls back to the default for that field.
 */
export function parsePreferences(stored: unknown, defaults: Preferences): Preferences {
  if (!stored || typeof stored !== 'object') return defaults;
  const s = stored as Record<string, unknown>;
  return {
    temperatureUnit:
      s.temperatureUnit === 'celsius' || s.temperatureUnit === 'fahrenheit'
        ? s.temperatureUnit
        : defaults.temperatureUnit,
    distanceUnit:
      s.distanceUnit === 'miles' || s.distanceUnit === 'km'
        ? s.distanceUnit
        : defaults.distanceUnit,
    homeCurrency:
      typeof s.homeCurrency === 'string' && CURRENCY_CODES.has(s.homeCurrency)
        ? s.homeCurrency
        : defaults.homeCurrency,
  };
}
