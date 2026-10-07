import { handle, spotKind, toPlaces, toSpots } from './index';

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

  it('searches spots near the trip, without the city layer', async () => {
    const eggslut = {
      features: [
        {
          geometry: { coordinates: [-115.1745, 36.1092] },
          properties: {
            osm_type: 'N',
            osm_id: 42,
            name: 'Eggslut',
            osm_key: 'amenity',
            osm_value: 'fast_food',
            housenumber: '3708',
            street: 'Las Vegas Boulevard South',
            district: 'Paradise',
            city: 'Las Vegas',
          },
        },
        // A road named like the query is not somewhere to go.
        {
          geometry: { coordinates: [-115.1, 36.1] },
          properties: { osm_type: 'W', osm_id: 7, name: 'Eggslut Way', osm_key: 'highway' },
        },
      ],
    };
    const fetchImpl = jest.fn(async () => new Response(JSON.stringify(eggslut)));
    const res = await handle(
      post({ query: 'Eggslut', near: { lat: 36.17, lng: -115.14 } }),
      fetchImpl as unknown as typeof fetch,
    );
    expect(await res.json()).toEqual({
      spots: [
        {
          id: 'N42',
          name: 'Eggslut',
          kind: 'food',
          area: 'Paradise',
          address: '3708 Las Vegas Boulevard South, Las Vegas',
          lat: 36.1092,
          lng: -115.1745,
        },
      ],
    });
    const params = new URL((fetchImpl.mock.calls[0] as unknown as [string])[0]).searchParams;
    expect(params.get('layer')).toBeNull();
    expect(params.get('lat')).toBe('36.17');
    expect(params.get('lon')).toBe('-115.14');
    expect(params.get('bbox')).toBe('-115.64,35.67,-114.64,36.67');
  });

  it('maps OpenStreetMap tags to place kinds', () => {
    expect(spotKind('amenity', 'bar')).toBe('bar');
    expect(spotKind('amenity', 'nightclub')).toBe('nightlife');
    expect(spotKind('tourism', 'museum')).toBe('attraction');
    expect(spotKind('historic', 'monument')).toBe('landmark');
    expect(spotKind('shop', 'clothes')).toBeNull();
    expect(spotKind(undefined, undefined)).toBeNull();
    expect(toSpots(null)).toEqual([]);
  });

  it('rejects a bad near', async () => {
    const fetchImpl = jest.fn();
    const res = await handle(
      post({ query: 'Eggslut', near: { lat: 'x' } }),
      fetchImpl as unknown as typeof fetch,
    );
    expect(res.status).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
