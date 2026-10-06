import type { TabName } from '@/core/tabs';
import type { DataSnapshot } from '@/services/data/types';
import type { ScenarioView } from '@/stores/scenario';

import { VEGAS_TRIP_ID, vegasSnapshot } from './fixtures/vegas';
import { vegasCrowdedSnapshot } from './fixtures/vegasCrowded';

/** "Today" for every scenario unless it sets its own: Fri, Nov 13 2026, 9:00 AM in Las Vegas. */
export const DEFAULT_TODAY = '2026-11-13T09:00:00-08:00';

export interface Scenario {
  name: string;
  description: string;
  /** The account's data, loaded into the in-memory demo session. */
  data: DataSnapshot;
  /** Instant "today" is pinned to (ISO with offset). */
  today: string;
  tab: TabName;
  tripId: string | null;
  view: ScenarioView;
}

const EMPTY: DataSnapshot = {
  trips: [],
  places: [],
  items: [],
  bookings: [],
  bucketItems: [],
  expenses: [],
  documents: [],
};

/** The Vegas trip with Saturday, Nov 14 left free (its gondola and Forum Shops removed). */
const vegasFreeSaturday: DataSnapshot = {
  ...vegasSnapshot,
  items: vegasSnapshot.items.filter((item) => item.day !== '2026-11-14'),
};

const vegas = (
  s: Omit<Scenario, 'data' | 'tripId' | 'today'> & { today?: string; data?: DataSnapshot },
): Scenario => ({
  data: vegasSnapshot,
  tripId: VEGAS_TRIP_ID,
  today: DEFAULT_TODAY,
  ...s,
});

/** Every scenario, in the order the /dev index lists them. Names are used in QA links: never rename. */
export const SCENARIOS: readonly Scenario[] = [
  vegas({
    name: 'vegas-trips',
    description: 'Trips tab: New York (past), Las Vegas (now), Cape Town, Tokyo.',
    tab: 'trips',
    view: {},
  }),
  vegas({
    name: 'vegas-plan-day-2',
    description: 'Plan tab, Las Vegas, Fri Nov 13: brunch, fountains, Sphere, Carbone.',
    tab: 'plan',
    view: { day: '2026-11-13', planMode: 'itinerary' },
  }),
  vegas({
    name: 'vegas-map-40-pins',
    data: vegasCrowdedSnapshot,
    description: 'Plan tab, Fri Nov 13 with 40 stops: the map performance check.',
    tab: 'plan',
    view: { day: '2026-11-13', planMode: 'itinerary' },
  }),
  vegas({
    name: 'vegas-flight-day',
    description: 'Thu Nov 12 at 7:30 AM in Tampa, before AA 2410 to Las Vegas.',
    tab: 'plan',
    today: '2026-11-12T07:30:00-05:00',
    view: { day: '2026-11-12', itemId: 'item-01', planMode: 'itinerary' },
  }),
  vegas({
    name: 'vegas-free-day',
    data: vegasFreeSaturday,
    description: 'Plan tab on Sat Nov 14 with nothing planned: the free-day state.',
    tab: 'plan',
    view: { day: '2026-11-14', planMode: 'itinerary' },
  }),
  vegas({
    name: 'vegas-bucket',
    description: 'Plan tab on the Bucket List: five saved places and events.',
    tab: 'plan',
    view: { day: '2026-11-13', planMode: 'bucket' },
  }),
  vegas({
    name: 'vegas-wallet',
    description: 'Organize tab, Wallet: flights, hotel, car, UFC ticket, passport.',
    tab: 'organize',
    view: { organizeView: 'wallet' },
  }),
  vegas({
    name: 'vegas-budget-eur',
    description: 'Organize tab, Budget shown in euros (expenses in USD and EUR).',
    tab: 'organize',
    view: { organizeView: 'budget', currency: 'EUR' },
  }),
  {
    name: 'empty-account',
    description: 'A new account with no trips: Trips tab empty state.',
    data: EMPTY,
    today: DEFAULT_TODAY,
    tab: 'trips',
    tripId: null,
    view: {},
  },
];

export function findScenario(name: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.name === name);
}
