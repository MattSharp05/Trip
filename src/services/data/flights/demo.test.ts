import { ALEX, BLAKE, groupArrivalsSnapshot, WILLEM } from '@/scenarios/fixtures/group';
import { ME } from '@/scenarios/fixtures/vegas';

import { createDemoSource } from '../source';

const VEGAS = 'trip-vegas';

describe('demo trip flights', () => {
  it('lists every member’s legs by departure, private ones included', async () => {
    const flights = await createDemoSource(groupArrivalsSnapshot).listTripFlights(VEGAS);
    expect(flights.map((f) => [f.travelerId, f.flightNumber])).toEqual([
      [ME, 'AA 2410'],
      [WILLEM, 'B6 1123'],
      [BLAKE, 'UA 1187'],
      [ME, 'AA 2411'],
      [BLAKE, 'UA 2290'],
      [WILLEM, 'B6 1124'],
    ]);
  });

  it('gives route and times only, never the seat, confirmation or passenger', async () => {
    const [, willem] = await createDemoSource(groupArrivalsSnapshot).listTripFlights(VEGAS);
    expect(willem).toEqual({
      bookingId: 'booking-willem-out',
      travelerId: WILLEM,
      airline: 'JetBlue',
      flightNumber: 'B6 1123',
      from: { code: 'JFK', city: 'New York', placeId: null },
      to: { code: 'LAS', city: 'Las Vegas', placeId: 'place-las' },
      departs: { date: '2026-11-12', time: '11:40', timezone: 'America/New_York' },
      arrives: { date: '2026-11-12', time: '14:45', timezone: 'America/Los_Angeles' },
    });
  });

  it('keeps the bookings themselves private, as RLS does', async () => {
    const asBlake = createDemoSource({ ...groupArrivalsSnapshot, me: BLAKE });
    const ids = (await asBlake.getTripData(VEGAS))!.bookings.map((b) => b.id);
    expect(ids).toContain('booking-blake-out');
    expect(ids).not.toContain('booking-willem-out');
    expect(await asBlake.listTripFlights(VEGAS)).toHaveLength(6);
  });

  it('drops the legs of someone who left, even a shared booking', async () => {
    const source = createDemoSource({
      ...groupArrivalsSnapshot,
      members: groupArrivalsSnapshot.members.filter((m) => m.userId !== BLAKE),
      bookings: groupArrivalsSnapshot.bookings.map((b) =>
        b.addedBy === BLAKE ? { ...b, visibility: 'shared' as const } : b,
      ),
    });
    const travelers = (await source.listTripFlights(VEGAS)).map((f) => f.travelerId);
    expect(travelers).not.toContain(BLAKE);
    expect(travelers).toContain(WILLEM);
  });

  it('shows nothing to someone not on the trip', async () => {
    const asAlex = createDemoSource({ ...groupArrivalsSnapshot, me: ALEX });
    expect(await asAlex.listTripFlights(VEGAS)).toEqual([]);
  });
});
