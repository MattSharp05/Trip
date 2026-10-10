import { mockAuth, mockCalls, mockTables, mockUpdates } from '../shared/supabaseMock';
import { supabaseMembers } from './supabase';

jest.mock('../../supabase', () => jest.requireActual('../shared/supabaseMock').mockSupabaseModule);

const profileRow = {
  id: 'u1',
  display_name: 'Matthew',
  venmo: null,
  cashapp: '$matt',
  zelle: null,
  created_at: '',
  updated_at: '',
};

beforeEach(() => {
  mockAuth.userId = 'u1';
  mockCalls.length = 0;
});

describe('supabase members', () => {
  it('lists trip_members joined to profiles: you first, then the owner, then by name', async () => {
    mockTables.trip_members = {
      data: [
        { user_id: 'u3', role: 'member', profiles: { display_name: 'willem' } },
        { user_id: 'u2', role: 'owner', profiles: { display_name: 'Blake' } },
        { user_id: 'u1', role: 'member', profiles: { display_name: 'Matthew' } },
        { user_id: 'u4', role: 'member', profiles: null },
      ],
      error: null,
    };
    expect(await supabaseMembers.listMembers('t1')).toEqual([
      { id: 'u1', name: 'Matthew', initial: 'M', role: 'member', isMe: true },
      { id: 'u2', name: 'Blake', initial: 'B', role: 'owner', isMe: false },
      { id: 'u4', name: 'Traveller', initial: 'T', role: 'member', isMe: false },
      { id: 'u3', name: 'willem', initial: 'W', role: 'member', isMe: false },
    ]);
    expect(mockCalls).toEqual([['trip_members', 'eq', 'trip_id', 't1']]);
  });

  it('reads your profile, leaving out handles you have not set', async () => {
    mockTables.profiles = { data: profileRow, error: null };
    expect(await supabaseMembers.getMyProfile()).toEqual({
      id: 'u1',
      displayName: 'Matthew',
      cashapp: '$matt',
    });
    expect(mockCalls).toEqual([['profiles', 'eq', 'id', 'u1']]);
  });

  it('saves your profile trimmed, clearing empty handles', async () => {
    mockTables.profiles = { data: { ...profileRow, venmo: 'matt-v', cashapp: null }, error: null };
    const saved = await supabaseMembers.saveMyProfile({
      displayName: ' Matthew ',
      venmo: 'matt-v',
      cashapp: ' ',
    });
    expect(mockUpdates.at(-1)).toEqual({
      display_name: 'Matthew',
      venmo: 'matt-v',
      cashapp: null,
      zelle: null,
    });
    expect(saved).toEqual({ id: 'u1', displayName: 'Matthew', venmo: 'matt-v' });
    expect(mockCalls).toEqual([['profiles', 'eq', 'id', 'u1']]);
  });

  it('leaves a trip by deleting your own trip_members row', async () => {
    mockTables.trip_members = { data: [{ user_id: 'u1' }], error: null };
    await supabaseMembers.leaveTrip('t1');
    expect(mockCalls).toEqual([
      ['trip_members', 'delete'],
      ['trip_members', 'eq', 'trip_id', 't1'],
      ['trip_members', 'eq', 'user_id', 'u1'],
    ]);
  });

  it('removes another member by deleting their row', async () => {
    mockTables.trip_members = { data: [{ user_id: 'u3' }], error: null };
    await supabaseMembers.removeMember('t1', 'u3');
    expect(mockCalls).toEqual([
      ['trip_members', 'delete'],
      ['trip_members', 'eq', 'trip_id', 't1'],
      ['trip_members', 'eq', 'user_id', 'u3'],
    ]);
  });

  it('reports a delete RLS refused (nothing removed) as an error', async () => {
    mockTables.trip_members = { data: [], error: null };
    await expect(supabaseMembers.leaveTrip('t1')).rejects.toThrow('the owner can’t leave');
    await expect(supabaseMembers.removeMember('t1', 'u2')).rejects.toThrow(
      'Only the owner can remove a member',
    );
  });

  it('rejects a blank name before it reaches the database', async () => {
    const updates = mockUpdates.length;
    await expect(supabaseMembers.saveMyProfile({ displayName: ' ' })).rejects.toThrow(
      'A name is required',
    );
    expect(mockUpdates).toHaveLength(updates);
  });

  it('needs a signed-in user', async () => {
    mockAuth.userId = null;
    await expect(supabaseMembers.listMembers('t1')).rejects.toThrow('Not signed in');
  });
});
