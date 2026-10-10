import { initialOf, type MemberRole, sortMembers } from '@/core/members';

import { checkRow, client, type Row } from '../shared/supabase';
import type { Member, MembersSource, Profile } from './types';

/** The signed-in user's id, from the session stored on the device (no network call). */
async function myId(): Promise<string> {
  const { data, error } = await client().auth.getSession();
  if (error) throw new Error(error.message);
  const id = data.session?.user.id;
  if (!id) throw new Error('Not signed in');
  return id;
}

type MemberRow = Pick<Row<'trip_members'>, 'user_id' | 'role'> & {
  profiles: Pick<Row<'profiles'>, 'display_name'> | null;
};

export const toMember = (r: MemberRow, me: string): Member => {
  const name = r.profiles?.display_name ?? 'Traveller';
  return {
    id: r.user_id,
    name,
    initial: initialOf(name),
    role: (r.role === 'owner' ? 'owner' : 'member') satisfies MemberRole,
    isMe: r.user_id === me,
  };
};

export const toProfile = (r: Row<'profiles'>): Profile => ({
  id: r.id,
  displayName: r.display_name,
  ...(r.venmo ? { venmo: r.venmo } : {}),
  ...(r.cashapp ? { cashapp: r.cashapp } : {}),
  ...(r.zelle ? { zelle: r.zelle } : {}),
});

/**
 * Deletes one `trip_members` row. RLS lets you delete your own row or (as owner) someone else's,
 * never the owner's; a refused delete removes nothing, so that is reported as an error.
 */
async function deleteMembership(tripId: string, userId: string, refused: string) {
  const removed = checkRow(
    await client()
      .from('trip_members')
      .delete()
      .eq('trip_id', tripId)
      .eq('user_id', userId)
      .select('user_id'),
  );
  if (removed.length === 0) throw new Error(refused);
}

/** The members slice of the Supabase source: `trip_members` joined to `profiles`. */
export const supabaseMembers: MembersSource = {
  async listMembers(tripId) {
    const me = await myId();
    const rows = checkRow(
      await client()
        .from('trip_members')
        .select('user_id, role, profiles(display_name)')
        .eq('trip_id', tripId),
    );
    return sortMembers(rows.map((r) => toMember(r, me)));
  },
  async getMyProfile() {
    const id = await myId();
    return toProfile(checkRow(await client().from('profiles').select('*').eq('id', id).single()));
  },
  async saveMyProfile(profile) {
    const id = await myId();
    const row = checkRow(
      await client()
        .from('profiles')
        .update({
          display_name: profile.displayName.trim(),
          venmo: profile.venmo?.trim() || null,
          cashapp: profile.cashapp?.trim() || null,
          zelle: profile.zelle?.trim() || null,
        })
        .eq('id', id)
        .select()
        .single(),
    );
    return toProfile(row);
  },
  async leaveTrip(tripId) {
    await deleteMembership(tripId, await myId(), 'The owner can’t leave the trip');
  },
  async removeMember(tripId, userId) {
    await deleteMembership(tripId, userId, 'Only the owner can remove members');
  },
};
