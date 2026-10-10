/**
 * Where screens' data comes from, composed from one module per domain.
 *
 * Each domain folder (`trips`, `places`, `itinerary`, `bookings`, `links`, `bucket`, `expenses`,
 * `documents`, `members`) holds `types.ts` (its models and its slice of `DataSource`), `demo.ts`
 * (its slice of the in-memory demo source), `supabase.ts` (its slice of the Supabase source and
 * row mappers), `hooks.ts` (its React Query hooks) and their tests.
 *
 * Adding a method to a domain touches only that domain's folder: the slice interface in its
 * `types.ts`, both implementations and its hook. This file and `index.ts` change only for a new
 * domain: one line each in `DataSource`, `createDemoSource` and `supabaseSource` below (plus its
 * `export *` lines in `types.ts` and `hooks.ts`).
 */

import { bookingPlaceIds } from './bookings/placeIds';
import { demoBookings } from './bookings/demo';
import { supabaseBookings } from './bookings/supabase';
import { demoBucket } from './bucket/demo';
import { supabaseBucket } from './bucket/supabase';
import { demoDocuments } from './documents/demo';
import { supabaseDocuments } from './documents/supabase';
import { demoExpenses } from './expenses/demo';
import { supabaseExpenses } from './expenses/supabase';
import { demoItinerary } from './itinerary/demo';
import { supabaseItinerary } from './itinerary/supabase';
import { demoLinks } from './links/demo';
import { supabaseLinks } from './links/supabase';
import { demoMembers } from './members/demo';
import { supabaseMembers } from './members/supabase';
import { demoPlaces } from './places/demo';
import { supabasePlaces } from './places/supabase';
import { copy, type DemoStore } from './shared/demo';
import { demoTrips } from './trips/demo';
import { supabaseTrips } from './trips/supabase';
import type {
  BookingsSource,
  BucketSource,
  DataSnapshot,
  DocumentsSource,
  ExpensesSource,
  ItinerarySource,
  LinksSource,
  MembersSource,
  PlacesSource,
  TripsSource,
} from './types';

export { bookingPlaceIds };

/**
 * Where screens' data comes from. Hooks (`./hooks`) read through the active source: Supabase for
 * a signed-in account, or the in-memory demo session a scenario loads (no network).
 */
export interface DataSource
  extends
    TripsSource,
    PlacesSource,
    ItinerarySource,
    BookingsSource,
    LinksSource,
    BucketSource,
    ExpensesSource,
    DocumentsSource,
    MembersSource {
  /** Unique per source instance; part of every query key, so switching sources never mixes caches. */
  readonly id: string;
  readonly kind: 'demo' | 'supabase';
}

let demoCount = 0;

/**
 * The demo session: a scenario's snapshot held in memory. Reads and writes never touch the
 * network, and each source gets its own deep copy, so reloading a scenario starts clean.
 */
export function createDemoSource(snapshot: DataSnapshot, name = 'demo'): DataSource {
  const store: DemoStore = { db: copy(snapshot) };
  demoCount += 1;
  return {
    id: `demo:${name}:${demoCount}`,
    kind: 'demo',
    ...demoTrips(store),
    ...demoPlaces(store),
    ...demoItinerary(store),
    ...demoBookings(store),
    ...demoLinks(store),
    ...demoBucket(store),
    ...demoExpenses(store),
    ...demoDocuments(store),
    ...demoMembers(store),
  };
}

/** The signed-in account's data. RLS scopes every query to the user; `user_id` defaults to them. */
export const supabaseSource: DataSource = {
  id: 'supabase',
  kind: 'supabase',
  ...supabaseTrips,
  ...supabasePlaces,
  ...supabaseItinerary,
  ...supabaseBookings,
  ...supabaseLinks,
  ...supabaseBucket,
  ...supabaseExpenses,
  ...supabaseDocuments,
  ...supabaseMembers,
};
