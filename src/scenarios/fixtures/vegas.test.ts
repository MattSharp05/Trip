import { bookingPlaceIds } from '@/services/data/source';
import type { ItineraryItem } from '@/services/data/types';

import { vegasSnapshot as db, VEGAS_TRIP_ID } from './vegas';

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const placeIds = new Set(db.places.map((p) => p.id));
const tripFor = (id: string) => db.trips.find((t) => t.id === id);
const vegas = tripFor(VEGAS_TRIP_ID)!;

describe('Vegas fixtures', () => {
  it('has unique ids in every collection', () => {
    const { me: _me, members, ...tables } = db;
    for (const rows of Object.values(tables) as { id: string }[][]) {
      expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
    }
    expect(new Set(members.map((m) => `${m.tripId}/${m.userId}`)).size).toBe(members.length);
  });

  it('makes Matthew ("you") the owner of every trip', () => {
    expect(db.profiles.find((p) => p.id === db.me)?.displayName).toBe('Matthew');
    expect(db.members).toEqual(
      db.trips.map((t) => ({ tripId: t.id, userId: db.me, role: 'owner' })),
    );
  });

  it('has the four trips from the mockup, in date order', () => {
    expect(db.trips.map((t) => [t.city, t.startDate, t.endDate])).toEqual([
      ['New York', '2026-10-16', '2026-10-20'],
      ['Las Vegas', '2026-11-12', '2026-11-16'],
      ['Cape Town', '2026-12-18', '2027-01-06'],
      ['Tokyo', '2027-03-20', '2027-03-29'],
    ]);
  });

  it('points every item, bucket item and booking at a place that exists', () => {
    for (const item of db.items) expect(placeIds).toContain(item.placeId);
    for (const b of db.bucketItems) expect(placeIds).toContain(b.placeId);
    for (const b of db.bookings)
      for (const id of bookingPlaceIds(b)) expect(placeIds).toContain(id);
  });

  it('points every booking reference at a booking of the same trip', () => {
    const bookings = new Map(db.bookings.map((b) => [b.id, b]));
    for (const row of [...db.items, ...db.expenses]) {
      if (row.bookingId) expect(bookings.get(row.bookingId)?.tripId).toBe(row.tripId);
    }
  });

  it('keeps every dated row inside its trip', () => {
    const inTrip = (tripId: string, day: string) => {
      const trip = tripFor(tripId);
      expect(trip).toBeDefined();
      expect(day >= trip!.startDate && day <= trip!.endDate).toBe(true);
    };
    for (const item of db.items) inTrip(item.tripId, item.day);
    for (const b of db.bucketItems) if (b.fixedDate) inTrip(b.tripId, b.fixedDate);
    for (const b of db.bookings) {
      const d = b.data;
      const dates =
        'departs' in d
          ? [d.departs.date, d.arrives.date]
          : 'checkIn' in d
            ? [d.checkIn.date, d.checkOut.date]
            : 'pickup' in d
              ? [d.pickup.date, d.dropoff.date]
              : [d.starts.date];
      for (const day of dates) inTrip(b.tripId, day);
    }
  });

  it('has no overlapping fixed items on any day', () => {
    const fixed = db.items.filter((i) => i.fixed && i.startTime);
    const byDay = new Map<string, ItineraryItem[]>();
    for (const i of fixed) byDay.set(i.day, [...(byDay.get(i.day) ?? []), i]);
    for (const dayItems of byDay.values()) {
      const sorted = dayItems.sort((a, b) => a.startTime!.localeCompare(b.startTime!));
      for (let k = 1; k < sorted.length; k++) {
        const prev = sorted[k - 1];
        expect(minutes(prev.startTime!) + (prev.durationMinutes ?? 0)).toBeLessThanOrEqual(
          minutes(sorted[k].startTime!),
        );
      }
    }
  });

  it('plans every Vegas day with located places, some with photos and some without', () => {
    const days = new Set(db.items.filter((i) => i.tripId === VEGAS_TRIP_ID).map((i) => i.day));
    expect([...days].sort()).toEqual([
      '2026-11-12',
      '2026-11-13',
      '2026-11-14',
      '2026-11-15',
      '2026-11-16',
    ]);
    for (const p of db.places) {
      expect(p.lat).toEqual(expect.any(Number));
      expect(p.lng).toEqual(expect.any(Number));
    }
    expect(db.places.some((p) => p.photoUrl)).toBe(true);
    expect(db.places.some((p) => !p.photoUrl)).toBe(true);
  });

  it('has the booking details later tickets show', () => {
    const out = db.bookings.find((b) => b.id === 'booking-flight-out');
    expect(out?.type === 'flight' && out.data).toMatchObject({
      flightNumber: 'AA 2410',
      departs: { date: '2026-11-12', time: '09:05' },
      arrives: { time: '11:02', timezone: 'America/Los_Angeles' },
      gate: 'E75',
      seat: '14A',
      confirmation: expect.any(String),
    });
    const home = db.bookings.find((b) => b.id === 'booking-flight-home');
    expect(home?.type === 'flight' && home.data.departs).toMatchObject({
      date: '2026-11-16',
      time: '13:45',
    });
    const hotel = db.bookings.find((b) => b.type === 'hotel');
    expect(hotel?.type === 'hotel' && hotel.data).toMatchObject({
      confirmation: '837282',
      checkIn: { time: '15:00' },
      checkOut: { time: '11:00' },
      address: expect.any(String),
      phone: expect.any(String),
      website: expect.any(String),
    });
    expect(db.bookings.map((b) => b.type).sort()).toEqual([
      'car',
      'flight',
      'flight',
      'hotel',
      'ticket',
    ]);
    expect(db.documents).toEqual([expect.objectContaining({ type: 'passport' })]);
  });

  it('has a budget and expenses in USD and EUR', () => {
    expect(vegas.budget).toEqual({ amountMinor: 250000, currency: 'USD' });
    expect(new Set(db.expenses.map((e) => e.currency))).toEqual(new Set(['USD', 'EUR']));
    for (const e of db.expenses) expect(Number.isInteger(e.amountMinor)).toBe(true);
  });
});
