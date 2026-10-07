import { SAMPLE_PARSES } from '../../supabase/functions/_shared/parse/fixtures';
import type { ParsedBooking } from '../../supabase/functions/_shared/parse/schema';
import { trips } from '../scenarios/fixtures/vegas';
import type { Trip } from '../services/data/types';
import {
  bookingSpan,
  destinationLeg,
  firstPlannedDay,
  matchTrip,
  mealAt,
  planImport,
  proposedTrip,
} from './bookingMapping';

const capeTown = trips.find((t) => t.id === 'trip-cape-town') as Trip;
const vegas = trips.find((t) => t.id === 'trip-vegas') as Trip;

const ids = () => {
  let n = 0;
  return () => `id-${++n}`;
};
const OPTIONS = { originalPath: 'u1/imports/x.pdf', importedAt: '2026-11-13T17:00:00.000Z' };
const plan = (booking: ParsedBooking, trip: Trip = capeTown) =>
  planImport(booking, trip, { ...OPTIONS, newId: ids() });

describe('bookingSpan and trip matching', () => {
  it('finds where a round-trip flight goes and for how long', () => {
    const { booking } = SAMPLE_PARSES.flight;
    if (booking.type !== 'flight') throw new Error('flight sample');
    expect(destinationLeg(booking.legs).flightNumber).toBe('DL 9201');
    expect(bookingSpan(booking)).toMatchObject({
      city: 'Cape Town',
      startDate: '2026-12-18',
      endDate: '2027-01-06',
    });
  });

  it('matches each Cape Town sample to the Cape Town trip', () => {
    for (const name of ['flight', 'hotel', 'car', 'restaurant'] as const) {
      expect(matchTrip(bookingSpan(SAMPLE_PARSES[name].booking), trips)?.id).toBe('trip-cape-town');
    }
  });

  it('matches by distance when the city is spelled differently', () => {
    const s = { ...bookingSpan(SAMPLE_PARSES.hotel.booking), city: 'Kaapstad' };
    expect(matchTrip(s, trips)?.id).toBe('trip-cape-town');
  });

  it('finds no trip for other dates or places, and proposes one', () => {
    const lisbon = bookingSpan(SAMPLE_PARSES['lisbon-hotel'].booking);
    expect(matchTrip(lisbon, trips)).toBeNull();
    expect(proposedTrip(lisbon)).toEqual({
      city: 'Lisbon',
      country: 'Portugal',
      lat: 38.7106,
      lng: -9.1301,
      timezone: 'Europe/Lisbon',
      startDate: '2027-02-12',
      endDate: '2027-02-16',
      coverPhotoUrl: null,
      coverPhotoCredit: null,
    });
    const lateHotel = {
      ...bookingSpan(SAMPLE_PARSES.hotel.booking),
      startDate: '2027-03-01',
      endDate: '2027-03-05',
    };
    expect(matchTrip(lateHotel, trips)).toBeNull();
  });

  it('cannot propose a trip without a place', () => {
    expect(
      proposedTrip({
        city: null,
        country: null,
        lat: null,
        lng: null,
        startDate: '2027-01-01',
        endDate: '2027-01-02',
      }),
    ).toBeNull();
  });
});

describe('planImport', () => {
  it('turns a round-trip flight into two bookings, airport pins, Cape Town items and one expense', () => {
    const p = plan(SAMPLE_PARSES.flight.booking);
    expect(p.places.map((x) => [x.name, x.kind])).toEqual([
      ['Tampa (TPA)', 'airport'],
      ['Cape Town (CPT)', 'airport'],
    ]);
    expect(p.bookings.map((b) => b.type)).toEqual(['flight', 'flight']);
    const [out, back] = p.bookings;
    if (out.type !== 'flight' || back.type !== 'flight') throw new Error('flights');
    expect(out.data.departs).toEqual({
      date: '2026-12-18',
      time: '17:40',
      timezone: 'America/New_York',
    });
    expect(out.data.arrives).toEqual({
      date: '2026-12-19',
      time: '16:55',
      timezone: 'Africa/Johannesburg',
    });
    expect(out.data.to.placeId).toBe(back.data.from.placeId);
    expect(out.originalPath).toBe('u1/imports/x.pdf');
    // Only the Cape Town end of each leg goes on the plan.
    expect(p.items.map((i) => [i.day, i.startTime, i.title, i.kind, i.fixed])).toEqual([
      ['2026-12-19', '16:55', 'Arrive in Cape Town', 'flight', true],
      ['2027-01-06', '19:30', 'Fly home to Tampa', 'flight', true],
    ]);
    expect(p.expenses).toEqual([
      {
        id: expect.any(String),
        tripId: 'trip-cape-town',
        amountMinor: 148640,
        currency: 'USD',
        category: 'Flights',
        bookingId: out.id,
        paidAt: OPTIONS.importedAt,
        description: 'DL 9201 and DL 9202',
      },
    ]);
    expect(firstPlannedDay(p)).toBe('2026-12-19');
  });

  it('turns a hotel into check-in and check-out and a Hotels expense in rand', () => {
    const p = plan(SAMPLE_PARSES.hotel.booking);
    expect(p.places).toEqual([
      expect.objectContaining({ name: 'The Silo Hotel', kind: 'hotel', lat: -33.9083 }),
    ]);
    expect(p.bookings[0]).toMatchObject({
      type: 'hotel',
      data: {
        name: 'The Silo Hotel',
        confirmation: 'TST-HTL-1001',
        checkIn: { time: '14:00', timezone: 'Africa/Johannesburg' },
      },
    });
    expect(p.items.map((i) => i.title)).toEqual([
      'Check in at The Silo Hotel',
      'Check out of The Silo Hotel',
    ]);
    expect(p.expenses[0]).toMatchObject({
      amountMinor: 6300000,
      currency: 'ZAR',
      category: 'Hotels',
    });
  });

  it('returns the car where it was picked up when there is no return location', () => {
    const p = plan(SAMPLE_PARSES.car.booking);
    expect(p.places).toHaveLength(1);
    expect(p.bookings[0]).toMatchObject({
      type: 'car',
      data: { pickupPlaceId: 'id-2', returnPlaceId: 'id-2' },
    });
    expect(p.items.map((i) => [i.day, i.title])).toEqual([
      ['2026-12-19', 'Pick up rental car'],
      ['2027-01-06', 'Return rental car'],
    ]);
    expect(p.expenses[0].category).toBe('Transport');
  });

  it('saves a restaurant reservation as a ticket, a food pin and a dinner, without an expense', () => {
    const p = plan(SAMPLE_PARSES.restaurant.booking);
    expect(p.bookings[0]).toMatchObject({
      type: 'ticket',
      data: { event: 'La Colombe', seats: 'Table for 2', confirmation: 'TST-RES-3003' },
    });
    expect(p.places[0].kind).toBe('food');
    expect(p.items).toEqual([
      expect.objectContaining({ title: 'Dinner at La Colombe', kind: 'food', durationMinutes: 90 }),
    ]);
    expect(p.expenses).toEqual([]);
  });

  it('fills missing times with defaults and leaves days outside the trip off the plan', () => {
    const p = plan(
      {
        type: 'ticket',
        event: 'Sample Show',
        venue: {
          name: 'Sample Hall',
          address: null,
          city: 'Las Vegas',
          country: null,
          lat: null,
          lng: null,
        },
        starts: { date: '2026-11-20', time: null },
        section: null,
        row: null,
        seats: null,
        confirmation: null,
        price: { amount: 8400, currency: 'JPY' },
      },
      vegas,
    );
    expect(p.bookings[0]).toMatchObject({
      data: {
        starts: { date: '2026-11-20', time: '12:00', timezone: 'America/Los_Angeles' },
        confirmation: '',
      },
    });
    expect(p.items).toEqual([]);
    expect(firstPlannedDay(p)).toBeNull();
    expect(p.expenses[0]).toMatchObject({ amountMinor: 8400, category: 'Activities' });
  });

  it('names meals by time', () => {
    expect([mealAt('08:30'), mealAt('12:15'), mealAt('19:30')]).toEqual([
      'Breakfast',
      'Lunch',
      'Dinner',
    ]);
  });
});
