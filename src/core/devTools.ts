/**
 * Developer screens (the design gallery, later the scenario index) are on in the demo phase,
 * including the `main` EAS Update channel Matthew QAs on. Set EXPO_PUBLIC_SCENARIOS=off to hide
 * them (TDD → Scenario system: hidden for real accounts outside dev/QA builds).
 */
export function devToolsEnabled(env: string | undefined = process.env.EXPO_PUBLIC_SCENARIOS) {
  return env !== 'off';
}
