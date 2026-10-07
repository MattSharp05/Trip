// Events on a trip's dates (TR-31, ADR 0018). Shared by the `events` Edge Function, which builds
// these from the provider's answer (or the demo fixtures), and the app, which validates the
// function's response and draws the Discover cards.
//
// Dates and times are the venue's local ones (`YYYY-MM-DD`, `HH:MM`), as the traveller reads them
// on a ticket: no time-zone conversion anywhere.

import { z } from 'zod';

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const hhmm = z.string().regex(/^\d{2}:\d{2}$/);

/**
 * Discover's chips, less "All". No provider has networking events yet: those are samples
 * (`networking.ts`, TR-34), marked `sample`.
 */
export const eventCategorySchema = z.enum(['events', 'food', 'nightlife', 'sports', 'networking']);
export type EventCategory = z.infer<typeof eventCategorySchema>;

export const eventVenueSchema = z.object({
  name: z.string().min(1),
  address: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
});
export type EventVenue = z.infer<typeof eventVenueSchema>;

export const tripEventSchema = z.object({
  /** Provider-prefixed and stable: `tm:vvG1…` (Ticketmaster), `fx:fred-again-xs` (fixtures). */
  id: z.string().min(1),
  title: z.string().min(1),
  category: eventCategorySchema,
  date: day,
  /** Null when the provider has no start time yet ("TBA"). */
  time: hhmm.nullable(),
  venue: eventVenueSchema.nullable(),
  imageUrl: z.string().url().nullable(),
  /** The provider's page for tickets. */
  url: z.string().url().nullable(),
  /** A made-up sample for the demo (TR-34), tagged "Sample" on its card. */
  sample: z.boolean().optional(),
});
export type TripEvent = z.infer<typeof tripEventSchema>;

/** The longest date range one request may ask about. */
export const MAX_RANGE_DAYS = 31;
/** Events within this distance of the trip's centre. */
export const RADIUS_KM = 25;

export const eventsRequestSchema = z
  .object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    startDate: day,
    endDate: day,
  })
  .refine(
    (r) =>
      r.endDate >= r.startDate &&
      (Date.parse(r.endDate) - Date.parse(r.startDate)) / 86_400_000 < MAX_RANGE_DAYS,
    { message: 'endDate must be on or after startDate, within 31 days' },
  );
export type EventsRequest = z.infer<typeof eventsRequestSchema>;

export type EventsErrorCode = 'not_configured' | 'invalid' | 'limit_reached' | 'failed';

/** True when a local date falls on the trip (both ends included). */
export function inDateRange(date: string, startDate: string, endDate: string): boolean {
  return date >= startDate && date <= endDate;
}

/** Great-circle distance in km. */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Earliest first; events without a time go last on their day; then by title. */
export function byStart(a: TripEvent, b: TripEvent): number {
  return (
    a.date.localeCompare(b.date) ||
    (a.time ?? '99:99').localeCompare(b.time ?? '99:99') ||
    a.title.localeCompare(b.title)
  );
}

/** The function's events, checked; entries that don't match the schema are dropped. */
export function readEvents(value: unknown): TripEvent[] | null {
  if (!Array.isArray(value)) return null;
  return value.flatMap((entry) => {
    const parsed = tripEventSchema.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
}
