import { SAMPLE_PARSES } from '../../../supabase/functions/_shared/parse/fixtures';
import {
  applyValues,
  convertBooking,
  draftFrom,
  fieldsFor,
  finishDraft,
  getAt,
  readAmount,
  setAt,
  switchType,
} from './draft';

describe('import draft', () => {
  it('reads and writes dotted paths without changing the original', () => {
    const value = { legs: [{ to: { code: 'LAS' } }] };
    expect(getAt(value, 'legs.0.to.code')).toBe('LAS');
    const next = setAt(value, 'legs.0.to.code', 'CPT');
    expect(getAt(next, 'legs.0.to.code')).toBe('CPT');
    expect(value.legs[0].to.code).toBe('LAS');
    expect(Array.isArray(next.legs)).toBe(true);
  });

  it('lists every leg of a flight and the price', () => {
    const paths = fieldsFor(SAMPLE_PARSES.flight.booking).map((f) => f.path);
    expect(paths).toContain('legs.1.departs.time');
    expect(paths.slice(-2)).toEqual(['price.amount', 'price.currency']);
  });

  it('round-trips a sample unchanged', () => {
    for (const sample of Object.values(SAMPLE_PARSES)) {
      expect(finishDraft(draftFrom(sample.booking, sample.uncertain))).toEqual({
        booking: sample.booking,
      });
    }
  });

  it('fills a missing time with a default and flags it', () => {
    const hotel = SAMPLE_PARSES.hotel.booking;
    if (hotel.type !== 'hotel') throw new Error('hotel');
    const draft = draftFrom({ ...hotel, checkIn: { date: hotel.checkIn.date, time: null } });
    expect(draft.values['checkIn.time']).toBe('15:00');
    expect(draft.uncertain).toContain('checkIn.time');
  });

  it('turns form strings into typed values', () => {
    const draft = draftFrom(SAMPLE_PARSES.restaurant.booking);
    const booking = applyValues({
      ...draft,
      values: {
        ...draft.values,
        partySize: '4',
        'price.amount': '1,250.50',
        'price.currency': 'zar',
        confirmation: '',
      },
    });
    expect(booking).toMatchObject({
      partySize: 4,
      price: { amount: 1250.5, currency: 'ZAR' },
      confirmation: null,
    });
  });

  it('explains what to fix, per field', () => {
    const draft = draftFrom(SAMPLE_PARSES.flight.booking);
    const result = finishDraft({
      ...draft,
      values: {
        ...draft.values,
        'legs.0.from.code': 'TAMPA',
        'legs.0.airline': '',
        'price.currency': 'US',
      },
    });
    expect(result).toEqual({
      errors: {
        'legs.0.from.code': 'Use the 3-letter airport code, like LAS.',
        'legs.0.airline': 'Fill this in.',
        'price.currency': 'Use a 3-letter currency code, like USD.',
      },
    });
  });

  it('refuses a check-out before check-in', () => {
    const draft = draftFrom(SAMPLE_PARSES.hotel.booking);
    expect(
      finishDraft({ ...draft, values: { ...draft.values, 'checkOut.date': '2026-12-01' } }),
    ).toEqual({ errors: { 'checkOut.date': 'This is before the start.' } });
  });

  it('keeps name, place, dates, confirmation and price across a type switch', () => {
    const hotel = SAMPLE_PARSES.hotel.booking;
    expect(convertBooking(hotel, 'ticket')).toMatchObject({
      type: 'ticket',
      event: 'The Silo Hotel',
      venue: { name: 'The Silo Hotel', lat: -33.9083 },
      starts: { date: '2026-12-19', time: '14:00' },
      confirmation: 'TST-HTL-1001',
      price: { amount: 63000, currency: 'ZAR' },
    });
    const draft = switchType(draftFrom(hotel), 'flight');
    expect(draft.base.type).toBe('flight');
    expect(draft.values['legs.0.airline']).toBe('The Silo Hotel');
    expect(draft.values['legs.0.departs.date']).toBe('2026-12-19');
  });
});

describe('readAmount', () => {
  it.each([
    ['412.30', 412.3],
    ['1,250.50', 1250.5],
    ['1,250', 1250],
    ['412,30', 412.3],
    ['1.250,50', 1250.5],
    ['twelve', NaN],
    ['63 000', 63000],
  ])('reads %s', (text, amount) => {
    expect(readAmount(text)).toBe(amount);
  });
});

describe('edited places', () => {
  it('drops the coordinates of a place whose city was changed', () => {
    const draft = draftFrom(SAMPLE_PARSES.hotel.booking);
    const booking = applyValues({ ...draft, values: { ...draft.values, 'hotel.city': 'Lisbon' } });
    expect(booking).toMatchObject({ hotel: { city: 'Lisbon', lat: null, lng: null } });
    expect(applyValues(draft)).toMatchObject({ hotel: { lat: -33.9083 } });
  });
});
