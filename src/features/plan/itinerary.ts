import type { SFSymbol } from 'expo-symbols';

import { timeLabel } from '@/core/dates';
import { pinSymbol } from '@/features/map';
import type { Booking, ItineraryItem, Place } from '@/services/data/types';

/** One line of the day's timeline, ready to draw. */
export interface ItineraryEntry {
  id: string;
  /** The map pin it links to; null when the item has no place. */
  placeId: string | null;
  /** "3:00 PM"; null for an item without a time. */
  time: string | null;
  title: string;
  /** Where it is ("255 Sands Ave", "Paris Las Vegas") or, for a flight, its number ("AA 2410"). */
  subtitle: string | null;
  photo: string | null;
  /** Drawn on the thumbnail when there's no photo. */
  symbol: SFSymbol;
}

type ItineraryData = { places: Place[]; items: ItineraryItem[]; bookings: Booking[] };

/** Same order as the map's route (`dayPins`): by time, untimed items last. */
const byTime = (a: ItineraryItem, b: ItineraryItem) =>
  (a.startTime ?? '99:99').localeCompare(b.startTime ?? '99:99') || a.id.localeCompare(b.id);

/** The first part of an address: the venue or street ("Paris Las Vegas", "255 Sands Ave"). */
const area = (address: string | null) => address?.split(',')[0].trim() || null;

/** The day's items as timeline entries, in visit order. */
export function itineraryEntries({ places, items, bookings }: ItineraryData, day: string) {
  const placeById = new Map(places.map((p) => [p.id, p]));
  const bookingById = new Map(bookings.map((b) => [b.id, b]));

  return items
    .filter((item) => item.day === day)
    .sort(byTime)
    .map((item): ItineraryEntry => {
      const place = item.placeId ? placeById.get(item.placeId) : undefined;
      const booking = item.bookingId ? bookingById.get(item.bookingId) : undefined;
      return {
        id: item.id,
        placeId: place ? place.id : null,
        time: item.startTime ? timeLabel(item.startTime) : null,
        title: item.title || place?.name || 'Untitled stop',
        subtitle:
          booking?.type === 'flight' ? booking.data.flightNumber : area(place?.address ?? null),
        photo: place?.photoUrl ?? null,
        symbol: pinSymbol(place?.kind ?? item.kind),
      };
    });
}

/**
 * The item a tapped pin stands for: the day's first visit to the place, else (a grey dot) the
 * trip's first visit, on its own day. Null when no item uses the place.
 */
export function itemForPin(
  items: ItineraryItem[],
  placeId: string,
  day: string,
): { itemId: string; day: string } | null {
  const visits = items
    .filter((item) => item.placeId === placeId)
    .sort((a, b) => a.day.localeCompare(b.day) || byTime(a, b));
  const visit = visits.find((item) => item.day === day) ?? visits[0];
  return visit ? { itemId: visit.id, day: visit.day } : null;
}
