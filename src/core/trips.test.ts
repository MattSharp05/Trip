import { addDaysTo, defaultTrip, filterTrips, formatTripDates, isPast, todayIn } from './trips';

const trip = (
  id: string,
  startDate: string,
  endDate: string,
  timezone = 'America/Los_Angeles',
) => ({
  id,
  startDate,
  endDate,
  timezone,
});

// Fri, Nov 13 2026, 9:00 AM in Las Vegas (the scenarios' default "today").
const AT = new Date('2026-11-13T09:00:00-08:00');

const trips = [
  trip('tokyo', '2027-03-20', '2027-03-29', 'Asia/Tokyo'),
  trip('new-york', '2026-10-16', '2026-10-20', 'America/New_York'),
  trip('vegas', '2026-11-12', '2026-11-16'),
  trip('lisbon-2025', '2025-04-03', '2025-04-08', 'Europe/Lisbon'),
  trip('cape-town', '2026-12-18', '2027-01-06', 'Africa/Johannesburg'),
];
const ids = (list: { id: string }[]) => list.map((t) => t.id);

describe('trip filters', () => {
  it('Upcoming: not over yet (the current trip included), soonest first', () => {
    expect(ids(filterTrips(trips, 'upcoming', AT))).toEqual(['vegas', 'cape-town', 'tokyo']);
  });

  it('Past: ended before today, most recent first', () => {
    expect(ids(filterTrips(trips, 'past', AT))).toEqual(['new-york', 'lisbon-2025']);
  });

  it('All: every trip by start date, without changing the input', () => {
    const input = [...trips];
    expect(ids(filterTrips(input, 'all', AT))).toEqual([
      'lisbon-2025',
      'new-york',
      'vegas',
      'cape-town',
      'tokyo',
    ]);
    expect(input).toEqual(trips);
  });

  it('a trip is still upcoming on its last day and past the day after', () => {
    const vegas = trip('vegas', '2026-11-12', '2026-11-16');
    expect(isPast(vegas, new Date('2026-11-16T23:59:00-08:00'))).toBe(false);
    expect(isPast(vegas, new Date('2026-11-17T00:01:00-08:00'))).toBe(true);
  });

  it("uses the trip's own calendar, not the phone's", () => {
    // 10:00 PM Nov 20 in Las Vegas is already noon Nov 21 in Tokyo.
    const at = new Date('2026-11-20T22:00:00-08:00');
    expect(isPast(trip('tokyo', '2026-11-15', '2026-11-20', 'Asia/Tokyo'), at)).toBe(true);
    expect(isPast(trip('vegas', '2026-11-15', '2026-11-20'), at)).toBe(false);
  });

  it('reads today in a timezone, falling back to UTC for an unknown zone', () => {
    expect(todayIn('Asia/Tokyo', AT)).toBe('2026-11-14');
    expect(todayIn('America/Los_Angeles', AT)).toBe('2026-11-13');
    expect(todayIn('Not/AZone', AT)).toBe('2026-11-13');
  });
});

describe('defaultTrip', () => {
  it('picks the current or next trip, else the latest past one, else none', () => {
    expect(defaultTrip(trips, AT)?.id).toBe('vegas');
    expect(defaultTrip(filterTrips(trips, 'past', AT), AT)?.id).toBe('new-york');
    expect(defaultTrip([], AT)).toBeNull();
  });
});

describe('trip dates', () => {
  it('formats a range like the mockup', () => {
    expect(formatTripDates('2026-11-12', '2026-11-16')).toBe('Nov 12 – Nov 16, 2026');
    expect(formatTripDates('2026-12-18', '2027-01-06')).toBe('Dec 18 – Jan 6, 2027');
  });

  it('adds days across months and years', () => {
    expect(addDaysTo('2026-12-30', 4)).toBe('2027-01-03');
  });
});
