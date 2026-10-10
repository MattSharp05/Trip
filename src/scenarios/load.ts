import { setNow } from '@/core/clock';
import type { TabName } from '@/core/tabs';
import { queryClient } from '@/services/data/hooks';
import { useActiveSource } from '@/services/data/active';
import { createDemoSource, supabaseSource } from '@/services/data/source';
import { useScenarioStore } from '@/stores/scenario';
import { useTripStore } from '@/stores/trip';

import { findScenario } from './registry';

/**
 * Start a scenario's demo session: pin "today", swap the data source for an in-memory copy of its
 * fixtures (no network), select its trip and record the view it opens on. Returns the tab to show,
 * or null for an unknown name.
 */
export function loadScenario(name: string): TabName | null {
  const scenario = findScenario(name);
  if (!scenario) return null;
  setNow(scenario.today);
  queryClient.clear();
  useActiveSource.getState().setSource(createDemoSource(scenario.data, scenario.name));
  useTripStore.getState().selectTrip(scenario.tripId);
  useTripStore.getState().setDiscoverAll(scenario.view.discoverAll ?? false);
  useScenarioStore.getState().start(scenario.name, scenario.view);
  return scenario.tab;
}

/** Leave the demo session: real clock, Supabase data, nothing selected. */
export function exitScenario(): void {
  setNow(null);
  queryClient.clear();
  useActiveSource.getState().setSource(supabaseSource);
  useTripStore.getState().selectTrip(null);
  useTripStore.getState().setDiscoverAll(false);
  useScenarioStore.getState().clear();
}
