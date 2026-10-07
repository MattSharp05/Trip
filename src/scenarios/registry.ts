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

/** The sample passport expiring Aug 15, 2027: fine for Las Vegas and Cape Town, not for Tokyo. */
const vegasPassportExpiring: DataSnapshot = {
  ...vegasSnapshot,
  documents: vegasSnapshot.documents.map((d) =>
    d.type === 'passport' ? { ...d, number: '567 890 123', expiresOn: '2027-08-15' } : d,
  ),
};

/**
 * The Vegas trip with a boarding pass added to AA 2410: a synthetic sample image (it encodes
 * nothing) with the code area marked, also standing in as the booking's original file.
 */
const PASS = 'fixture:boarding-pass-aa2410';
const vegasBoardingPass: DataSnapshot = {
  ...vegasSnapshot,
  bookings: vegasSnapshot.bookings.map((b) =>
    b.id === 'booking-flight-out' && b.type === 'flight'
      ? {
          ...b,
          originalPath: PASS,
          data: {
            ...b.data,
            passImage: { uri: PASS, width: 750, height: 1334 },
            passCrop: { x: 0.193, y: 0.547, width: 0.614, height: 0.345 },
          },
        }
      : b,
  ),
};

/** Friday with the Sphere moved to 1:05 PM: 5 minutes after the fountains for a 9 min drive. */
const vegasTightFriday: DataSnapshot = {
  ...vegasSnapshot,
  items: vegasSnapshot.items.map((item) =>
    item.day === '2026-11-13' && item.placeId === 'place-sphere'
      ? { ...item, startTime: '13:05' }
      : item,
  ),
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
    name: 'vegas-plan-tight',
    data: vegasTightFriday,
    description: 'Plan tab, Fri Nov 13 with the Sphere at 1:05 PM: a tight leg in orange.',
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
    name: 'vegas-flight-home',
    description: 'Mon Nov 16 at 9:00 AM in Las Vegas, the day AA 2411 flies home to Tampa.',
    tab: 'plan',
    today: '2026-11-16T09:00:00-08:00',
    view: { day: '2026-11-16', itemId: 'item-15', planMode: 'itinerary' },
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
    name: 'vegas-passport-expiring',
    data: vegasPassportExpiring,
    description: 'Organize tab, Wallet: the passport expires Aug 2027, too soon for Tokyo.',
    tab: 'organize',
    view: { organizeView: 'wallet' },
  }),
  vegas({
    name: 'vegas-boarding-pass',
    data: vegasBoardingPass,
    description: 'Organize tab, Wallet: AA 2410 has a boarding pass image and its original.',
    tab: 'organize',
    view: { organizeView: 'wallet' },
  }),
  vegas({
    name: 'vegas-budget-eur',
    description: 'Organize tab, Budget shown in euros (expenses in USD and EUR).',
    tab: 'organize',
    view: { organizeView: 'budget', currency: 'EUR' },
  }),
  vegas({
    name: 'import-review-flight',
    description: 'Import review: a round-trip flight to Cape Town read from a sample PDF.',
    tab: 'organize',
    view: { organizeView: 'wallet', importSample: 'flight' },
  }),
  vegas({
    name: 'import-review-restaurant',
    description: 'Import review: a dinner reservation at La Colombe, Cape Town.',
    tab: 'organize',
    view: { organizeView: 'wallet', importSample: 'restaurant' },
  }),
  vegas({
    name: 'import-review-new-trip',
    description: 'Import review: a Lisbon hotel with no trip yet, offering to create one.',
    tab: 'organize',
    view: { organizeView: 'wallet', importSample: 'lisbon-hotel' },
  }),
  vegas({
    name: 'import-not-configured',
    description: 'Import before the Gemini key is set: the "not set up yet" message.',
    tab: 'organize',
    view: { organizeView: 'wallet', importSample: 'not-configured' },
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
