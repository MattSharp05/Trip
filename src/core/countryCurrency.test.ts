import { currencyForCountry } from './countryCurrency';

describe('currencyForCountry', () => {
  it('maps the sample trips’ countries', () => {
    expect(currencyForCountry('United States')).toBe('USD');
    expect(currencyForCountry('Japan')).toBe('JPY');
    expect(currencyForCountry('South Africa')).toBe('ZAR');
    expect(currencyForCountry('United Kingdom')).toBe('GBP');
  });

  it('maps euro countries, codes and any capitalisation', () => {
    expect(currencyForCountry('France')).toBe('EUR');
    expect(currencyForCountry('croatia')).toBe('EUR');
    expect(currencyForCountry(' Italy ')).toBe('EUR');
    expect(currencyForCountry('FR')).toBe('EUR');
    expect(currencyForCountry('jp')).toBe('JPY');
  });

  it('returns null when unknown or missing', () => {
    expect(currencyForCountry('Narnia')).toBeNull();
    expect(currencyForCountry('ZZ')).toBeNull();
    expect(currencyForCountry('')).toBeNull();
    expect(currencyForCountry(null)).toBeNull();
    expect(currencyForCountry(undefined)).toBeNull();
  });
});
