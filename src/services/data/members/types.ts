/**
 * Trip members and profiles (v2: Group trips; TDD → v2 → App; ADR 0027). Everyone on a trip
 * edits it equally; the owner (who created it) can also remove members and delete the trip.
 */

import type { MemberRole } from '@/core/members';

export type { MemberRole };

/** Someone on a trip, as screens show them (avatars, "Added by", the members sheet). */
export interface Member {
  /** Their profile id (`auth.users.id`). */
  id: string;
  name: string;
  /** The letter on their avatar. */
  initial: string;
  role: MemberRole;
  /** The signed-in traveller (in a demo session, the snapshot's `me`). */
  isMe: boolean;
}

/** A traveller's name and payment handles (for Pay with Venmo / Cash App and Zelle details). */
export interface Profile {
  id: string;
  displayName: string;
  venmo?: string;
  cashapp?: string;
  zelle?: string;
}

/** What "save my profile" writes; the id is always the signed-in traveller's. */
export type ProfileInput = Omit<Profile, 'id'>;

/** One `trip_members` row, as a demo snapshot holds it. */
export interface Membership {
  tripId: string;
  userId: string;
  role: MemberRole;
}

/** An invite link in a demo snapshot (`trip_invites`). */
export interface Invite {
  token: string;
  tripId: string;
  createdBy: string;
  revoked?: boolean;
}

/** What someone opening an invite link sees before joining (ADR 0029), and nothing more. */
export interface InvitePreview {
  tripId: string;
  city: string;
  startDate: string;
  endDate: string;
  coverPhotoUrl: string | null;
  /** Who made the link. */
  inviterName: string;
  memberCount: number;
  /** You're on the trip already: the link just opens it. */
  alreadyMember: boolean;
}

/** The members slice of `DataSource`. */
export interface MembersSource {
  /** Everyone on the trip: you first, then the owner, then by name. */
  listMembers(tripId: string): Promise<Member[]>;
  getMyProfile(): Promise<Profile>;
  saveMyProfile(profile: ProfileInput): Promise<Profile>;
  /**
   * Leave a trip. Your stops, Bucket List items and shared bookings stay on it, attributed to
   * you; your private bookings for it are deleted. The owner can't leave (throws).
   */
  leaveTrip(tripId: string): Promise<void>;
  /** The owner removes another member (same effect as them leaving). Throws for anyone else. */
  removeMember(tripId: string, userId: string): Promise<void>;
  /** The trip's invite token, made on first use (members only). */
  createInvite(tripId: string): Promise<string>;
  /** Revokes the trip's invite link (it stops working) and returns a new token. */
  resetInvite(tripId: string): Promise<string>;
  /** Throws `INVITE_INACTIVE` for an unknown or reset link. */
  previewInvite(token: string): Promise<InvitePreview>;
  /** Joins the trip (nothing changes if you're on it) and returns its id; `INVITE_INACTIVE` as above. */
  acceptInvite(token: string): Promise<string>;
}
