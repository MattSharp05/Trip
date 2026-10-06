import type {
  Booking,
  BucketItem,
  DataSnapshot,
  Expense,
  ItineraryItem,
  Place,
  TravelDocument,
  Trip,
} from '@/services/data/types';

/**
 * The sample account from the vision mockup: four trips, with Las Vegas (Nov 12–16, 2026) fully
 * planned. Later tickets read these fixtures through scenarios; extend them here rather than
 * building one-off data in a screen.
 */

const LA = 'America/Los_Angeles';
const NY = 'America/New_York';
const VEGAS = 'trip-vegas';

/** Wikimedia Commons image at a phone-friendly width. */
const commons = (file: string) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=640`;

export const trips: Trip[] = [
  {
    id: 'trip-new-york',
    city: 'New York',
    country: 'United States',
    lat: 40.7128,
    lng: -74.006,
    timezone: NY,
    startDate: '2026-10-16',
    endDate: '2026-10-20',
    coverPhotoUrl: null,
  },
  {
    id: VEGAS,
    city: 'Las Vegas',
    country: 'United States',
    lat: 36.1147,
    lng: -115.1728,
    timezone: LA,
    startDate: '2026-11-12',
    endDate: '2026-11-16',
    coverPhotoUrl: commons('The Strip, Las Vegas - April 2026.jpg'),
    budget: { amountMinor: 250000, currency: 'USD' },
  },
  {
    id: 'trip-cape-town',
    city: 'Cape Town',
    country: 'South Africa',
    lat: -33.9249,
    lng: 18.4241,
    timezone: 'Africa/Johannesburg',
    startDate: '2026-12-18',
    endDate: '2027-01-06',
    coverPhotoUrl: null,
  },
  {
    id: 'trip-tokyo',
    city: 'Tokyo',
    country: 'Japan',
    lat: 35.6762,
    lng: 139.6503,
    timezone: 'Asia/Tokyo',
    startDate: '2027-03-20',
    endDate: '2027-03-29',
    coverPhotoUrl: null,
  },
];

const place = (
  id: string,
  name: string,
  kind: string,
  address: string,
  lat: number,
  lng: number,
  photoUrl: string | null = null,
): Place => ({ id, name, kind, address, lat, lng, photoUrl, sourceUrl: null });

export const places: Place[] = [
  place(
    'place-tpa',
    'Tampa International (TPA)',
    'airport',
    '4100 George J Bean Pkwy, Tampa, FL',
    27.9755,
    -82.5332,
  ),
  place(
    'place-las',
    'Harry Reid International (LAS)',
    'airport',
    '5757 Wayne Newton Blvd, Las Vegas, NV',
    36.084,
    -115.1537,
  ),
  place(
    'place-hertz',
    'Hertz, Rent-A-Car Center',
    'car',
    '7135 Gilespie St, Las Vegas, NV',
    36.0577,
    -115.163,
  ),
  place(
    'place-cosmopolitan',
    'The Cosmopolitan',
    'hotel',
    '3708 Las Vegas Blvd S, Las Vegas, NV',
    36.1097,
    -115.1745,
  ),
  place(
    'place-peppermill',
    'Peppermill Restaurant',
    'food',
    '2985 Las Vegas Blvd S, Las Vegas, NV',
    36.1336,
    -115.163,
  ),
  place(
    'place-mon-ami-gabi',
    'Mon Ami Gabi',
    'food',
    'Paris Las Vegas, 3655 Las Vegas Blvd S',
    36.1125,
    -115.172,
  ),
  place(
    'place-bellagio',
    'Bellagio Fountains',
    'landmark',
    '3600 Las Vegas Blvd S, Las Vegas, NV',
    36.1126,
    -115.1741,
    commons('Bellagio Fountains (1150330184).jpg'),
  ),
  place('place-sphere', 'Sphere', 'landmark', '255 Sands Ave, Las Vegas, NV', 36.1207, -115.1622),
  place(
    'place-carbone',
    'Carbone',
    'food',
    'ARIA Resort & Casino, 3730 Las Vegas Blvd S',
    36.1073,
    -115.1767,
    commons('Aria Las Vegas December 2013.jpg'),
  ),
  place(
    'place-venetian',
    'Gondola at The Venetian',
    'landmark',
    '3355 Las Vegas Blvd S, Las Vegas, NV',
    36.1212,
    -115.1697,
  ),
  place(
    'place-forum-shops',
    'The Forum Shops',
    'landmark',
    'Caesars Palace, 3500 Las Vegas Blvd S',
    36.1178,
    -115.1764,
  ),
  place(
    'place-area15',
    'AREA15',
    'attraction',
    '3215 S Rancho Dr, Las Vegas, NV',
    36.1314,
    -115.1817,
  ),
  place(
    'place-t-mobile',
    'T-Mobile Arena',
    'arena',
    '3780 Las Vegas Blvd S, Las Vegas, NV',
    36.1029,
    -115.1784,
  ),
  place(
    'place-xs',
    'XS Nightclub',
    'nightlife',
    'Wynn Las Vegas, 3131 Las Vegas Blvd S',
    36.1272,
    -115.1653,
  ),
  place(
    'place-golden-tiki',
    'Golden Tiki',
    'bar',
    '3939 Spring Mountain Rd, Las Vegas, NV',
    36.1257,
    -115.1966,
  ),
  place(
    'place-fremont',
    'Fremont Street Experience',
    'landmark',
    'Fremont St, Las Vegas, NV',
    36.1707,
    -115.144,
  ),
  place(
    'place-lotus-of-siam',
    'Lotus of Siam',
    'food',
    '620 E Flamingo Rd, Las Vegas, NV',
    36.1149,
    -115.149,
  ),
  place(
    'place-pinball',
    'Pinball Hall of Fame',
    'attraction',
    '4925 Las Vegas Blvd S, Las Vegas, NV',
    36.0946,
    -115.1737,
  ),
];

export const bookings: Booking[] = [
  {
    id: 'booking-flight-out',
    tripId: VEGAS,
    originalPath: null,
    type: 'flight',
    data: {
      airline: 'American Airlines',
      airlineCode: 'AA',
      flightNumber: 'AA 2410',
      aircraft: 'Boeing 737',
      from: { code: 'TPA', city: 'Tampa', placeId: 'place-tpa' },
      to: { code: 'LAS', city: 'Las Vegas', placeId: 'place-las' },
      departs: { date: '2026-11-12', time: '09:05', timezone: NY },
      arrives: { date: '2026-11-12', time: '11:02', timezone: LA },
      terminal: 'E',
      gate: 'E75',
      seat: '14A',
      boardingTime: '08:25',
      boardingGroup: '5',
      cabin: 'Main',
      confirmation: 'KXJ4PL',
      passenger: 'Matthew S.',
    },
  },
  {
    id: 'booking-flight-home',
    tripId: VEGAS,
    originalPath: null,
    type: 'flight',
    data: {
      airline: 'American Airlines',
      airlineCode: 'AA',
      flightNumber: 'AA 2411',
      aircraft: 'Boeing 737',
      from: { code: 'LAS', city: 'Las Vegas', placeId: 'place-las' },
      to: { code: 'TPA', city: 'Tampa', placeId: 'place-tpa' },
      departs: { date: '2026-11-16', time: '13:45', timezone: LA },
      arrives: { date: '2026-11-16', time: '21:12', timezone: NY },
      terminal: '1',
      gate: 'D12',
      seat: '14A',
      boardingTime: '13:05',
      boardingGroup: '5',
      cabin: 'Main',
      confirmation: 'KXJ4PL',
      passenger: 'Matthew S.',
    },
  },
  {
    id: 'booking-hotel',
    tripId: VEGAS,
    originalPath: null,
    type: 'hotel',
    data: {
      name: 'The Cosmopolitan',
      placeId: 'place-cosmopolitan',
      checkIn: { date: '2026-11-12', time: '15:00', timezone: LA },
      checkOut: { date: '2026-11-16', time: '11:00', timezone: LA },
      confirmation: '837282',
      room: 'Terrace Studio',
      address: '3708 Las Vegas Blvd S, Las Vegas, NV 89109',
      phone: '+1 702-698-7000',
      website: 'https://www.cosmopolitanlasvegas.com',
      email: null,
    },
  },
  {
    id: 'booking-car',
    tripId: VEGAS,
    originalPath: null,
    type: 'car',
    data: {
      company: 'Hertz',
      pickupPlaceId: 'place-hertz',
      returnPlaceId: 'place-hertz',
      pickup: { date: '2026-11-12', time: '11:40', timezone: LA },
      dropoff: { date: '2026-11-16', time: '11:45', timezone: LA },
      confirmation: 'H7742019',
      vehicle: 'Toyota Camry or similar',
    },
  },
  {
    id: 'booking-ufc',
    tripId: VEGAS,
    originalPath: null,
    type: 'ticket',
    data: {
      event: 'UFC 310',
      placeId: 'place-t-mobile',
      starts: { date: '2026-11-15', time: '18:00', timezone: LA },
      section: '12',
      row: 'F',
      seats: '7, 8',
      confirmation: 'TM-31055802',
    },
  },
];

let n = 0;
const item = (
  day: string,
  startTime: string,
  durationMinutes: number,
  placeId: string,
  kind: ItineraryItem['kind'],
  title: string,
  extra: Partial<ItineraryItem> = {},
): ItineraryItem => ({
  id: `item-${String(++n).padStart(2, '0')}`,
  tripId: VEGAS,
  day,
  startTime,
  durationMinutes,
  placeId,
  kind,
  bookingId: null,
  fixed: false,
  title,
  ...extra,
});

export const items: ItineraryItem[] = [
  item('2026-11-12', '11:02', 30, 'place-las', 'flight', 'Arrive in Las Vegas', {
    bookingId: 'booking-flight-out',
    fixed: true,
  }),
  item('2026-11-12', '11:40', 30, 'place-hertz', 'car', 'Pick up rental car', {
    bookingId: 'booking-car',
    fixed: true,
  }),
  item('2026-11-12', '15:00', 45, 'place-cosmopolitan', 'hotel', 'Check in at The Cosmopolitan', {
    bookingId: 'booking-hotel',
    fixed: true,
  }),
  item('2026-11-12', '19:30', 90, 'place-peppermill', 'food', 'Dinner at Peppermill'),
  item('2026-11-13', '10:00', 75, 'place-mon-ami-gabi', 'food', 'Brunch at Mon Ami Gabi'),
  item('2026-11-13', '12:00', 60, 'place-bellagio', 'activity', 'Bellagio Fountains'),
  item('2026-11-13', '15:00', 90, 'place-sphere', 'event', 'Sphere Experience', { fixed: true }),
  item('2026-11-13', '20:00', 105, 'place-carbone', 'food', 'Dinner at Carbone', { fixed: true }),
  item('2026-11-14', '11:00', 60, 'place-venetian', 'activity', 'Gondola at The Venetian'),
  item('2026-11-14', '14:00', 90, 'place-forum-shops', 'activity', 'The Forum Shops'),
  item('2026-11-15', '10:00', 120, 'place-area15', 'activity', 'AREA15'),
  item('2026-11-15', '18:00', 210, 'place-t-mobile', 'event', 'UFC 310', {
    bookingId: 'booking-ufc',
    fixed: true,
  }),
  item('2026-11-16', '10:30', 20, 'place-cosmopolitan', 'hotel', 'Check out of The Cosmopolitan', {
    bookingId: 'booking-hotel',
    fixed: true,
  }),
  item('2026-11-16', '11:45', 25, 'place-hertz', 'car', 'Return rental car', {
    bookingId: 'booking-car',
    fixed: true,
  }),
  item('2026-11-16', '13:45', 30, 'place-las', 'flight', 'Fly home to Tampa', {
    bookingId: 'booking-flight-home',
    fixed: true,
  }),
];

const bucket = (id: string, placeId: string, extra: Partial<BucketItem>): BucketItem => ({
  id,
  tripId: VEGAS,
  placeId,
  durationMinutes: null,
  windowStart: null,
  windowEnd: null,
  source: null,
  fixedDate: null,
  fixedTime: null,
  ...extra,
});

export const bucketItems: BucketItem[] = [
  bucket('bucket-golden-tiki', 'place-golden-tiki', {
    durationMinutes: 90,
    windowStart: '16:00',
    windowEnd: '02:00',
    source: 'tiktok',
  }),
  bucket('bucket-fremont', 'place-fremont', {
    durationMinutes: 120,
    windowStart: '18:00',
    windowEnd: '23:59',
    source: 'search',
  }),
  bucket('bucket-lotus-of-siam', 'place-lotus-of-siam', {
    durationMinutes: 75,
    windowStart: '11:00',
    windowEnd: '22:00',
    source: 'instagram',
  }),
  bucket('bucket-pinball', 'place-pinball', {
    durationMinutes: 60,
    windowStart: '10:00',
    windowEnd: '22:00',
    source: 'search',
  }),
  bucket('bucket-fred-again', 'place-xs', {
    durationMinutes: 180,
    source: 'discover',
    fixedDate: '2026-11-14',
    fixedTime: '20:00',
  }),
];

const expense = (
  id: string,
  amountMinor: number,
  currency: string,
  category: string,
  description: string,
  paidAt: string,
  bookingId: string | null = null,
): Expense => ({
  id,
  tripId: VEGAS,
  amountMinor,
  currency,
  category,
  description,
  paidAt,
  bookingId,
});

export const expenses: Expense[] = [
  expense(
    'expense-flights',
    48600,
    'USD',
    'Flights',
    'AA 2410 and AA 2411',
    '2026-09-02T14:10:00-04:00',
    'booking-flight-out',
  ),
  expense(
    'expense-hotel',
    74000,
    'USD',
    'Hotels',
    'The Cosmopolitan, 4 nights',
    '2026-09-03T19:22:00-04:00',
    'booking-hotel',
  ),
  expense(
    'expense-parking',
    8400,
    'USD',
    'Transport',
    'Airport parking, Tampa',
    '2026-11-12T07:15:00-05:00',
  ),
  expense(
    'expense-coffee',
    600,
    'USD',
    'Food & Drinks',
    'Coffee at the airport',
    '2026-11-12T08:05:00-05:00',
  ),
  expense(
    'expense-sphere',
    17000,
    'USD',
    'Activities',
    'Sphere tickets',
    '2026-10-20T12:00:00-07:00',
  ),
  expense(
    'expense-carbone',
    21200,
    'USD',
    'Food & Drinks',
    'Dinner at Carbone',
    '2026-11-13T22:05:00-08:00',
  ),
  expense(
    'expense-insurance',
    13000,
    'EUR',
    'Other',
    'Travel insurance',
    '2026-09-05T10:00:00+02:00',
  ),
];

export const documents: TravelDocument[] = [
  {
    id: 'document-passport',
    type: 'passport',
    country: 'United States',
    expiresOn: '2034-06-30',
    imagePath: null,
  },
];

/** The whole sample account. */
export const vegasSnapshot: DataSnapshot = {
  trips,
  places,
  items,
  bookings,
  bucketItems,
  expenses,
  documents,
};

export const VEGAS_TRIP_ID = VEGAS;
