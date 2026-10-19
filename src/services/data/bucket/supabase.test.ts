import { mockCalls, mockRows, mockTables, mockUpserts } from '../shared/supabaseMock';
import { supabaseBucket, toBucket } from './supabase';

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

  it('reads who liked an item from its embedded likes (TR-59)', () => {
    const row = { ...mockRows.bucket, bucket_likes: [{ user_id: 'u3' }, { user_id: 'u2' }] };
    expect(toBucket(row).likedBy).toEqual(['u2', 'u3']);
    expect(toBucket({ ...mockRows.bucket, bucket_likes: [] })).not.toHaveProperty('likedBy');
  });

  it('likes as you, and unlikes only your own like', async () => {
    mockTables.bucket_likes = { data: null, error: null };
    await supabaseBucket.likeBucketItem({ id: 'k2', tripId: 't1' });
    expect(mockUpserts.at(-1)).toEqual({ bucket_item_id: 'k2', trip_id: 't1' });

    mockCalls.length = 0;
    await supabaseBucket.unlikeBucketItem('k2');
    expect(mockCalls).toEqual([
      ['bucket_likes', 'delete'],
      ['bucket_likes', 'eq', 'bucket_item_id', 'k2'],
      ['bucket_likes', 'eq', 'user_id', 'u1'],
    ]);
  });

  it('a failed like throws, so the screen can roll it back', async () => {
    mockTables.bucket_likes = {
      data: null,
      error: { message: 'new row violates row-level security' },
    };
    await expect(supabaseBucket.likeBucketItem({ id: 'k2', tripId: 't1' })).rejects.toThrow();
  });
});
