import type { HotelData, Place } from '@/services/data/types';

import type { ContactAction, FactRow } from '../details';
import { destinationOf, directionsUrl, emailUrl, phoneUrl, websiteUrl } from '../details';
import { formatDay, formatNights, formatTime, nightsBetween } from '../format';

/** `Nov 12 – Nov 16 · 4 nights`. */
export function stayLine(hotel: HotelData): string {
  const nights = nightsBetween(hotel.checkIn.date, hotel.checkOut.date);
  return `${formatDay(hotel.checkIn.date)} – ${formatDay(hotel.checkOut.date)} · ${formatNights(nights)}`;
}

/** Directions, Call, Website, Email: each only when the booking has what it needs. */
export function hotelActions(hotel: HotelData, place: Place | undefined): ContactAction[] {
  const destination = destinationOf(place, hotel.address);
  return [
    {
      key: 'directions',
      label: 'Directions',
      icon: 'location',
      url: destination ? directionsUrl(destination) : null,
    },
    { key: 'call', label: 'Call', icon: 'phone', url: phoneUrl(hotel.phone) },
    { key: 'website', label: 'Website', icon: 'globe', url: websiteUrl(hotel.website) },
    { key: 'email', label: 'Email', icon: 'envelope', url: emailUrl(hotel.email) },
  ];
}

/** Check-in and check-out side by side, then the confirmation and the room. */
export function hotelFacts(hotel: HotelData): FactRow[] {
  const at = (d: HotelData['checkIn']) => `${formatDay(d.date)}, ${formatTime(d.time)}`;
  return [
    [
      { label: 'Check-in', value: at(hotel.checkIn) },
      { label: 'Check-out', value: at(hotel.checkOut) },
    ],
    [{ label: 'Confirmation #', value: hotel.confirmation || null }],
    [{ label: 'Room', value: hotel.room }],
  ];
}

/** What to search Unsplash for when the place has no photo of its own. */
export function hotelPhotoQuery(hotel: HotelData): string {
  return `${hotel.name} hotel`;
}
