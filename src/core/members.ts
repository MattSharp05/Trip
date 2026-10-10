/**
 * Trip members (v2: Group trips): names, labels and order on avatars and the members sheet.
 * `Member` from the data layer fits `MemberLike`.
 */

export type MemberRole = 'owner' | 'member';

/** The fields these helpers need. */
export interface MemberLike {
  name: string;
  role: MemberRole;
  /** The signed-in traveller (or the demo session's "you"). */
  isMe: boolean;
}

/** The letter on a member's avatar: the name's first character, upper-cased; "?" for no name. */
export function initialOf(name: string): string {
  const [first] = Array.from(name.trim());
  return first ? first.toLocaleUpperCase('en-US') : '?';
}

/** How a member is named in lists: "You" for yourself, otherwise their name. */
export function memberLabel(member: MemberLike): string {
  return member.isMe ? 'You' : member.name;
}

const rank = (m: MemberLike) => (m.isMe ? 0 : m.role === 'owner' ? 1 : 2);

/** You first, then the owner, then everyone else by name. Returns a new array. */
export function sortMembers<T extends MemberLike>(members: readonly T[]): T[] {
  return [...members].sort(
    (a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, 'en-US', { sensitivity: 'base' }),
  );
}
