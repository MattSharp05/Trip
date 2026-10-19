import { bookingVisibility } from '@/services/data/bookings/visibility';
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

/** Mine / Shared on a group trip (PRD v2 feature 5, ADR 0027). */
export type WalletScope = 'mine' | 'shared';

export const WALLET_SCOPES: readonly { value: WalletScope; label: string }[] = [
  { value: 'mine', label: 'Mine' },
  { value: 'shared', label: 'Shared' },
];

/** Empty state copy for Mine and Shared with every type showing. */
export const SCOPE_EMPTY_COPY: Record<WalletScope, { title: string; body: string }> = {
  mine: {
    title: 'Nothing private on this trip',
    body: 'Your flights, passport and anything you keep to yourself show up here.',
  },
  shared: {
    title: 'Nothing shared yet',
    body: 'Hotels, cars and tickets on this trip show up here for everyone.',
  },
};

/** The empty state on a group trip: Mine / Shared copy, or the filter's own. */
export function scopeEmptyCopy(
  scope: WalletScope,
  filter: WalletFilter,
): { title: string; body: string } {
  if (filter === 'all') return SCOPE_EMPTY_COPY[scope];
  if (scope === 'shared' && filter === 'document') {
    return {
      title: 'No shared passports or visas',
      body: 'Documents someone shares with this trip show up here.',
    };
  }
  return EMPTY_COPY[filter];
}

/** Who added an entry (a profile id). v1 rows carry none: they are yours. */
export function entryOwner(entry: WalletEntry, me: string): string {
  return ('booking' in entry ? entry.booking.addedBy : entry.document.addedBy) ?? me;
}

/** Whether the trip's members see it: a shared booking, or a document shared with this trip. */
export function isSharedWithTrip(entry: WalletEntry, tripId: string | null): boolean {
  return 'booking' in entry
    ? bookingVisibility(entry.booking) === 'shared'
    : tripId !== null && (entry.document.sharedTripIds ?? []).includes(tripId);
}

/**
 * The documents a trip's wallet shows: yours, and others' that they shared with this trip (others'
 * shared with another trip of yours stay off it).
 */
export function documentsFor(
  documents: readonly TravelDocument[],
  me: string,
  tripId: string | null,
): TravelDocument[] {
  return documents.filter(
    (d) =>
      (d.addedBy ?? me) === me || (tripId !== null && (d.sharedTripIds ?? []).includes(tripId)),
  );
}

/**
 * Mine: your private bookings and your documents (shared or not). Shared: every shared booking on
 * the trip, anyone's, and documents others shared with it. Nothing private to you is ever in
 * Shared, and nothing of anyone else's is in Mine.
 */
export function scopeWallet(
  entries: readonly WalletEntry[],
  scope: WalletScope,
  me: string,
  tripId: string | null,
): WalletEntry[] {
  return entries.filter((entry) => {
    const mine = entryOwner(entry, me) === me;
    const shared = isSharedWithTrip(entry, tripId);
    if (scope === 'mine') return mine && (entry.type === 'document' || !shared);
    return entry.type === 'document' ? !mine && shared : shared;
  });
}

/**
 * The small line a card carries in Mine / Shared: "Added by Blake" on someone else's item, and
 * "Shared" on your document that this trip's members can see.
 */
export function walletTag(
  entry: WalletEntry,
  me: string,
  tripId: string | null,
  nameOf: (id: string) => string,
): string | null {
  const owner = entryOwner(entry, me);
  if (owner !== me) return `Added by ${nameOf(owner)}`;
  return entry.type === 'document' && isSharedWithTrip(entry, tripId) ? 'Shared' : null;
}
