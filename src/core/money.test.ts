import {
  canConvert,
  convert,
  currencyDecimals,
  formatAmountInput,
  formatMoney,
  parseAmount,
  sumMinor,
  toMajor,
  toMinor,
  type Rates,
} from './money';

const USD_RATES: Rates = { base: 'USD', date: '2026-11-13', rates: { EUR: 0.86, JPY: 153.45 } };

describe('money', () => {
  it('knows each currency’s minor units', () => {
    expect(currencyDecimals('USD')).toBe(2);
    expect(currencyDecimals('EUR')).toBe(2);
    expect(currencyDecimals('JPY')).toBe(0);
    expect(currencyDecimals('krw')).toBe(0);
    expect(currencyDecimals('KWD')).toBe(3);
  });

  it('converts between major and minor units', () => {
    expect(toMinor(12.5, 'USD')).toBe(1250);
    expect(toMinor(1.005, 'USD')).toBe(101);
    expect(toMinor(8400, 'JPY')).toBe(8400);
    expect(toMinor(8400.5, 'JPY')).toBe(8401);
    expect(toMinor(-0.005, 'USD')).toBe(-1);
    expect(toMajor(1250, 'USD')).toBe(12.5);
    expect(toMajor(8400, 'JPY')).toBe(8400);
  });

  it('parses typed amounts', () => {
    expect(parseAmount('12.50', 'USD')).toBe(1250);
    expect(parseAmount(' 2,500 ', 'USD')).toBe(250000);
    expect(parseAmount('.5', 'EUR')).toBe(50);
    expect(parseAmount('7.', 'EUR')).toBe(700);
    expect(parseAmount('8400', 'JPY')).toBe(8400);
    expect(parseAmount('8,400', 'JPY')).toBe(8400);
    // Yen has no decimals; dollars have two.
    expect(parseAmount('1.5', 'JPY')).toBeNull();
    expect(parseAmount('1.234', 'USD')).toBeNull();
    for (const bad of ['', 'abc', '-5', '0', '0.00', '1.2.3', '$5']) {
      expect(parseAmount(bad, 'USD')).toBeNull();
    }
  });

  it('converts through the rates and rounds to the target’s minor units', () => {
    expect(convert({ amountMinor: 10000, currency: 'USD' }, 'EUR', USD_RATES)).toEqual({
      amountMinor: 8600,
      currency: 'EUR',
    });
    // EUR → JPY goes through the base: 130 / 0.86 * 153.45 = 23195.93 → whole yen.
    expect(convert({ amountMinor: 13000, currency: 'EUR' }, 'JPY', USD_RATES)).toEqual({
      amountMinor: 23196,
      currency: 'JPY',
    });
    // ¥8,400 in dollars: 8400 / 153.45 = 54.740… → $54.74.
    expect(convert({ amountMinor: 8400, currency: 'JPY' }, 'USD', USD_RATES)).toEqual({
      amountMinor: 5474,
      currency: 'USD',
    });
  });

  it('never changes the original and needs no rates for the same currency', () => {
    const original = { amountMinor: 999, currency: 'USD' };
    expect(convert(original, 'USD', null)).toEqual(original);
    convert(original, 'EUR', USD_RATES);
    expect(original).toEqual({ amountMinor: 999, currency: 'USD' });
  });

  it('returns null when the rates miss a currency', () => {
    expect(convert({ amountMinor: 100, currency: 'XYZ' }, 'USD', USD_RATES)).toBeNull();
    expect(convert({ amountMinor: 100, currency: 'USD' }, 'GBP', USD_RATES)).toBeNull();
    expect(convert({ amountMinor: 100, currency: 'USD' }, 'EUR', undefined)).toBeNull();
    expect(canConvert('USD', 'EUR', USD_RATES)).toBe(true);
    expect(canConvert('USD', 'GBP', USD_RATES)).toBe(false);
    expect(canConvert('GBP', 'GBP', null)).toBe(true);
  });

  it('sums amounts in one currency only', () => {
    expect(
      sumMinor(
        [
          { amountMinor: 1, currency: 'USD' },
          { amountMinor: 2, currency: 'USD' },
        ],
        'USD',
      ),
    ).toEqual({ amountMinor: 3, currency: 'USD' });
    expect(() => sumMinor([{ amountMinor: 1, currency: 'EUR' }], 'USD')).toThrow();
  });

  it('formats for display', () => {
    expect(formatMoney({ amountMinor: 123450, currency: 'USD' })).toBe('$1,234.50');
    expect(formatMoney({ amountMinor: 13000, currency: 'EUR' })).toBe('€130.00');
    expect(formatMoney({ amountMinor: 8400, currency: 'JPY' })).toBe('¥8,400');
    expect(formatMoney({ amountMinor: 250000, currency: 'USD' }, { whole: true })).toBe('$2,500');
    expect(formatMoney({ amountMinor: 48650, currency: 'USD' }, { whole: true })).toBe('$487');
    expect(formatMoney({ amountMinor: 500, currency: 'CAD' })).toBe('CA$5.00');
    expect(formatMoney({ amountMinor: 100, currency: 'ZZZ' })).toMatch(/1\.00/);
  });

  it('formats amounts for an input field', () => {
    expect(formatAmountInput({ amountMinor: 250000, currency: 'USD' })).toBe('2500.00');
    expect(formatAmountInput({ amountMinor: 8400, currency: 'JPY' })).toBe('8400');
  });
});
