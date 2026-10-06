const PROJECT_ID = '0458c1dd-61a0-47f7-ac52-c648b4458fea';
/** Expo Go's runtime for SDK 57; change on an SDK upgrade (same as the QA link in CLAUDE.md). */
const RUNTIME_VERSION = 'exposdk:57.0.0';

/**
 * The QA link for a scenario: opens the latest `main` EAS Update in Expo Go and deep-links into
 * the scenario. `scheme: 'trip'` gives the standalone-build form (`trip://scenario/<name>`).
 */
export function scenarioLink(name: string, scheme: 'expo-go' | 'trip' = 'expo-go'): string {
  const path = `scenario/${encodeURIComponent(name)}`;
  return scheme === 'trip'
    ? `trip://${path}`
    : `exp://u.expo.dev/${PROJECT_ID}/--/${path}?runtime-version=${RUNTIME_VERSION}&channel-name=main`;
}
