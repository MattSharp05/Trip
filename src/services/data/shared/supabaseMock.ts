/**
 * Test helper: a chainable stand-in for supabase-js. Every builder call returns itself; awaiting
 * it resolves to the table's canned response in `mockTables` (`rpc:<name>` for an RPC). Domain tests install it with
 * `jest.mock('../../supabase', () => jest.requireActual('../shared/supabaseMock').mockSupabaseModule)`.
 */
export const mockTables: Record<string, { data: unknown; error: { message: string } | null }> = {};
export const mockUpserts: unknown[] = [];
export const mockInserts: unknown[] = [];
export const mockUpdates: unknown[] = [];
/** Every filter and delete, in order, e.g. `['trip_members', 'eq', 'trip_id', 't1']`. */
export const mockCalls: unknown[][] = [];
/** The signed-in user `auth.getSession()` reports; null for signed out. */
export const mockAuth: { userId: string | null } = { userId: 'u1' };

export const mockSupabaseModule = {
  supabase: {
    auth: {
      getSession: async () => ({
        data: { session: mockAuth.userId ? { user: { id: mockAuth.userId } } : null },
        error: null,
      }),
    },
    rpc: (fn: string, args: unknown) => {
      mockCalls.push(['rpc', fn, args]);
      return mockSupabaseModule.supabase.from(`rpc:${fn}`);
    },
    from: (table: string) => {
      const builder: any = {
        then: (resolve: (v: unknown) => void) => resolve(mockTables[table]),
      };
      for (const m of ['select', 'order', 'in', 'single', 'maybeSingle']) {
        builder[m] = () => builder;
      }
      for (const m of ['eq', 'delete']) {
        builder[m] = (...args: unknown[]) => {
          mockCalls.push([table, m, ...args]);
          return builder;
        };
      }
      builder.insert = (row: unknown) => {
        mockInserts.push(row);
        return builder;
      };
      builder.update = (row: unknown) => {
        mockUpdates.push(row);
        return builder;
      };
      builder.upsert = (row: unknown) => {
        mockUpserts.push(row);
        return builder;
      };
      return builder;
    },
  },
};

/** Rows as Postgres returns them, shared by the domains' Supabase tests. */
export const mockRows = {
  trip: {
    id: 't1',
    user_id: 'u1',
    city: 'Las Vegas',
    country: 'United States',
    lat: 36.1,
    lng: -115.1,
    timezone: 'America/Los_Angeles',
    start_date: '2026-11-12',
    end_date: '2026-11-16',
    cover_photo_url: null,
    cover_photo_credit: null,
    budget_minor: null,
    budget_currency: null,
    created_at: '',
    updated_at: '',
  },
  link: {
    id: 'l1',
    user_id: 'u1',
    trip_id: 't1',
    url: 'https://www.tiktok.com/@a/video/1',
    platform: 'tiktok',
    title: 'Eggslut!',
    author: 'a',
    thumbnail_url: null,
    place_ids: ['p9'],
    created_at: '',
    updated_at: '',
  },
  bucket: {
    id: 'k2',
    user_id: 'u1',
    trip_id: 't1',
    place_id: 'p9',
    duration_minutes: 75,
    window_start: '09:00:00',
    window_end: '22:00:00',
    source: 'tiktok',
    fixed_date: null,
    fixed_time: null,
    title: null,
    saved_link_id: 'l1',
    created_at: '',
    updated_at: '',
  },
};
