/**
 * Weather maths, pure TS: WMO weather codes (as Open-Meteo returns them) to SF Symbols and words,
 * and temperatures in the traveller's unit. Temperatures are stored in °C everywhere.
 */

/** One day's forecast. */
export interface DailyWeather {
  /** `YYYY-MM-DD` in the trip's timezone. */
  day: string;
  /** WMO weather interpretation code (0–99). */
  code: number;
  highC: number;
  lowC: number;
}

/** Forecasts by day; a day with no entry has no forecast (beyond the range, or not loaded). */
export type DailyForecast = Record<string, DailyWeather>;

export type TemperatureUnit = 'celsius' | 'fahrenheit';

/** The SF Symbols weather can show (outlined variants, per docs/design.md). */
export type WeatherSymbol =
  | 'sun.max'
  | 'cloud.sun'
  | 'cloud'
  | 'cloud.fog'
  | 'cloud.drizzle'
  | 'cloud.rain'
  | 'cloud.heavyrain'
  | 'cloud.sleet'
  | 'cloud.snow'
  | 'cloud.sun.rain'
  | 'cloud.bolt'
  | 'cloud.bolt.rain';

interface Condition {
  symbol: WeatherSymbol;
  label: string;
}

const UNKNOWN: Condition = { symbol: 'cloud', label: 'Cloudy' };

// WMO code table 4677, as documented by Open-Meteo.
const CONDITIONS: Record<number, Condition> = {
  0: { symbol: 'sun.max', label: 'Clear' },
  1: { symbol: 'sun.max', label: 'Mostly clear' },
  2: { symbol: 'cloud.sun', label: 'Partly cloudy' },
  3: { symbol: 'cloud', label: 'Overcast' },
  45: { symbol: 'cloud.fog', label: 'Fog' },
  48: { symbol: 'cloud.fog', label: 'Freezing fog' },
  51: { symbol: 'cloud.drizzle', label: 'Light drizzle' },
  53: { symbol: 'cloud.drizzle', label: 'Drizzle' },
  55: { symbol: 'cloud.drizzle', label: 'Heavy drizzle' },
  56: { symbol: 'cloud.sleet', label: 'Freezing drizzle' },
  57: { symbol: 'cloud.sleet', label: 'Freezing drizzle' },
  61: { symbol: 'cloud.rain', label: 'Light rain' },
  63: { symbol: 'cloud.rain', label: 'Rain' },
  65: { symbol: 'cloud.heavyrain', label: 'Heavy rain' },
  66: { symbol: 'cloud.sleet', label: 'Freezing rain' },
  67: { symbol: 'cloud.sleet', label: 'Freezing rain' },
  71: { symbol: 'cloud.snow', label: 'Light snow' },
  73: { symbol: 'cloud.snow', label: 'Snow' },
  75: { symbol: 'cloud.snow', label: 'Heavy snow' },
  77: { symbol: 'cloud.snow', label: 'Snow grains' },
  80: { symbol: 'cloud.sun.rain', label: 'Showers' },
  81: { symbol: 'cloud.rain', label: 'Showers' },
  82: { symbol: 'cloud.heavyrain', label: 'Heavy showers' },
  85: { symbol: 'cloud.snow', label: 'Snow showers' },
  86: { symbol: 'cloud.snow', label: 'Snow showers' },
  95: { symbol: 'cloud.bolt', label: 'Thunderstorm' },
  96: { symbol: 'cloud.bolt.rain', label: 'Thunderstorm with hail' },
  99: { symbol: 'cloud.bolt.rain', label: 'Thunderstorm with hail' },
};

/** The SF Symbol for a WMO code; unknown codes fall back to a plain cloud. */
export const weatherSymbol = (code: number): WeatherSymbol => (CONDITIONS[code] ?? UNKNOWN).symbol;

/** A traveller's word for a WMO code ("Partly cloudy"), for VoiceOver. */
export const weatherLabel = (code: number): string => (CONDITIONS[code] ?? UNKNOWN).label;

/** °C in the given unit, rounded to a whole degree. */
export function convertTemperature(celsius: number, unit: TemperatureUnit): number {
  const value = unit === 'fahrenheit' ? (celsius * 9) / 5 + 32 : celsius;
  // `|| 0` turns -0 into 0, so a chilly -0.4 °C reads "0°".
  return Math.round(value) || 0;
}

/** "75°" */
export const formatTemperature = (celsius: number, unit: TemperatureUnit): string =>
  `${convertTemperature(celsius, unit)}°`;

// Countries that use Fahrenheit day to day.
const FAHRENHEIT_REGIONS = new Set(['US', 'LR', 'MM', 'BS', 'BZ', 'KY', 'PW', 'FM', 'MH']);

/**
 * The unit a locale (BCP 47, e.g. `en-US`) reads temperatures in. Until Settings has a units
 * preference, this is the preference.
 */
export function temperatureUnitForLocale(locale: string): TemperatureUnit {
  const region = locale
    .split(/[-_]/)
    .slice(1)
    .find((part) => /^[A-Za-z]{2}$/.test(part));
  return region && FAHRENHEIT_REGIONS.has(region.toUpperCase()) ? 'fahrenheit' : 'celsius';
}
