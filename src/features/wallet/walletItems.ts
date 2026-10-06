import type { Booking, BookingType, Place, TravelDocument } from '@/services/data/types';

/** What the wallet lists: a trip's bookings plus the account's travel documents. */
export type WalletType = BookingType | 'document';

type BookingEntryOf<B extends Booking> = B extends Booking
  ? { type: B['type']; id: string; booking: B }
  : never;

export type WalletEntry =
  BookingEntryOf<Booking> | { type: 'document'; id: string; document: TravelDocument };

export type WalletEntryOf<T extends WalletType> = Extract<WalletEntry, { type: T }>;

export type WalletFilter = 'all' | WalletType;

export const WALLET_FILTERS: readonly { value: WalletFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'flight', label: 'Flights' },
  { value: 'hotel', label: 'Hotels' },
  { value: 'car', label: 'Cars' },
  { value: 'ticket', label: 'Tickets' },
  { value: 'document', label: 'Documents' },
];

/** Empty state copy for each filter. */
export const EMPTY_COPY: Record<WalletFilter, { title: string; body: string }> = {
  all: { title: 'Nothing in your wallet yet', body: 'Bookings for this trip show up here.' },
  flight: { title: 'No flights on this trip', body: 'Flight bookings show up here.' },
  hotel: { title: 'No hotels on this trip', body: 'Hotel bookings show up here.' },
  car: { title: 'No rental cars on this trip', body: 'Car rentals show up here.' },
  ticket: {
    title: 'No tickets on this trip',
    body: 'Event tickets and reservations show up here.',
  },
  document: {
    title: 'No passport or visa saved',
    body: 'Your passport and visas show up here on every trip.',
  },
};

/** When a booking starts, as local `YYYY-MM-DD HH:MM` (sorts as text). */
export function bookingStart(booking: Booking): string {
  const at = (() => {
    switch (booking.type) {
      case 'flight':
        return booking.data.departs;
      case 'hotel':
        return booking.data.checkIn;
      case 'car':
        return booking.data.pickup;
      case 'ticket':
        return booking.data.starts;
    }
  })();
  return `${at.date} ${at.time}`;
}

/**
 * The wallet in display order: bookings by start (local wall-clock time), then the account's
 * documents, which belong to every trip and have no date.
 */
export function buildWallet(
  bookings: readonly Booking[],
  documents: readonly TravelDocument[],
): WalletEntry[] {
  const sorted = [...bookings].sort(
    (a, b) => bookingStart(a).localeCompare(bookingStart(b)) || a.id.localeCompare(b.id),
  );
  return [
    ...sorted.map((booking) => ({ type: booking.type, id: booking.id, booking }) as WalletEntry),
    ...documents.map((document) => ({ type: 'document' as const, id: document.id, document })),
  ];
}

export function filterWallet(entries: readonly WalletEntry[], filter: WalletFilter): WalletEntry[] {
  return filter === 'all' ? [...entries] : entries.filter((e) => e.type === filter);
}

export type PlaceLookup = ReadonlyMap<string, Place>;

export function placeLookup(places: readonly Place[]): PlaceLookup {
  return new Map(places.map((p) => [p.id, p]));
}
