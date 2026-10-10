import { mockUpserts, mockTables } from '../shared/supabaseMock';
import { supabasePlaces } from './supabase';

jest.mock('../../supabase', () => jest.requireActual('../shared/supabaseMock').mockSupabaseModule);

describe('supabase places', () => {
  it('adds a place without an id, letting Postgres make one', async () => {
    mockTables.places = {
      data: {
        id: 'p9',
        user_id: 'u1',
        name: 'Eggslut',
        address: '3708 Las Vegas Blvd S, Las Vegas',
        lat: 36.11,
        lng: -115.17,
        kind: 'food',
        photo_url: null,
        source_url: null,
        created_at: '',
        updated_at: '',
      },
      error: null,
    };
    const saved = await supabasePlaces.savePlace({
      name: 'Eggslut',
      address: '3708 Las Vegas Blvd S, Las Vegas',
      lat: 36.11,
      lng: -115.17,
      kind: 'food',
      photoUrl: null,
      sourceUrl: null,
    });
    expect(mockUpserts.at(-1)).not.toHaveProperty('id');
    expect(mockUpserts.at(-1)).toMatchObject({ name: 'Eggslut', photo_url: null });
    expect(saved).toMatchObject({ id: 'p9', name: 'Eggslut', kind: 'food' });
  });
});
