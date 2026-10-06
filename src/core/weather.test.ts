import {
  convertTemperature,
  formatTemperature,
  temperatureUnitForLocale,
  weatherLabel,
  weatherSymbol,
} from './weather';

describe('WMO code → SF Symbol', () => {
  it.each([
    [0, 'sun.max'],
    [1, 'sun.max'],
    [2, 'cloud.sun'],
    [3, 'cloud'],
    [45, 'cloud.fog'],
    [48, 'cloud.fog'],
    [51, 'cloud.drizzle'],
    [55, 'cloud.drizzle'],
    [56, 'cloud.sleet'],
    [61, 'cloud.rain'],
    [63, 'cloud.rain'],
    [65, 'cloud.heavyrain'],
    [67, 'cloud.sleet'],
    [71, 'cloud.snow'],
    [77, 'cloud.snow'],
    [80, 'cloud.sun.rain'],
    [81, 'cloud.rain'],
    [82, 'cloud.heavyrain'],
    [86, 'cloud.snow'],
    [95, 'cloud.bolt'],
    [96, 'cloud.bolt.rain'],
    [99, 'cloud.bolt.rain'],
  ])('code %i → %s', (code, symbol) => {
    expect(weatherSymbol(code)).toBe(symbol);
  });

  it('falls back to a plain cloud for codes outside the table', () => {
    expect(weatherSymbol(42)).toBe('cloud');
    expect(weatherLabel(-1)).toBe('Cloudy');
  });

  it('names conditions the way a traveller would', () => {
    expect(weatherLabel(0)).toBe('Clear');
    expect(weatherLabel(2)).toBe('Partly cloudy');
    expect(weatherLabel(95)).toBe('Thunderstorm');
  });
});

describe('temperatures', () => {
  it('converts °C to °F and rounds to whole degrees', () => {
    expect(convertTemperature(0, 'fahrenheit')).toBe(32);
    expect(convertTemperature(100, 'fahrenheit')).toBe(212);
    expect(convertTemperature(-40, 'fahrenheit')).toBe(-40);
    expect(convertTemperature(23.9, 'fahrenheit')).toBe(75);
    expect(convertTemperature(12.8, 'fahrenheit')).toBe(55);
  });

  it('keeps °C as °C, rounded', () => {
    expect(convertTemperature(23.9, 'celsius')).toBe(24);
    expect(convertTemperature(12.4, 'celsius')).toBe(12);
  });

  it('never shows minus zero', () => {
    expect(formatTemperature(-0.4, 'celsius')).toBe('0°');
    expect(formatTemperature(-17.9, 'fahrenheit')).toBe('0°');
  });

  it('formats with a degree sign and no unit letter', () => {
    expect(formatTemperature(23.9, 'fahrenheit')).toBe('75°');
    expect(formatTemperature(23.9, 'celsius')).toBe('24°');
  });

  it('picks °F for Fahrenheit regions and °C elsewhere', () => {
    expect(temperatureUnitForLocale('en-US')).toBe('fahrenheit');
    expect(temperatureUnitForLocale('es-US')).toBe('fahrenheit');
    expect(temperatureUnitForLocale('en_BS')).toBe('fahrenheit');
    expect(temperatureUnitForLocale('en-GB')).toBe('celsius');
    expect(temperatureUnitForLocale('fr-FR')).toBe('celsius');
    expect(temperatureUnitForLocale('zh-Hant-TW')).toBe('celsius');
    expect(temperatureUnitForLocale('en')).toBe('celsius');
  });
});
