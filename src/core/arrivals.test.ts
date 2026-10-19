import type { TripFlight } from '@/services/data/types';

import { atDestination, dayMoves, hintLine, moveLabel, tripMoves } from './arrivals';

const LA = 'America/Los_Angeles';
const NY = 'America/New_York';
const CHI = 'America/Chicago';
const vegas = { city: 'Las Vegas', lat: 36.1147, lng: -115.1728 };
const places = [
  { id: 'place-las', lat: 36.084, lng: -115.1537 },
  { id: 'place-hnd', lat: 35.5494, lng: 139.7798 },
];
const airports = {
  LAS: { code: 'LAS', city: 'Las Vegas', placeId: 'place-las' },
  TPA: { code: 'TPA', city: 'Tampa', placeId: null },
  ORD: { code: 'ORD', city: 'Chicago', placeId: null },
  JFK: { code: 'JFK', city: 'New York', placeId: null },
};

let n = 0;
function leg(
  travelerId: string,
  from: keyof typeof airports,
  to: keyof typeof airports,
  departs: [string, string, string],
  arrives: [string, string, string],
): TripFlight {
  n += 1;
  return {
    bookingId: `b${n}`,
    travelerId,
    airline: 'Test Air',
    flightNumber: `TA ${n}`,
    from: airports[from],
    to: airports[to],
    departs: { date: departs[0], time: departs[1], timezone: departs[2] },
    arrives: { date: arrives[0], time: arrives[1], timezone: arrives[2] },
  };
}

const names: Record<string, string> = { me: 'Matthew', blake: 'Blake', willem: 'Willem' };
const nameOf = (id: string) => names[id] ?? id;

const group = [
  leg('willem', 'JFK', 'LAS', ['2026-11-12', '11:40', NY], ['2026-11-12', '14:45', LA]),
  leg('me', 'TPA', 'LAS', ['2026-11-12', '09:05', NY], ['2026-11-12', '11:02', LA]),
  leg('blake', 'ORD', 'LAS', ['2026-11-12', '11:50', CHI], ['2026-11-12', '14:10', LA]),
  leg('me', 'LAS', 'TPA', ['2026-11-16', '13:45', LA], ['2026-11-16', '21:12', NY]),
  leg('blake', 'LAS', 'ORD', ['2026-11-16', '16:05', LA], ['2026-11-16', '21:55', CHI]),
  leg('willem', 'LAS', 'JFK', ['2026-11-16', '16:30', LA], ['2026-11-17', '00:58', NY]),
];

describe('atDestination', () => {
  it('matches the trip city by name, or a mapped airport within 80 km', () => {
    expect(atDestination(airports.LAS, vegas, [])).toBe(true);
    expect(atDestination({ ...airports.LAS, city: ' las vegas ' }, vegas, [])).toBe(true);
    expect(
      atDestination({ code: 'LAS', city: 'Paradise', placeId: 'place-las' }, vegas, places),
    ).toBe(true);
    expect(atDestination({ code: 'HND', city: 'Tokyo', placeId: 'place-hnd' }, vegas, places)).toBe(
      false,
    );
    expect(atDestination(airports.TPA, vegas, places)).toBe(false);
  });
});

describe('tripMoves', () => {
  it('groups arrivals into the city by airport and day, sorted by landing time', () => {
    const { arrivals } = tripMoves(group, vegas, places);
    expect(arrivals).toHaveLength(1);
    expect(arrivals[0]).toMatchObject({ direction: 'arrival', day: '2026-11-12', airport: 'LAS' });
    expect(arrivals[0].moves.map((m) => [m.travelerId, m.time])).toEqual([
      ['me', '11:02'],
      ['blake', '14:10'],
      ['willem', '14:45'],
    ]);
    // Legs home land elsewhere: not arrivals.
    expect(arrivals.flatMap((g) => g.moves).every((m) => m.airport === 'LAS')).toBe(true);
  });

  it('groups departures from the city the same way, on their local day', () => {
    const { departures } = tripMoves(group, vegas, places);
    expect(departures.map((g) => [g.day, g.airport])).toEqual([['2026-11-16', 'LAS']]);
    expect(departures[0].moves.map((m) => [m.travelerId, m.time])).toEqual([
      ['me', '13:45'],
      ['blake', '16:05'],
      ['willem', '16:30'],
    ]);
  });

  it('sorts by the moment, not the wall clock, across timezones', () => {
    // Same day, two cities: 10:00 in New York is before 08:00 in Los Angeles.
    const trip = { city: 'Anywhere', lat: null, lng: null };
    const flights = [
      leg('a', 'TPA', 'LAS', ['2026-11-12', '05:00', NY], ['2026-11-12', '08:00', LA]),
      leg('b', 'TPA', 'JFK', ['2026-11-12', '07:00', NY], ['2026-11-12', '10:00', NY]),
    ].map((f) => ({ ...f, to: { ...f.to, city: 'Anywhere' } }));
    const { arrivals } = tripMoves(flights, trip, []);
    expect(arrivals.map((g) => [g.airport, g.moves[0].time])).toEqual([
      ['JFK', '10:00'],
      ['LAS', '08:00'],
    ]);
    // Within an airport too: 14:10 Pacific lands after 16:00 Central.
    const sameAirport = tripMoves(
      [
        leg('late', 'ORD', 'LAS', ['2026-11-12', '11:50', CHI], ['2026-11-12', '14:10', LA]),
        leg('early', 'ORD', 'LAS', ['2026-11-12', '13:00', CHI], ['2026-11-12', '16:00', CHI]),
      ],
      vegas,
      [],
    );
    expect(sameAirport.arrivals[0].moves.map((m) => m.travelerId)).toEqual(['early', 'late']);
  });

  it('keeps a red-eye on the day it lands', () => {
    const redEye = leg(
      'blake',
      'JFK',
      'LAS',
      ['2026-11-12', '22:30', NY],
      ['2026-11-13', '00:45', LA],
    );
    const { arrivals } = tripMoves([redEye], vegas, []);
    expect(arrivals.map((g) => g.day)).toEqual(['2026-11-13']);
  });

  it('leaves out a leg whose time or timezone does not parse', () => {
    const good = leg(
      'blake',
      'ORD',
      'LAS',
      ['2026-11-12', '11:50', CHI],
      ['2026-11-12', '14:10', LA],
    );
    const badTime = {
      ...good,
      bookingId: 'bad-time',
      arrives: { ...good.arrives, time: '2:10 PM' },
    };
    const badZone = {
      ...good,
      bookingId: 'bad-zone',
      arrives: { ...good.arrives, timezone: 'Mars/Base' },
    };
    const { arrivals } = tripMoves([good, badTime, badZone], vegas, []);
    expect(arrivals[0].moves.map((m) => m.bookingId)).toEqual([good.bookingId]);
  });

  it('returns nothing for no flights', () => {
    expect(tripMoves([], vegas, [])).toEqual({ arrivals: [], departures: [] });
  });
});

describe('pickup hints', () => {
  it('flags travellers landing within 60 minutes of each other at the same airport', () => {
    const { arrivals } = tripMoves(group, vegas, places);
    expect(arrivals[0].hints).toEqual([{ travelerIds: ['blake', 'willem'], minutes: 35 }]);
    expect(hintLine(arrivals[0], arrivals[0].hints[0], nameOf)).toBe(
      'Blake and Willem land 35 min apart at LAS',
    );
  });

  it('counts exactly 60 minutes, not 61', () => {
    const at = (id: string, time: string) =>
      leg(id, 'ORD', 'LAS', ['2026-11-12', '09:00', CHI], ['2026-11-12', time, LA]);
    expect(tripMoves([at('a', '12:00'), at('b', '13:00')], vegas, []).arrivals[0].hints).toEqual([
      { travelerIds: ['a', 'b'], minutes: 60 },
    ]);
    expect(tripMoves([at('a', '12:00'), at('b', '13:01')], vegas, []).arrivals[0].hints).toEqual(
      [],
    );
  });

  it('chains three travellers, and words a tie', () => {
    const at = (id: string, time: string) =>
      leg(id, 'ORD', 'LAS', ['2026-11-12', '09:00', CHI], ['2026-11-12', time, LA]);
    const three = tripMoves(
      [at('me', '13:25'), at('blake', '14:10'), at('willem', '14:15')],
      vegas,
      [],
    ).arrivals[0];
    expect(three.hints).toEqual([{ travelerIds: ['me', 'blake', 'willem'], minutes: 50 }]);
    expect(hintLine(three, three.hints[0], nameOf)).toBe(
      'Matthew, Blake and Willem land within 50 min at LAS',
    );
    const tie = tripMoves([at('blake', '14:10'), at('willem', '14:10')], vegas, []).arrivals[0];
    expect(hintLine(tie, tie.hints[0], nameOf)).toBe(
      'Blake and Willem land at the same time at LAS',
    );
  });

  it('keeps a hint within the hour of its first traveller', () => {
    const at = (id: string, time: string) =>
      leg(id, 'ORD', 'LAS', ['2026-11-12', '09:00', CHI], ['2026-11-12', time, LA]);
    const { hints } = tripMoves(
      [at('a', '13:00'), at('b', '13:55'), at('c', '14:50'), at('d', '15:05')],
      vegas,
      [],
    ).arrivals[0];
    expect(hints).toEqual([
      { travelerIds: ['a', 'b'], minutes: 55 },
      { travelerIds: ['c', 'd'], minutes: 15 },
    ]);
  });

  it('never pairs a traveller with themselves, or different airports or days', () => {
    const twice = [
      leg('blake', 'ORD', 'LAS', ['2026-11-12', '09:00', CHI], ['2026-11-12', '12:00', LA]),
      leg('blake', 'ORD', 'LAS', ['2026-11-12', '09:10', CHI], ['2026-11-12', '12:20', LA]),
      leg('willem', 'JFK', 'LAS', ['2026-11-12', '22:30', NY], ['2026-11-13', '00:10', LA]),
    ];
    const { arrivals } = tripMoves(twice, vegas, []);
    expect(arrivals.map((g) => g.hints)).toEqual([[], []]);
  });

  it('words departures as leaving from the airport', () => {
    const { departures } = tripMoves(group, vegas, places);
    expect(departures[0].hints).toEqual([{ travelerIds: ['blake', 'willem'], minutes: 25 }]);
    expect(hintLine(departures[0], departures[0].hints[0], nameOf)).toBe(
      'Blake and Willem leave 25 min apart from LAS',
    );
  });
});

describe('labels and days', () => {
  it('labels a landing and a take-off', () => {
    const { arrivals, departures } = tripMoves(group, vegas, places);
    expect(moveLabel('arrival', arrivals[0].moves[1])).toBe('lands 2:10 PM LAS');
    expect(moveLabel('departure', departures[0].moves[0])).toBe('leaves 1:45 PM LAS');
  });

  it('picks one day', () => {
    const moves = tripMoves(group, vegas, places);
    expect(dayMoves(moves, '2026-11-12').departures).toEqual([]);
    expect(dayMoves(moves, '2026-11-12').arrivals).toHaveLength(1);
    expect(dayMoves(moves, '2026-11-14')).toEqual({ arrivals: [], departures: [] });
  });
});
