import { fetchRates } from './rates';

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
