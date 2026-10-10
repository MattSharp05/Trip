import { vegasSnapshot } from '@/scenarios/fixtures/vegas';

import { createDemoSource } from '../source';

describe('demo bookings', () => {
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

  it('adds and deletes imported bookings and their places', async () => {
    const source = createDemoSource(vegasSnapshot);
    await source.savePlace({
      id: 'place-new',
      name: 'Sample Hall',
      address: null,
      lat: 36.1,
      lng: -115.1,
      kind: 'arena',
      photoUrl: null,
      sourceUrl: null,
    });
    const booking = {
      id: 'booking-new',
      tripId: 'trip-vegas',
      originalPath: null,
      type: 'ticket' as const,
      data: {
        event: 'Sample Show',
        placeId: 'place-new',
        starts: { date: '2026-11-14', time: '20:00', timezone: 'America/Los_Angeles' },
        section: null,
        row: null,
        seats: null,
        confirmation: 'T1',
      },
    };
    await source.createBooking(booking);
    await expect(source.createBooking(booking)).rejects.toThrow('exists');
    const data = (await source.getTripData('trip-vegas'))!;
    expect(data.bookings.map((b) => b.id)).toContain('booking-new');
    expect(data.places.map((p) => p.id)).toContain('place-new');
    await source.deleteBooking('booking-new');
    expect((await source.getTripData('trip-vegas'))!.bookings.map((b) => b.id)).not.toContain(
      'booking-new',
    );
  });
});
