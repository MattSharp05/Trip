import type { CarData, HotelData, TicketData } from '@/services/data/types';

import { carFacts } from '../car/carInfo';
import { hotelActions, hotelFacts, stayLine } from '../hotel/hotelInfo';
import { ticketFacts } from '../ticket/ticketInfo';
import { visibleRows } from './Facts';

const LA = 'America/Los_Angeles';
const hotel: HotelData = {
  name: 'The Cosmopolitan',
  placeId: 'place-cosmopolitan',
  checkIn: { date: '2026-11-12', time: '15:00', timezone: LA },
  checkOut: { date: '2026-11-16', time: '11:00', timezone: LA },
  confirmation: '837282',
  room: 'Terrace Studio',
  address: '3708 Las Vegas Blvd S',
  phone: '+1 702-698-7000',
  website: 'https://www.cosmopolitanlasvegas.com',
  email: 'stay@cosmo.com',
};

const labels = (rows: ReturnType<typeof visibleRows>) => rows.map((r) => r.map((f) => f.label));

describe('hotel', () => {
  it('reads the stay as dates and nights', () => {
    expect(stayLine(hotel)).toBe('Nov 12 – Nov 16 · 4 nights');
    expect(stayLine({ ...hotel, checkOut: { ...hotel.checkOut, date: '2026-11-13' } })).toBe(
      'Nov 12 – Nov 13 · 1 night',
    );
  });

  it('offers every action the booking has', () => {
    const actions = hotelActions(hotel, undefined).filter((a) => a.url);
    expect(actions.map((a) => a.key)).toEqual(['directions', 'call', 'website', 'email']);
  });

  it('hides actions and rows for missing fields', () => {
    const bare = { ...hotel, address: '', phone: null, website: null, email: null, room: null };
    expect(hotelActions(bare, undefined).filter((a) => a.url)).toEqual([]);
    expect(labels(visibleRows(hotelFacts(bare)))).toEqual([
      ['Check-in', 'Check-out'],
      ['Confirmation #'],
    ]);
  });
});

describe('car', () => {
  const car: CarData = {
    company: 'Hertz',
    pickupPlaceId: 'a',
    returnPlaceId: 'b',
    pickup: { date: '2026-11-12', time: '11:40', timezone: LA },
    dropoff: { date: '2026-11-16', time: '11:45', timezone: LA },
    confirmation: 'H7742019',
    vehicle: null,
  };

  it('pairs pickup and return with their places and hides a missing car class', () => {
    const rows = visibleRows(carFacts(car, 'Airport', null));
    expect(labels(rows)).toEqual([['Pickup', 'Return'], ['Confirmation #']]);
    expect(rows[0][0]).toMatchObject({ value: 'Thu, Nov 12, 11:40 AM', detail: 'Airport' });
    expect(rows[0][1].detail).toBeNull();
  });
});

describe('ticket', () => {
  const ticket: TicketData = {
    event: 'Carbone',
    placeId: 'p',
    starts: { date: '2026-11-13', time: '20:00', timezone: LA },
    section: null,
    row: null,
    seats: null,
    confirmation: '',
  };

  it('shows only the date and time for a reservation without seats or confirmation', () => {
    expect(labels(visibleRows(ticketFacts(ticket)))).toEqual([['Date and time']]);
  });

  it('keeps the seat parts it has', () => {
    const rows = visibleRows(ticketFacts({ ...ticket, section: '12', seats: '7, 8' }));
    expect(labels(rows)[1]).toEqual(['Section', 'Seats']);
  });
});
