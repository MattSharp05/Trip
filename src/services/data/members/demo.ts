import { INVITE_INACTIVE } from '@/core/inviteLink';
import { FALLBACK_NAME, sortMembers, toMember } from '@/core/members';

import { bookingVisibility } from '../bookings/visibility';
import { copy, type DemoStore, upsert } from '../shared/demo';
import type { DataSnapshot } from '../types';
import type { Invite, MembersSource, Profile } from './types';

/**
 * Takes `userId` off the trip, as the database does when a member leaves or is removed: their
 * private bookings for the trip go; everything else they added stays, attributed to them.
 */
function withoutMember(db: DataSnapshot, tripId: string, userId: string): DataSnapshot {
  const theirs = (addedBy: string | undefined) => (addedBy ?? db.me) === userId;
  return {
    ...db,
    members: db.members.filter((m) => !(m.tripId === tripId && m.userId === userId)),
    bookings: db.bookings.filter(
      (b) => !(b.tripId === tripId && theirs(b.addedBy) && bookingVisibility(b) === 'private'),
    ),
  };
}

/** The members slice of the demo source: the snapshot's `members` and `profiles`, in memory. */
export function demoMembers(store: DemoStore): MembersSource {
  const myRow = (tripId: string) =>
    store.db.members.find((m) => m.tripId === tripId && m.userId === store.db.me);
  const nameOf = (userId: string) =>
    store.db.profiles.find((p) => p.id === userId)?.displayName ?? null;
  const invites = () => store.db.invites ?? [];
  /** The trip of an active link, as the RPCs find it; throws `INVITE_INACTIVE` like them. */
  const activeInvite = (token: string): Invite => {
    const invite = invites().find((i) => i.token === token && !i.revoked);
    if (!invite || !store.db.trips.some((t) => t.id === invite.tripId)) {
      throw new Error(INVITE_INACTIVE);
    }
    return invite;
  };
  const createInvite = async (tripId: string) => {
    if (!myRow(tripId)) throw new Error(`Not a member of trip ${tripId}`);
    const active = invites().find((i) => i.tripId === tripId && !i.revoked);
    if (active) return active.token;
    const token = `demo-${tripId}-${invites().length + 1}`;
    store.db = {
      ...store.db,
      invites: [...invites(), { token, tripId, createdBy: store.db.me }],
    };
    return token;
  };

  return {
    async listMembers(tripId) {
      const { db } = store;
      // Like RLS: only members see a trip's members.
      if (!myRow(tripId)) return [];
      return sortMembers(
        db.members
          .filter((m) => m.tripId === tripId)
          .map((m) => toMember(m.userId, nameOf(m.userId), m.role, m.userId === db.me)),
      );
    },
    async getMyProfile() {
      const { db } = store;
      return copy(
        db.profiles.find((p) => p.id === db.me) ?? { id: db.me, displayName: FALLBACK_NAME },
      );
    },
    async saveMyProfile(input) {
      const displayName = input.displayName.trim();
      if (!displayName) throw new Error('A name is required');
      // Trimmed, and an empty handle is not set, as the Supabase source saves them.
      const handle = (key: 'venmo' | 'cashapp' | 'zelle') => {
        const value = input[key]?.trim();
        return value ? { [key]: value } : {};
      };
      const profile: Profile = {
        id: store.db.me,
        displayName,
        ...handle('venmo'),
        ...handle('cashapp'),
        ...handle('zelle'),
      };
      store.db = { ...store.db, profiles: upsert(store.db.profiles, profile) };
      return copy(profile);
    },
    async leaveTrip(tripId) {
      const row = myRow(tripId);
      if (!row) throw new Error(`Not a member of trip ${tripId}`);
      if (row.role === 'owner') throw new Error('The owner can’t leave the trip');
      store.db = withoutMember(store.db, tripId, store.db.me);
    },
    async removeMember(tripId, userId) {
      if (myRow(tripId)?.role !== 'owner') throw new Error('Only the owner can remove members');
      const target = store.db.members.find((m) => m.tripId === tripId && m.userId === userId);
      if (!target || target.role === 'owner') throw new Error(`Can’t remove ${userId}`);
      store.db = withoutMember(store.db, tripId, userId);
    },
    createInvite,
    async resetInvite(tripId) {
      if (!myRow(tripId)) throw new Error(`Not a member of trip ${tripId}`);
      store.db = {
        ...store.db,
        invites: invites().map((i) => (i.tripId === tripId ? { ...i, revoked: true } : i)),
      };
      return createInvite(tripId);
    },
    async previewInvite(token) {
      const { tripId, createdBy } = activeInvite(token);
      const trip = store.db.trips.find((t) => t.id === tripId)!;
      return {
        tripId,
        city: trip.city,
        startDate: trip.startDate,
        endDate: trip.endDate,
        coverPhotoUrl: trip.coverPhotoUrl,
        inviterName: nameOf(createdBy)?.trim() || FALLBACK_NAME,
        memberCount: store.db.members.filter((m) => m.tripId === tripId).length,
        alreadyMember: !!myRow(tripId),
      };
    },
    async acceptInvite(token) {
      const { tripId } = activeInvite(token);
      if (!myRow(tripId)) {
        store.db = {
          ...store.db,
          members: [...store.db.members, { tripId, userId: store.db.me, role: 'member' }],
        };
      }
      return tripId;
    },
  };
}
