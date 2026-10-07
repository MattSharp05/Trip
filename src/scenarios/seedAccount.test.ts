import { createDemoSource } from '@/services/data/source';
import type { DataSnapshot } from '@/services/data/types';

import { vegasSnapshot } from './fixtures/vegas';
import {
  addSampleData,
  hasSampleData,
  removeSampleData,
  sampleId,
  sampleSnapshot,
  sampleVegasTripId,
} from './seedAccount';

const EMPTY: DataSnapshot = {
  trips: [],
  places: [],
  items: [],
  bookings: [],
  bucketItems: [],
  expenses: [],
  documents: [],
};
const USER = '6f1c2a9e-0000-4000-8000-000000000001';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Rows per table across the whole account. */
async function counts(source: ReturnType<typeof createDemoSource>) {
  const trips = await source.listTrips();
  const data = await Promise.all(trips.map((t) => source.getTripData(t.id)));
  const sum = (pick: (d: NonNullable<(typeof data)[number]>) => unknown[]) =>
    data.reduce((n, d) => n + (d ? pick(d).length : 0), 0);
  return {
    trips: trips.length,
    items: sum((d) => d.items),
    bookings: sum((d) => d.bookings),
    bucketItems: sum((d) => d.bucketItems),
    expenses: sum((d) => d.expenses),
    documents: (await source.listDocuments()).length,
  };
}

describe('sampleId', () => {
  it('is a stable UUID per user and fixture row', () => {
    expect(sampleId(USER, 'trip-vegas')).toMatch(UUID);
    expect(sampleId(USER, 'trip-vegas')).toBe(sampleId(USER, 'trip-vegas'));
    expect(sampleId(USER, 'trip-vegas')).not.toBe(sampleId(USER, 'trip-tokyo'));
    expect(sampleId(USER, 'trip-vegas')).not.toBe(sampleId('someone-else', 'trip-vegas'));
  });

  it('gives every fixture row its own id', () => {
    const data = sampleSnapshot(USER);
    const ids = [
      ...data.trips,
      ...data.places,
      ...data.items,
      ...data.bookings,
      ...data.bucketItems,
      ...data.expenses,
      ...data.documents,
    ].map((r) => r.id);
    expect(ids.every((id) => UUID.test(id))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('points references at the new ids, also inside bookings', () => {
    const data = sampleSnapshot(USER);
    const vegas = sampleVegasTripId(USER);
    expect(data.items.filter((i) => i.tripId === vegas)).toHaveLength(
      vegasSnapshot.items.filter((i) => i.tripId === 'trip-vegas').length,
    );
    const placeIds = new Set(data.places.map((p) => p.id));
    for (const item of data.items) if (item.placeId) expect(placeIds.has(item.placeId)).toBe(true);
    expect(JSON.stringify(data)).not.toMatch(/"(trip|place|item|booking)-[a-z0-9-]+"/);
  });
});

describe('adding and removing the sample account', () => {
  it('adds the whole sample account, and adding again changes nothing', async () => {
    const source = createDemoSource(EMPTY);
    expect(await hasSampleData(source, USER)).toBe(false);

    await addSampleData(source, USER);
    const once = await counts(source);
    expect(once).toEqual({
      trips: vegasSnapshot.trips.length,
      items: vegasSnapshot.items.length,
      bookings: vegasSnapshot.bookings.length,
      bucketItems: vegasSnapshot.bucketItems.length,
      expenses: vegasSnapshot.expenses.length,
      documents: vegasSnapshot.documents.length,
    });
    expect(await hasSampleData(source, USER)).toBe(true);
    const vegas = await source.getTripData(sampleVegasTripId(USER));
    expect(vegas?.trip.city).toBe('Las Vegas');

    await addSampleData(source, USER);
    expect(await counts(source)).toEqual(once);
  });

  it('removes only the sample rows', async () => {
    const source = createDemoSource(EMPTY);
    const mine = await source.createTrip({
      city: 'Lisbon',
      country: 'Portugal',
      lat: 38.72,
      lng: -9.14,
      timezone: 'Europe/Lisbon',
      startDate: '2027-03-01',
      endDate: '2027-03-05',
      coverPhotoUrl: null,
    });
    await addSampleData(source, USER);
    await removeSampleData(source, USER);

    expect((await source.listTrips()).map((t) => t.id)).toEqual([mine.id]);
    expect(await source.listDocuments()).toEqual([]);
    expect(await hasSampleData(source, USER)).toBe(false);
  });
});
