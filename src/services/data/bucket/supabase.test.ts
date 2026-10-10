import { mockRows, mockTables, mockUpserts } from '../shared/supabaseMock';
import { supabaseBucket } from './supabase';

jest.mock('../../supabase', () => jest.requireActual('../shared/supabaseMock').mockSupabaseModule);

describe('supabase bucket list', () => {
  it('saves a Discover event as a bucket item with its title and fixed date and time', async () => {
    mockTables.bucket_items = {
      data: {
        id: 'k1',
        user_id: 'u1',
        trip_id: 't1',
        place_id: 'p1',
        duration_minutes: 180,
        window_start: null,
        window_end: null,
        source: 'discover',
        fixed_date: '2026-11-14',
        fixed_time: '20:00:00',
        title: 'Fred again..',
        created_at: '',
        updated_at: '',
      },
      error: null,
    };
    const saved = await supabaseBucket.saveBucketItem({
      id: 'k1',
      tripId: 't1',
      placeId: 'p1',
      durationMinutes: 180,
      windowStart: null,
      windowEnd: null,
      source: 'discover',
      fixedDate: '2026-11-14',
      fixedTime: '20:00',
      title: 'Fred again..',
    });
    expect(mockUpserts.at(-1)).toMatchObject({
      fixed_date: '2026-11-14',
      fixed_time: '20:00',
      title: 'Fred again..',
    });
    expect(saved).toMatchObject({ fixedTime: '20:00', title: 'Fred again..' });
  });

  it('points a bucket item saved from a TikTok at its link', async () => {
    mockTables.bucket_items = { data: mockRows.bucket, error: null };
    const link = {
      id: 'l1',
      tripId: 't1',
      url: mockRows.link.url,
      platform: 'tiktok' as const,
      title: 'Eggslut!',
      author: 'a',
      thumbnailUrl: null,
      placeIds: ['p9'],
    };
    const item = {
      id: 'k2',
      tripId: 't1',
      placeId: 'p9',
      durationMinutes: 75,
      windowStart: '09:00',
      windowEnd: '22:00',
      source: 'tiktok',
      fixedDate: null,
      fixedTime: null,
      link,
    };
    expect(await supabaseBucket.saveBucketItem(item)).toMatchObject({ link: { id: 'l1' } });
    expect(mockUpserts.at(-1)).toMatchObject({ saved_link_id: 'l1' });
  });
});
