import { useScenarioStore } from '@/stores/scenario';

/**
 * Scenario links and the /dev index work in dev builds and wherever EXPO_PUBLIC_SCENARIOS=1 (the
 * `main` EAS Update channel during the demo phase). Everywhere else they are off.
 */
export function scenariosEnabled(
  env: string | undefined = process.env.EXPO_PUBLIC_SCENARIOS,
  dev: boolean = __DEV__,
): boolean {
  return dev || env === '1';
}

/** True while a scenario's demo session is loaded. The auth gate lets the app through then. */
export function isScenarioActive(): boolean {
  return useScenarioStore.getState().active !== null;
}

export function useScenarioActive(): boolean {
  return useScenarioStore((s) => s.active !== null);
}
