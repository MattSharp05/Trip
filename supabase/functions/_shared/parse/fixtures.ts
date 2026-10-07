// Canned parses of the sample bookings (TR-25): what the model reads from each file in
// `supabase/functions/parse-booking/fixtures/`, with coordinates already geocoded. The `fixture`
// provider returns them, so scenario demo sessions and tests never call a model. Names and
// confirmation numbers are made up.

import type { ParseResult } from './schema.ts';

export type SampleName = 'flight' | 'hotel' | 'car' | 'restaurant' | 'lisbon-hotel';

export const SAMPLE_PARSES: Record<SampleName, ParseResult> = {
  flight: {
    booking: {
      type: 'flight',
      confirmation: 'TSTFL1',
      passenger: 'Alex Sample',
      legs: [
        {
          airline: 'Delta Air Lines',
          airlineCode: 'DL',
          flightNumber: 'DL 9201',
          from: {
            code: 'TPA',
            city: 'Tampa',
            country: 'United States',
            lat: 27.9755,
            lng: -82.5332,
          },
          to: {
            code: 'CPT',
            city: 'Cape Town',
            country: 'South Africa',
            lat: -33.9715,
            lng: 18.6021,
          },
          departs: { date: '2026-12-18', time: '17:40' },
          arrives: { date: '2026-12-19', time: '16:55' },
          terminal: null,
          gate: null,
          seat: '32C',
          cabin: 'Main Cabin',
        },
        {
          airline: 'Delta Air Lines',
          airlineCode: 'DL',
          flightNumber: 'DL 9202',
          from: {
            code: 'CPT',
            city: 'Cape Town',
            country: 'South Africa',
            lat: -33.9715,
            lng: 18.6021,
          },
          to: { code: 'TPA', city: 'Tampa', country: 'United States', lat: 27.9755, lng: -82.5332 },
          departs: { date: '2027-01-06', time: '19:30' },
          arrives: { date: '2027-01-07', time: '07:10' },
          terminal: null,
          gate: null,
          seat: null,
          cabin: 'Main Cabin',
        },
      ],
      price: { amount: 1486.4, currency: 'USD' },
    },
    uncertain: ['legs.1.seat'],
  },
  hotel: {
    booking: {
      type: 'hotel',
      hotel: {
        name: 'The Silo Hotel',
        address: 'Silo Square, V&A Waterfront, Cape Town 8001',
        city: 'Cape Town',
        country: 'South Africa',
        lat: -33.9083,
        lng: 18.4217,
      },
      checkIn: { date: '2026-12-19', time: '14:00' },
      checkOut: { date: '2027-01-06', time: '11:00' },
      confirmation: 'TST-HTL-1001',
      room: 'Superior Room',
      phone: '+27 21 670 0500',
      website: null,
      email: null,
      price: { amount: 63000, currency: 'ZAR' },
    },
    uncertain: [],
  },
  car: {
    booking: {
      type: 'car',
      company: 'Avis',
      pickupLocation: {
        name: 'Avis, Cape Town International Airport',
        address: 'Airport Approach Rd, Cape Town',
        city: 'Cape Town',
        country: 'South Africa',
        lat: -33.97,
        lng: 18.597,
      },
      returnLocation: null,
      pickup: { date: '2026-12-19', time: '17:30' },
      dropoff: { date: '2027-01-06', time: '16:30' },
      confirmation: 'TST-CAR-2002',
      vehicle: 'VW Polo or similar',
      price: { amount: 5400, currency: 'ZAR' },
    },
    uncertain: [],
  },
  restaurant: {
    booking: {
      type: 'reservation',
      venue: {
        name: 'La Colombe',
        address: 'Silvermist Estate, Constantia Main Rd, Cape Town',
        city: 'Cape Town',
        country: 'South Africa',
        lat: -34.0254,
        lng: 18.4246,
      },
      starts: { date: '2026-12-21', time: '19:30' },
      partySize: 2,
      confirmation: 'TST-RES-3003',
      price: null,
    },
    uncertain: ['starts.time'],
  },
  'lisbon-hotel': {
    booking: {
      type: 'hotel',
      hotel: {
        name: 'Memmo Alfama',
        address: 'Travessa das Merceeiras 27, 1100-348 Lisbon',
        city: 'Lisbon',
        country: 'Portugal',
        lat: 38.7106,
        lng: -9.1301,
      },
      checkIn: { date: '2027-02-12', time: '15:00' },
      checkOut: { date: '2027-02-16', time: '12:00' },
      confirmation: 'TST-HTL-4004',
      room: 'Deluxe Double',
      phone: null,
      website: null,
      email: null,
      price: { amount: 820, currency: 'EUR' },
    },
    uncertain: [],
  },
};

/**
 * Which sample a file is, from its name (`sample-hotel.pdf`, `restaurant.png`); the flight when
 * nothing matches, so any file gives a result in a demo session.
 */
export function sampleFor(fileName: string): SampleName {
  const name = fileName.toLowerCase();
  if (name.includes('lisbon')) return 'lisbon-hotel';
  if (name.includes('hotel')) return 'hotel';
  if (name.includes('car')) return 'car';
  if (name.includes('restaurant') || name.includes('reservation')) return 'restaurant';
  return 'flight';
}
