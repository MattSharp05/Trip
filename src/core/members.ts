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

/** A traveller with no profile row (or no name) gets the database's fallback name. */
export const FALLBACK_NAME = 'Traveller';

/** A member as screens show them: their name (or the fallback) and avatar initial. */
export function toMember(id: string, name: string | null, role: MemberRole, isMe: boolean) {
  const shown = name?.trim() || FALLBACK_NAME;
  return { id, name: shown, initial: initialOf(shown), role, isMe };
}

const rank = (m: MemberLike) => (m.isMe ? 0 : m.role === 'owner' ? 1 : 2);

/** You first, then the owner, then everyone else by name. Returns a new array. */
export function sortMembers<T extends MemberLike>(members: readonly T[]): T[] {
  return [...members].sort(
    (a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, 'en-US', { sensitivity: 'base' }),
  );
}

/** The most avatars a header shows before "+n" (TR-56). */
export const MAX_AVATARS = 4;

/**
 * The header's avatar row (TR-56): everyone else in list order, then you last, at most `max`
 * circles (you always among them), and how many more there are for "+n". Empty when you're alone
 * on the trip: the row is hidden.
 */
export function avatarRow<T extends MemberLike>(
  members: readonly T[],
  max = MAX_AVATARS,
): { shown: T[]; more: number } {
  if (members.length <= 1) return { shown: [], more: 0 };
  const me = members.filter((m) => m.isMe);
  const others = members.filter((m) => !m.isMe);
  const room = Math.max(max - me.length, 0);
  return { shown: [...others.slice(0, room), ...me], more: Math.max(others.length - room, 0) };
}

/** Under a name in the members sheet: "Organizer" for the trip's creator, "You" for yourself. */
export function memberRoleLine(member: MemberLike): string {
  return [member.role === 'owner' ? 'Organizer' : null, member.isMe ? 'You' : null]
    .filter(Boolean)
    .join(' · ');
}

/** Who an invite says you'd join (TR-57): "with Matthew", "with Matthew and 2 others". */
export function inviteCompanyLine(inviterName: string, memberCount: number): string {
  const others = Math.max(memberCount - 1, 0);
  if (others === 0) return `with ${inviterName}`;
  return `with ${inviterName} and ${others} ${others === 1 ? 'other' : 'others'}`;
}
