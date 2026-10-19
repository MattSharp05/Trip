export type ItemKind = 'flight' | 'hotel' | 'car' | 'event' | 'food' | 'activity';

export interface ItineraryItem {
  id: string;
  tripId: string;
  day: string;
  startTime: string | null;
  durationMinutes: number | null;
  placeId: string | null;
  kind: ItemKind;
  bookingId: string | null;
  /** Fixed items (bookings, tickets) never move when Smart Add reshuffles a day. */
  fixed: boolean;
  /** Display title; without one, screens show the place's name. */
  title?: string;
  /**
   * Who added it (profile id); kept when a Bucket List item is planned by someone else. Absent in
   * v1 fixtures, meaning you.
   */
  addedBy?: string;
  /** The traveller's own notes (detail sheet); absent in fixtures. */
  notes?: string | null;
  /**
   * Who opted out of it (profile ids, TR-60). Everyone on the trip is going unless listed here;
   * absent or empty means everyone is in.
   */
  optedOut?: string[];
}

/** The itinerary slice of `DataSource`. */
export interface ItinerarySource {
  saveItineraryItem(item: ItineraryItem): Promise<ItineraryItem>;
  deleteItineraryItem(id: string): Promise<void>;
  /** You're not going to this stop (TR-60). Nothing changes if you're already out. */
  optOut(itemId: string, tripId: string): Promise<void>;
  /** You're going after all. */
  optIn(itemId: string): Promise<void>;
}
