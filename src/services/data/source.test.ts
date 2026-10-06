import { vegasSnapshot } from '@/scenarios/fixtures/vegas';

import { createDemoSource } from './source';

describe('demo source', () => {
  it('lists trips by start date', async () => {
    const source = createDemoSource(vegasSnapshot);
    expect((await source.listTrips()).map((t) => t.city)).toEqual([
      'New York',
      'Las Vegas',
      'Cape Town',
      'Tokyo',
    ]);
  });

  it('loads a trip with its items in time order and only the places it uses', async () => {
    const data = await createDemoSource(vegasSnapshot).getTripData('trip-vegas');
    expect(data?.items[0]).toMatchObject({ day: '2026-11-12', startTime: '11:02' });
    expect(data?.items.at(-1)).toMatchObject({ day: '2026-11-16', startTime: '13:45' });
    expect(data?.places.map((p) => p.id)).toContain('place-tpa'); // via the flight booking
    expect(data?.bookings).toHaveLength(5);
    expect(data?.bucketItems).toHaveLength(5);
    expect(await createDemoSource(vegasSnapshot).getTripData('trip-tokyo')).toMatchObject({
      items: [],
      places: [],
    });
    expect(await createDemoSource(vegasSnapshot).getTripData('nope')).toBeNull();
  });

  it('writes in memory without touching the fixtures or other sessions', async () => {
    const a = createDemoSource(vegasSnapshot);
    const b = createDemoSource(vegasSnapshot);
    const [first] = (await a.getTripData('trip-vegas'))!.items;
    await a.saveItineraryItem({ ...first, startTime: '12:00' });
    await a.deleteBucketItem('bucket-pinball');
    await a.saveExpense({ ...vegasSnapshot.expenses[0], id: 'expense-new', amountMinor: 999 });

    const changed = (await a.getTripData('trip-vegas'))!;
    expect(changed.items.find((i) => i.id === first.id)?.startTime).toBe('12:00');
    expect(changed.bucketItems).toHaveLength(4);
    expect(changed.expenses).toHaveLength(vegasSnapshot.expenses.length + 1);

    const untouched = (await b.getTripData('trip-vegas'))!;
    expect(untouched.items.find((i) => i.id === first.id)?.startTime).toBe('11:02');
    expect(vegasSnapshot.items[0].startTime).toBe('11:02');
    expect(a.id).not.toBe(b.id);
  });

  it('saves a booking in memory and refuses an unknown one', async () => {
    const source = createDemoSource(vegasSnapshot);
    const flight = (await source.getTripData('trip-vegas'))!.bookings.find(
      (b) => b.id === 'booking-flight-out',
    )!;
    if (flight.type !== 'flight') throw new Error('expected a flight');
    const passCrop = { x: 0.2, y: 0.5, width: 0.6, height: 0.3 };
    await source.saveBooking({ ...flight, data: { ...flight.data, passCrop } });
    const saved = (await source.getTripData('trip-vegas'))!.bookings.find(
      (b) => b.id === flight.id,
    );
    expect(saved?.data).toMatchObject({ gate: 'E75', passCrop });
    await expect(source.saveBooking({ ...flight, id: 'nope' })).rejects.toThrow('not found');
  });

  it('returns copies, so callers cannot change stored data', async () => {
    const source = createDemoSource(vegasSnapshot);
    (await source.listTrips())[0].city = 'Changed';
    expect((await source.listTrips())[0].city).toBe('New York');
  });

  it('creates trips in memory with a new id', async () => {
    const source = createDemoSource(vegasSnapshot);
    const trip = await source.createTrip({
      city: 'Lisbon',
      country: 'Portugal',
      lat: 38.7,
      lng: -9.1,
      timezone: 'Europe/Lisbon',
      startDate: '2027-04-03',
      endDate: '2027-04-08',
      coverPhotoUrl: null,
      coverPhotoCredit: null,
    });
    expect(trip.id).toMatch(/^trip-/);
    expect((await source.listTrips()).map((t) => t.city)).toEqual([
      'New York',
      'Las Vegas',
      'Cape Town',
      'Tokyo',
      'Lisbon',
    ]);
    expect(vegasSnapshot.trips).toHaveLength(4);
  });
});
