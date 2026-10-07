import type { DataSnapshot, DataSource } from '@/services/data';

import { vegasSnapshot } from './fixtures/vegas';

/**
 * Settings → Developer (TR-35): copy the sample account (the vegas fixtures every scenario starts
 * from) into a signed-in account, or take it out again. Every fixture id maps to a UUID derived
 * from the user and the fixture id, so adding twice writes the same rows (idempotent), removing
 * finds exactly what was added, and two accounts never share a row id.
 */

/** A deterministic UUID (version 4 layout) for one fixture row in one account. */
export function sampleId(userId: string, fixtureId: string): string {
  const key = `trip-sample:${userId}:${fixtureId}`;
  // cyrb128: four 32-bit lanes, enough to keep the ~100 rows of one account apart.
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < key.length; i++) {
    const k = key.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  const hex = [h1 ^ h2 ^ h3 ^ h4, h2 ^ h1, h3 ^ h1, h4 ^ h1]
    .map((h) => (h >>> 0).toString(16).padStart(8, '0'))
    .join('');
  const variant = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/** Every id in the snapshot: rows, and the saved links some Bucket List items carry. */
function fixtureIds(snapshot: DataSnapshot): Set<string> {
  return new Set([
    ...snapshot.trips.map((r) => r.id),
    ...snapshot.places.map((r) => r.id),
    ...snapshot.items.map((r) => r.id),
    ...snapshot.bookings.map((r) => r.id),
    ...snapshot.bucketItems.map((r) => r.id),
    ...snapshot.bucketItems.flatMap((r) => (r.link?.id ? [r.link.id] : [])),
    ...snapshot.expenses.map((r) => r.id),
    ...snapshot.documents.map((r) => r.id),
  ]);
}

/**
 * The snapshot as it is stored for this user: every string that is a fixture id (row ids and the
 * references to them, also inside bookings' JSON) becomes that row's UUID in the account.
 */
export function sampleSnapshot(userId: string, snapshot: DataSnapshot = vegasSnapshot) {
  const ids = fixtureIds(snapshot);
  const remap = (value: unknown): unknown => {
    if (typeof value === 'string') return ids.has(value) ? sampleId(userId, value) : value;
    if (Array.isArray(value)) return value.map(remap);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, remap(v)]));
    }
    return value;
  };
  return remap(snapshot) as DataSnapshot;
}

/** The sample Las Vegas trip's id in this account (the one to open after adding it). */
export function sampleVegasTripId(userId: string): string {
  return sampleId(userId, 'trip-vegas');
}

/**
 * Adds the sample account's trips, places, bookings, itineraries, Bucket Lists, expenses, budgets
 * and passports. Safe to run again: rows already there are written again with the same values,
 * and a trip or booking that exists is not created twice.
 */
export async function addSampleData(source: DataSource, userId: string): Promise<void> {
  const data = sampleSnapshot(userId);
  const existingTrips = new Set((await source.listTrips()).map((t) => t.id));
  for (const { id, budget, ...trip } of data.trips) {
    if (!existingTrips.has(id)) await source.createTrip(trip, id);
    if (budget !== undefined) await source.saveTripBudget(id, budget);
  }
  for (const place of data.places) await source.savePlace(place);

  const existingBookings = new Set<string>();
  for (const trip of data.trips) {
    const current = await source.getTripData(trip.id);
    current?.bookings.forEach((b) => existingBookings.add(b.id));
  }
  for (const booking of data.bookings) {
    if (existingBookings.has(booking.id)) await source.saveBooking(booking);
    else await source.createBooking(booking);
  }
  for (const item of data.items) await source.saveItineraryItem(item);
  for (const item of data.bucketItems) {
    if (item.link) await source.saveLink(item.link);
    await source.saveBucketItem(item);
  }
  for (const expense of data.expenses) await source.saveExpense(expense);
  for (const document of data.documents) await source.saveDocument(document);
}

/**
 * Removes what `addSampleData` added (and anything the user then added to the sample trips);
 * the user's own trips, places and passports stay.
 */
export async function removeSampleData(source: DataSource, userId: string): Promise<void> {
  const data = sampleSnapshot(userId);
  const sampleTrips = new Set(data.trips.map((t) => t.id));
  for (const trip of await source.listTrips()) {
    if (sampleTrips.has(trip.id)) await source.deleteTrip(trip.id);
  }
  for (const place of data.places) await source.deletePlace(place.id);
  const sampleDocuments = new Set(data.documents.map((d) => d.id));
  for (const document of await source.listDocuments()) {
    if (sampleDocuments.has(document.id)) await source.deleteDocument(document.id);
  }
}

/** Whether the account already has the sample Las Vegas trip. */
export async function hasSampleData(source: DataSource, userId: string): Promise<boolean> {
  const id = sampleVegasTripId(userId);
  return (await source.listTrips()).some((t) => t.id === id);
}
