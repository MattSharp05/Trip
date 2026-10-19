import { mockCalls, mockTables, mockUpserts } from '../shared/supabaseMock';
import { supabaseDocuments } from './supabase';

jest.mock('../../supabase', () => jest.requireActual('../shared/supabaseMock').mockSupabaseModule);

describe('supabase documents', () => {
  it('throws the query error', async () => {
    mockTables.documents = { data: null, error: { message: 'JWT expired' } };
    await expect(supabaseDocuments.listDocuments()).rejects.toThrow('JWT expired');
  });

  it('lists documents with their owner and the trips they are shared with', async () => {
    mockTables.documents = {
      data: [
        {
          id: 'd1',
          user_id: 'u2',
          type: 'passport',
          country: 'Netherlands',
          number: null,
          expires_on: null,
          image_paths: [],
          document_shares: [{ trip_id: 't1' }],
        },
      ],
      error: null,
    };
    expect(await supabaseDocuments.listDocuments()).toEqual([
      expect.objectContaining({ id: 'd1', addedBy: 'u2', sharedTripIds: ['t1'] }),
    ]);
  });

  it('shares a document with a trip and stops sharing it', async () => {
    mockTables.document_shares = { data: null, error: null };
    await supabaseDocuments.setDocumentShared('d1', 't1', true);
    expect(mockUpserts.at(-1)).toEqual({ document_id: 'd1', trip_id: 't1' });
    await supabaseDocuments.setDocumentShared('d1', 't1', false);
    expect(mockCalls.slice(-3)).toEqual([
      ['document_shares', 'delete'],
      ['document_shares', 'eq', 'document_id', 'd1'],
      ['document_shares', 'eq', 'trip_id', 't1'],
    ]);
  });
});
