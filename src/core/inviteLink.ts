/**
 * Links into the app (ADR 0029): during the demo phase an Expo Go link that opens the latest `main`
 * EAS Update and deep-links into a route, and `trip://<path>` once there is a standalone build.
 * Scenario QA links (`src/scenarios/link.ts`) and invite links are both built here.
 */

const PROJECT_ID = '0458c1dd-61a0-47f7-ac52-c648b4458fea';
/** Expo Go's runtime for SDK 57; change on an SDK upgrade (same as the QA link in CLAUDE.md). */
const RUNTIME_VERSION = 'exposdk:57.0.0';

export type LinkScheme = 'expo-go' | 'trip';

/** A link that opens the app on `path` (no leading slash), e.g. `scenario/vegas-day-3`. */
export function appLink(path: string, scheme: LinkScheme = 'expo-go'): string {
  return scheme === 'trip'
    ? `trip://${path}`
    : `exp://u.expo.dev/${PROJECT_ID}/--/${path}?runtime-version=${RUNTIME_VERSION}&channel-name=main`;
}

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
  const m = /^(?:exp:\/\/u\.expo\.dev\/[0-9a-f-]+\/--\/|trip:\/\/)invite\/([^/?#]+)\/?(?:[?#].*)?$/.exec(
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
