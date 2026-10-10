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
  /** The traveller's own notes (detail sheet); absent in fixtures. */
  notes?: string | null;
}

/** The itinerary slice of `DataSource`. */
export interface ItinerarySource {
  saveItineraryItem(item: ItineraryItem): Promise<ItineraryItem>;
  deleteItineraryItem(id: string): Promise<void>;
}
