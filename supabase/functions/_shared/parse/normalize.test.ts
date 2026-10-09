import { airportPlace } from './airports';
import { countryName, normalizeAnswer } from './normalize';
import { readParseResult } from './schema';

// The fixes for the model's near-misses (TR-49); whole recorded answers go through
// parse-booking's handler in parse-booking/index.test.ts.

const reservation = {
  type: 'restaurant',
  venue: { name: 'Tasca do Exemplo', address: null, city: 'Lisbon', country: 'PT' },
  starts: { date: '2026-05-05', time: '21:00' },
  partySize: '2',
  confirmation: null,
  price: null,
};

describe('normalizeAnswer', () => {
  it('maps model words for a type onto the five types', () => {
    const types = ['Event', 'concert', 'e-ticket', 'Restaurant', 'car rental', 'flight'].map(
      (type) => (normalizeAnswer({ booking: { type } }) as { booking: { type: string } }).booking,
    );
    expect(types.map((b) => b.type)).toEqual([
      'ticket',
      'ticket',
      'ticket',
      'reservation',
      'car',
      'flight',
    ]);
  });

  it('turns a reservation with text numbers and an ISO country into a valid one', () => {
    const read = readParseResult(normalizeAnswer({ booking: reservation }));
    expect(read).toMatchObject({
      ok: true,
      result: {
        booking: { type: 'reservation', partySize: 2, venue: { country: 'Portugal' } },
        uncertain: [],
      },
    });
  });

  it('rejects a list of several bookings rather than dropping all but one', () => {
    const answer = normalizeAnswer({ bookings: [reservation, reservation] });
    expect(readParseResult(answer).ok).toBe(false);
  });

  it('unwraps a list of one booking', () => {
    const answer = normalizeAnswer({ bookings: [reservation], uncertain: ['starts.time'] });
    expect(answer).toMatchObject({ booking: { type: 'reservation' }, uncertain: ['starts.time'] });
    expect(answer).not.toHaveProperty('bookings');
  });

  it("leaves what it can't fix for validation to reject", () => {
    expect(normalizeAnswer('not json')).toBe('not json');
    const read = readParseResult(normalizeAnswer({ booking: { type: 'menu' } }));
    expect(read.ok).toBe(false);
  });

  it("doesn't touch a city or country the model did read", () => {
    const leg = { code: 'LIS', city: 'Lisboa', country: 'Portugal' };
    const answer = normalizeAnswer({ booking: { type: 'flight', legs: [{ from: leg, to: leg }] } });
    expect(answer).toMatchObject({ booking: { legs: [{ from: leg }] } });
  });
});

describe('countryName and airportPlace', () => {
  it('names ISO codes and common short forms, and leaves names alone', () => {
    expect(['PT', 'US', 'USA', 'UK', 'Portugal', 'Narnia'].map(countryName)).toEqual([
      'Portugal',
      'United States',
      'United States',
      'United Kingdom',
      'Portugal',
      'Narnia',
    ]);
  });

  it('knows the golden set airports, in any case', () => {
    for (const code of ['TPA', 'LAS', 'SEA', 'SFO', 'JFK', 'lis']) {
      expect(airportPlace(code)?.country).toBeTruthy();
    }
    expect(airportPlace('XYZ')).toBeNull();
  });
});
