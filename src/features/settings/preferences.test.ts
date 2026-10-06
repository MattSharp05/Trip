import { defaultPreferences, HOME_CURRENCIES, parsePreferences } from './preferences';

describe('defaultPreferences', () => {
  it('follows the phone region for units, with USD as home currency', () => {
    expect(defaultPreferences('en-US')).toEqual({
      temperatureUnit: 'fahrenheit',
      distanceUnit: 'miles',
      homeCurrency: 'USD',
    });
    expect(defaultPreferences('en-GB')).toEqual({
      temperatureUnit: 'celsius',
      distanceUnit: 'miles',
      homeCurrency: 'USD',
    });
    expect(defaultPreferences('fr-FR')).toMatchObject({
      temperatureUnit: 'celsius',
      distanceUnit: 'km',
    });
    expect(defaultPreferences('en')).toMatchObject({
      temperatureUnit: 'celsius',
      distanceUnit: 'km',
    });
  });
});

describe('parsePreferences', () => {
  const defaults = defaultPreferences('en-US');

  it('uses stored values', () => {
    expect(
      parsePreferences(
        { temperatureUnit: 'celsius', distanceUnit: 'km', homeCurrency: 'EUR' },
        defaults,
      ),
    ).toEqual({ temperatureUnit: 'celsius', distanceUnit: 'km', homeCurrency: 'EUR' });
  });

  it('falls back field by field for missing or invalid values', () => {
    expect(parsePreferences(undefined, defaults)).toEqual(defaults);
    expect(parsePreferences('celsius', defaults)).toEqual(defaults);
    expect(
      parsePreferences(
        { temperatureUnit: 'kelvin', homeCurrency: 'XYZ', distanceUnit: 'km' },
        defaults,
      ),
    ).toEqual({ ...defaults, distanceUnit: 'km' });
  });
});

it('lists each currency once, as an ISO code', () => {
  const codes = HOME_CURRENCIES.map((c) => c.code);
  expect(new Set(codes).size).toBe(codes.length);
  codes.forEach((code) => expect(code).toMatch(/^[A-Z]{3}$/));
  expect(codes[0]).toBe('USD');
});
