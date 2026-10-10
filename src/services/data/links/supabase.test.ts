import { mockRows, mockTables, mockUpserts } from '../shared/supabaseMock';
import { supabaseLinks } from './supabase';

jest.mock('../../supabase', () => jest.requireActual('../shared/supabaseMock').mockSupabaseModule);

describe('supabase links', () => {
  it('saves a TikTok link without an id, letting Postgres make one', async () => {
    mockTables.saved_links = { data: mockRows.link, error: null };
    const link = await supabaseLinks.saveLink({
      tripId: 't1',
      url: mockRows.link.url,
      platform: 'tiktok',
      title: 'Eggslut!',
      author: 'a',
      thumbnailUrl: null,
      placeIds: ['p9'],
    });
    expect(mockUpserts.at(-1)).not.toHaveProperty('id');
    expect(mockUpserts.at(-1)).toMatchObject({ trip_id: 't1', place_ids: ['p9'] });
    expect(link).toMatchObject({ id: 'l1', platform: 'tiktok', placeIds: ['p9'] });
  });
});
