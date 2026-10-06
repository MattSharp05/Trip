import { handle, toCoverPhoto } from './index';

const unsplash = {
  results: [
    {
      urls: { regular: 'https://images.unsplash.com/photo-1?w=1080' },
      links: {
        html: 'https://unsplash.com/photos/abc',
        download_location: 'https://api.unsplash.com/photos/abc/download?ixid=1',
      },
      user: { name: 'Ana Lisboa', links: { html: 'https://unsplash.com/@ana' } },
    },
  ],
};

const post = (body: unknown) =>
  new Request('https://fn/photos', { method: 'POST', body: JSON.stringify(body) });

describe('photos function', () => {
  it('maps the first Unsplash result with referral links on the credits', () => {
    expect(toCoverPhoto(unsplash)).toEqual({
      url: 'https://images.unsplash.com/photo-1?w=1080',
      photographer: 'Ana Lisboa',
      photographerUrl: 'https://unsplash.com/@ana?utm_source=trip_demo&utm_medium=referral',
      photoUrl: 'https://unsplash.com/photos/abc?utm_source=trip_demo&utm_medium=referral',
      downloadLocation: 'https://api.unsplash.com/photos/abc/download?ixid=1',
    });
    expect(toCoverPhoto({ results: [] })).toBeNull();
  });

  it('answers "no photo" without a key, and never calls Unsplash', async () => {
    const fetchImpl = jest.fn();
    const f = fetchImpl as unknown as typeof fetch;
    const res = await handle(post({ action: 'search', query: 'Lisbon' }), undefined, f);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ photo: null });
    const track = await handle(
      post({ action: 'track', downloadLocation: 'https://api.unsplash.com/photos/abc/download' }),
      undefined,
      f,
    );
    expect(await track.json()).toEqual({ tracked: false });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('searches with the key and tracks the chosen photo', async () => {
    const fetchImpl = jest.fn(async () => new Response(JSON.stringify(unsplash)));
    const f = fetchImpl as unknown as typeof fetch;
    const res = await handle(post({ action: 'search', query: 'Lisbon Portugal' }), 'KEY', f);
    expect((await res.json()).photo.photographer).toBe('Ana Lisboa');
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(new URL(url).searchParams.get('query')).toBe('Lisbon Portugal');
    expect(new URL(url).searchParams.get('orientation')).toBe('landscape');
    expect((init.headers as Record<string, string>).Authorization).toBe('Client-ID KEY');

    const location = 'https://api.unsplash.com/photos/abc/download?ixid=1';
    const track = await handle(post({ action: 'track', downloadLocation: location }), 'KEY', f);
    expect(await track.json()).toEqual({ tracked: true });
    expect((fetchImpl.mock.calls[1] as unknown as [string])[0]).toBe(location);
  });

  it('never sends the key anywhere but Unsplash', async () => {
    const fetchImpl = jest.fn();
    const res = await handle(
      post({ action: 'track', downloadLocation: 'https://evil.example/photos/abc' }),
      'KEY',
      fetchImpl as unknown as typeof fetch,
    );
    expect(res.status).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects unknown actions and short queries', async () => {
    expect((await handle(post({ action: 'delete' }), 'KEY')).status).toBe(400);
    expect((await handle(post({ action: 'search', query: 'x' }), 'KEY')).status).toBe(400);
  });
});
