import { sortMembers, toMember } from '@/core/members';

import { checkRow, client, currentUserId, type Row } from '../shared/supabase';
import type { Member, MembersSource, Profile } from './types';

type MemberRow = Pick<Row<'trip_members'>, 'user_id' | 'role'> & {
  profiles: Pick<Row<'profiles'>, 'display_name'> | null;
};

export const toTripMember = (r: MemberRow, me: string): Member =>
  toMember(
    r.user_id,
    r.profiles?.display_name ?? null,
    r.role === 'owner' ? 'owner' : 'member',
    r.user_id === me,
  );

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
    const me = await currentUserId();
    const rows = checkRow(
      await client()
        .from('trip_members')
        .select('user_id, role, profiles(display_name)')
        .eq('trip_id', tripId),
    );
    return sortMembers(rows.map((r) => toTripMember(r, me)));
  },
  async getMyProfile() {
    const id = await currentUserId();
    return toProfile(checkRow(await client().from('profiles').select('*').eq('id', id).single()));
  },
  async saveMyProfile(profile) {
    const displayName = profile.displayName.trim();
    if (!displayName) throw new Error('A name is required');
    const id = await currentUserId();
    const row = checkRow(
      await client()
        .from('profiles')
        .update({
          display_name: displayName,
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
    await deleteMembership(
      tripId,
      await currentUserId(),
      'You’re not on this trip, or you own it (the owner can’t leave)',
    );
  },
  async removeMember(tripId, userId) {
    await deleteMembership(
      tripId,
      userId,
      'Only the owner can remove a member, and only someone else on the trip',
    );
  },
};
