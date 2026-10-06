import { handle, toPlaces } from './index';

const photon = {
  features: [
    {
      geometry: { coordinates: [-9.1365919, 38.7077507] },
      properties: {
        osm_type: 'R',
        osm_id: 5400890,
        name: 'Lisbon',
        country: 'Portugal',
        countrycode: 'pt',
      },
    },
    {
      geometry: { coordinates: [-91.38, 41.92] },
      properties: {
        osm_type: 'R',
        osm_id: 129082,
        name: 'Lisbon',
        state: 'Iowa',
        country: 'United States',
        countrycode: 'US',
      },
    },
    // Same place twice, and one without coordinates: both dropped.
    {
      geometry: { coordinates: [-91.38, 41.92] },
      properties: {
        osm_type: 'N',
        osm_id: 1,
        name: 'Lisbon',
        state: 'Iowa',
        country: 'United States',
      },
    },
    { properties: { name: 'Nowhere' } },
  ],
};

const post = (body: unknown, method = 'POST') =>
  new Request('https://fn/places', {
    method,
    body: method === 'POST' ? JSON.stringify(body) : undefined,
  });

describe('places function', () => {
  it('maps Photon cities, dropping duplicates and unplaceable results', () => {
    expect(toPlaces(photon)).toEqual([
      {
        id: 'R5400890',
        name: 'Lisbon',
        region: null,
        country: 'Portugal',
        countryCode: 'PT',
        lat: 38.7077507,
        lng: -9.1365919,
      },
      {
        id: 'R129082',
        name: 'Lisbon',
        region: 'Iowa',
        country: 'United States',
        countryCode: 'US',
        lat: 41.92,
        lng: -91.38,
      },
    ]);
    expect(toPlaces(null)).toEqual([]);
  });

  it('asks Photon for English city names with a User-Agent', async () => {
    const fetchImpl = jest.fn(async () => new Response(JSON.stringify(photon)));
    const res = await handle(post({ query: ' Lisbon ' }), fetchImpl as unknown as typeof fetch);
    expect(res.status).toBe(200);
    expect((await res.json()).places).toHaveLength(2);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const params = new URL(url).searchParams;
    expect(params.get('q')).toBe('Lisbon');
    expect(params.get('layer')).toBe('city');
    expect(params.get('lang')).toBe('en');
    expect((init.headers as Record<string, string>)['User-Agent']).toMatch(/Trip/);
  });

  it('rejects bad requests and reports Photon failures', async () => {
    const fetchImpl = jest.fn(async () => new Response('down', { status: 503 }));
    const f = fetchImpl as unknown as typeof fetch;
    expect((await handle(post({ query: 'L' }), f)).status).toBe(400);
    expect((await handle(post(null, 'GET'), f)).status).toBe(405);
    expect((await handle(new Request('https://fn', { method: 'POST', body: 'x' }), f)).status).toBe(
      400,
    );
    expect(fetchImpl).not.toHaveBeenCalled();
    expect((await handle(post({ query: 'Lisbon' }), f)).status).toBe(502);
  });
});
