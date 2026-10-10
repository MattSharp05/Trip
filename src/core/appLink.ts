/**
 * Links into the app (ADR 0029): during the demo phase an Expo Go link that opens the latest `main`
 * EAS Update and deep-links into a route, and `trip://<path>` once there is a standalone build.
 * Scenario QA links (`src/scenarios/link.ts`) and invite links (`./inviteLink.ts`) use it.
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
