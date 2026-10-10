import { mockTables } from '../shared/supabaseMock';
import { supabaseDocuments } from './supabase';

jest.mock('../../supabase', () => jest.requireActual('../shared/supabaseMock').mockSupabaseModule);

describe('supabase documents', () => {
  it('throws the query error', async () => {
    mockTables.documents = { data: null, error: { message: 'JWT expired' } };
    await expect(supabaseDocuments.listDocuments()).rejects.toThrow('JWT expired');
  });
});
