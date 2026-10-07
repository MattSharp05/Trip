import { fetchCityLinks } from './cityLinks';

const mockRpc = jest.fn();
jest.mock('./supabase', () => ({ supabase: { rpc: (...args: unknown[]) => mockRpc(...args) } }));

describe('fetchCityLinks', () => {
  beforeEach(() => mockRpc.mockReset());

  it('asks city_links for the trip’s city and maps its four columns', async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          url: 'https://www.tiktok.com/@a/video/1',
          title: 'Tacos',
          thumbnail_url: 'https://p.example/t.jpg',
          place_count: 2,
        },
        {
          url: 'https://www.instagram.com/reel/X/',
          title: null,
          thumbnail_url: null,
          place_count: 1,
        },
      ],
      error: null,
    });
    expect(await fetchCityLinks('Las Vegas')).toEqual([
      {
        url: 'https://www.tiktok.com/@a/video/1',
        title: 'Tacos',
        thumbnailUrl: 'https://p.example/t.jpg',
        placeCount: 2,
        viewCount: null,
      },
      {
        url: 'https://www.instagram.com/reel/X/',
        title: null,
        thumbnailUrl: null,
        placeCount: 1,
        viewCount: null,
      },
    ]);
    expect(mockRpc).toHaveBeenCalledWith('city_links', { p_city: 'Las Vegas' });
  });

  it('throws on an error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'nope' } });
    await expect(fetchCityLinks('Las Vegas')).rejects.toThrow('nope');
  });
});
