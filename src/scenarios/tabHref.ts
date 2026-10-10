import type { Href } from 'expo-router';

import type { TabName } from '@/core/tabs';

import type { Scenario } from './registry';

/** Route for each tab, typed for Expo Router. */
export const TAB_HREF = {
  trips: '/trips',
  plan: '/plan',
  organize: '/organize',
  discover: '/discover',
} as const satisfies Record<TabName, string>;

/** Where a scenario opens: its own screen if it has one, else its tab. */
export const scenarioHref = (scenario: Pick<Scenario, 'href' | 'tab'>): Href =>
  scenario.href ?? TAB_HREF[scenario.tab];
