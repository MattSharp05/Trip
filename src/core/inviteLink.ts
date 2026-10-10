/** Invite links (TR-57, ADR 0029): `…/--/invite/<token>` in Expo Go, `trip://invite/<token>`. */

import { appLink, type LinkScheme } from './appLink';

/** An invite token: URL-safe characters only (the database makes 22). */
const TOKEN = /^[A-Za-z0-9_-]{8,64}$/;

export const isInviteToken = (token: string): boolean => TOKEN.test(token);

/** The link a member shares to invite friends to a trip. */
export function inviteLink(token: string, scheme: LinkScheme = 'expo-go'): string {
  if (!isInviteToken(token)) throw new Error(`Not an invite token: ${token}`);
  return appLink(`invite/${token}`, scheme);
}

/**
 * The token in an invite link, in either form (`exp://…/--/invite/<token>?…` or
 * `trip://invite/<token>`); null for anything else.
 */
export function parseInviteLink(link: string): string | null {
  const m =
    /^(?:exp:\/\/u\.expo\.dev\/[0-9a-f-]+\/--\/|trip:\/\/)invite\/([^/?#]+)\/?(?:[?#].*)?$/.exec(
      link.trim(),
    );
  return m && isInviteToken(m[1]) ? m[1] : null;
}

/** "Join my Las Vegas trip on Trip: <link>", the message the share sheet sends. */
export const inviteMessage = (city: string, link: string): string =>
  `Join my ${city} trip on Trip: ${link}`;

/** The error message both data sources throw for an unknown or reset invite link. */
export const INVITE_INACTIVE = 'invite_inactive';

export const isInviteInactive = (error: unknown): boolean =>
  error instanceof Error && error.message === INVITE_INACTIVE;
