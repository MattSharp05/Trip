import { setNow } from '@/core/clock';
import { queryClient } from '@/services/data/hooks';

import { expenseRate, fetchRateOn, fetchRates } from './rates';

describe('fetchRates', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  it('asks Frankfurter for the latest rates against the base', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ amount: 1, base: 'USD', date: '2026-10-06', rates: { EUR: 0.887 } }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    await expect(fetchRates('USD')).resolves.toEqual({
      base: 'USD',
      date: '2026-10-06',
      rates: { EUR: 0.887 },
    });
    expect(fetchMock).toHaveBeenCalledWith('https://api.frankfurter.dev/v1/latest?base=USD');
  });

  it('throws on an HTTP error or a body without rates', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 404 }) as unknown as typeof fetch;
    await expect(fetchRates('XYZ')).rejects.toThrow('Frankfurter 404');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'not found' }),
    }) as unknown as typeof fetch;
    await expect(fetchRates('USD')).rejects.toThrow('no rates');
  });
});

describe('fetchRateOn', () => {
  const realFetch = global.fetch;
  beforeEach(() => {
    queryClient.clear();
    setNow(new Date('2026-10-19T12:00:00Z'));
  });
  afterEach(() => {
    global.fetch = realFetch;
    setNow(null);
  });

  const respond = (rates: Record<string, number>) => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ rates }) });
    global.fetch = fetchMock as unknown as typeof fetch;
    return fetchMock;
  };

  it("asks Frankfurter for the day's rate and caches it by (date, from, to)", async () => {
    const fetchMock = respond({ USD: 1.1298 });
    await expect(fetchRateOn('2026-10-01', 'EUR', 'USD')).resolves.toBe(1.1298);
    await expect(fetchRateOn('2026-10-01', 'EUR', 'USD')).resolves.toBe(1.1298);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.frankfurter.dev/v1/2026-10-01?base=EUR&symbols=USD',
    );
  });

  it('asks for today for a future date, and never for the same currency', async () => {
    const fetchMock = respond({ USD: 1.16 });
    await fetchRateOn('2026-11-13', 'EUR', 'USD');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.frankfurter.dev/v1/2026-10-19?base=EUR&symbols=USD',
    );
    await expect(fetchRateOn('2026-11-13', 'USD', 'USD')).resolves.toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws without a rate', async () => {
    respond({});
    await expect(fetchRateOn('2026-10-02', 'EUR', 'USD')).rejects.toThrow('no rate');
  });
});

describe('expenseRate', () => {
  const realFetch = global.fetch;
  beforeEach(() => queryClient.clear());
  afterEach(() => {
    global.fetch = realFetch;
  });

  it('uses the fixed demo rates in a demo session, without the network', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    await expect(expenseRate('2026-11-13', 'EUR', 'USD', { demo: true })).resolves.toBe(1.16);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('is null when the rate cannot be loaded', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch;
    await expect(expenseRate('2026-10-01', 'EUR', 'USD', { demo: false })).resolves.toBeNull();
  });
});
