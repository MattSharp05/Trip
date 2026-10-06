import { Linking } from 'react-native';

import type { Place } from '@/services/data/types';

/** Where a Directions button sends Apple Maps: an address, or a pin when there's only a position. */
export interface Destination {
  address: string | null;
  lat: number | null;
  lng: number | null;
}

/** A booked place as a destination; the booking's own address wins over the place's. */
export function destinationOf(
  place: Place | undefined,
  address?: string | null,
): Destination | null {
  if (!place && !address) return null;
  return {
    address: address ?? place?.address ?? null,
    lat: place?.lat ?? null,
    lng: place?.lng ?? null,
  };
}

/**
 * Apple Maps directions to a destination (`http://maps.apple.com` opens the Maps app on iPhone).
 * The address goes first, so Maps names the stop the way the booking does; a bare position is the
 * fallback. Null when there's nothing to route to.
 */
export function directionsUrl(to: Destination): string | null {
  const target =
    to.address?.trim() || (to.lat !== null && to.lng !== null ? `${to.lat},${to.lng}` : null);
  return target ? `http://maps.apple.com/?daddr=${encodeURIComponent(target)}` : null;
}

/** `+1 702-698-7000` → `tel:+17026987000`; null without any digits. */
export function phoneUrl(phone: string | null): string | null {
  const dial = phone?.replace(/[^\d+]/g, '') ?? '';
  return /\d/.test(dial) ? `tel:${dial}` : null;
}

/** A website as typed on a booking; adds `https://` when the scheme is missing. */
export function websiteUrl(website: string | null): string | null {
  const url = website?.trim();
  if (!url) return null;
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

export function emailUrl(email: string | null): string | null {
  const address = email?.trim();
  return address ? `mailto:${address}` : null;
}

/** Opens a link in its app (Maps, Phone, Safari, Mail). False when iOS couldn't open it. */
export async function openLink(url: string): Promise<boolean> {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
