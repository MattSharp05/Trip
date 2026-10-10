import { appLink, type LinkScheme } from '@/core/appLink';

/**
 * The QA link for a scenario: opens the latest `main` EAS Update in Expo Go and deep-links into
 * the scenario. `scheme: 'trip'` gives the standalone-build form (`trip://scenario/<name>`).
 */
export function scenarioLink(name: string, scheme: LinkScheme = 'expo-go'): string {
  return appLink(`scenario/${encodeURIComponent(name)}`, scheme);
}
