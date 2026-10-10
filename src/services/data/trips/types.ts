import type { Money } from '@/core/money';

import type { TripData } from '../types';

/** Credit for a cover photo (Unsplash guidelines: "Photo by <name> on Unsplash", with links). */
export interface PhotoCredit {
  source: 'unsplash';
  photographer: string;
  photographerUrl: string;
  photoUrl: string;
}

export interface Trip {
  id: string;
  city: string;
  country: string | null;
  lat: number | null;
  lng: number | null;
  /** IANA timezone, e.g. `America/Los_Angeles`. */
  timezone: string;
  startDate: string;
  endDate: string;
  coverPhotoUrl: string | null;
  /** Who took the cover photo; null (or absent in fixtures) when it needs no credit line. */
  coverPhotoCredit?: PhotoCredit | null;
  /** The trip's total budget, in the currency it was set in; null when none is set. */
  budget?: Money | null;
}

/** What "create a trip" saves; the source assigns the id. */
export type NewTrip = Omit<Trip, 'id' | 'budget'>;

/** The trips slice of `DataSource`. */
export interface TripsSource {
  listTrips(): Promise<Trip[]>;
  /** Adds a trip; the source assigns the id unless one is given (the sample trip, TR-35). */
  createTrip(trip: NewTrip, id?: string): Promise<Trip>;
  /** Deletes a trip with its bookings, itinerary, Bucket List, expenses and saved links. */
  deleteTrip(id: string): Promise<void>;
  getTripData(tripId: string): Promise<TripData | null>;
  /** Set (or clear, with null) a trip's total budget. */
  saveTripBudget(tripId: string, budget: Money | null): Promise<Trip>;
}
