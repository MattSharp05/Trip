import { useCallback, useMemo } from 'react';
import { create } from 'zustand';

import type { TemperatureUnit } from '@/core/weather';
import { useAuth } from '@/features/auth';
import { useActiveSource } from '@/services/data/active';
import { supabase } from '@/services/supabase';
import { useScenarioStore } from '@/stores/scenario';

import {
  defaultPreferences,
  deviceLocale,
  parsePreferences,
  type DistanceUnit,
  type Preferences,
} from './preferences';

interface PreferenceState {
  /** Whose changes these are: a user id, or `demo:<scenario>`. Others' changes are ignored. */
  owner: string | null;
  /** Changes made on this device: the demo session's only copy, a real account's optimistic one. */
  changes: Partial<Preferences>;
  set: (owner: string, changes: Partial<Preferences>) => void;
  clear: () => void;
}

export const usePreferenceStore = create<PreferenceState>()((set, get) => ({
  owner: null,
  changes: {},
  set: (owner, changes) =>
    set({ owner, changes: get().owner === owner ? { ...get().changes, ...changes } : changes }),
  clear: () => set({ owner: null, changes: {} }),
}));

// Loading a scenario (again) puts a fresh demo data source in place: start from its defaults, and
// drop the changes when leaving it, so scenario links stay deterministic.
useActiveSource.subscribe((state, prev) => {
  if (state.source === prev.source) return;
  if (usePreferenceStore.getState().owner?.startsWith('demo:'))
    usePreferenceStore.getState().clear();
});

export interface UsePreferences {
  preferences: Preferences;
  /** Saves one preference. Resolves to an error message, or null once saved. */
  setPreference: <K extends keyof Preferences>(
    key: K,
    value: Preferences[K],
  ) => Promise<{ error: string | null }>;
}

export const SAVE_FAILED = "Couldn't save that. Check your connection and try again.";

/**
 * The one way to read and change preferences. A real account reads its auth `user_metadata` (kept
 * on the device with the session, so it's there offline and at launch) and saves with
 * `supabase.auth.updateUser`; a scenario demo session keeps changes in memory, never on the server.
 */
export function usePreferences(): UsePreferences {
  const auth = useAuth();
  const scenario = useScenarioStore((s) => s.active);
  const user = auth.status === 'signedIn' ? auth.session.user : null;
  const owner = scenario ? `demo:${scenario}` : (user?.id ?? null);
  const storeOwner = usePreferenceStore((s) => s.owner);
  const changes = usePreferenceStore((s) => s.changes);

  const base = useMemo(() => {
    const defaults = defaultPreferences(deviceLocale());
    return scenario || !user
      ? defaults
      : parsePreferences(user.user_metadata?.preferences, defaults);
  }, [scenario, user]);

  const preferences = useMemo(
    () => (storeOwner === owner ? { ...base, ...changes } : base),
    [base, changes, owner, storeOwner],
  );

  const setPreference = useCallback(
    async <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
      if (!owner) return { error: null };
      const store = usePreferenceStore.getState();
      const before = store.owner === owner ? store.changes : {};
      store.set(owner, { [key]: value } as Partial<Preferences>);
      if (scenario) return { error: null };

      const next = { ...base, ...usePreferenceStore.getState().changes };
      try {
        const { error } = await supabase.auth.updateUser({ data: { preferences: next } });
        if (!error) return { error: null };
      } catch {
        // Treated like a returned error below.
      }
      // Put back what was shown before, unless the user has moved on to another account.
      const now = usePreferenceStore.getState();
      if (now.owner === owner) {
        const reverted = { ...now.changes };
        if (key in before) reverted[key] = before[key];
        else delete reverted[key];
        usePreferenceStore.setState({ changes: reverted });
      }
      return { error: SAVE_FAILED };
    },
    [base, owner, scenario],
  );

  return { preferences, setPreference };
}

/** °F or °C, for anything that shows a temperature. */
export function useTemperatureUnit(): TemperatureUnit {
  return usePreferences().preferences.temperatureUnit;
}

/** Miles or km, for anything that shows a distance. */
export function useDistanceUnit(): DistanceUnit {
  return usePreferences().preferences.distanceUnit;
}

/** Forget this device's preference changes (sign-out). */
export function clearPreferenceCache(): void {
  usePreferenceStore.getState().clear();
}
