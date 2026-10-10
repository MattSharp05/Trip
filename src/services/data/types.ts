/**
 * The app's data model, as screens see it. It mirrors the Supabase tables (TDD → Data & state) in
 * camelCase. Dates are `YYYY-MM-DD` and times `HH:MM` (24h), both local wall-clock time in the
 * trip's timezone (flights carry each airport's own timezone). Money is integer minor units plus
 * an ISO currency code.
 *
 * Each domain's models live in its folder (`trips/types.ts`, …); this file re-exports them and
 * holds the types that span domains.
 */

import type { Money } from '@/core/money';

import type { Booking } from './bookings/types';
import type { BucketItem } from './bucket/types';
import type { TravelDocument } from './documents/types';
import type { Expense } from './expenses/types';
import type { ItineraryItem } from './itinerary/types';
import type { Place } from './places/types';
import type { Trip } from './trips/types';

export type { Money };
export type * from './bookings/types';
export type * from './bucket/types';
export type * from './documents/types';
export type * from './expenses/types';
export type * from './itinerary/types';
export type * from './links/types';
export type * from './members/types';
export type * from './places/types';
export type * from './trips/types';

/** Everything one trip's screens need, loaded together. */
export interface TripData {
  trip: Trip;
  places: Place[];
  items: ItineraryItem[];
  bookings: Booking[];
  bucketItems: BucketItem[];
  expenses: Expense[];
}

/** A whole account's data: what a scenario loads into the demo session. */
export interface DataSnapshot {
  trips: Trip[];
  places: Place[];
  items: ItineraryItem[];
  bookings: Booking[];
  bucketItems: BucketItem[];
  expenses: Expense[];
  documents: TravelDocument[];
}
