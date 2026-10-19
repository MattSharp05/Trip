import type { DataSnapshot, Expense, Membership, Profile } from '@/services/data/types';
import type { Booking, FlightData } from '@/services/data/bookings/types';

import { ME, VEGAS_TRIP_ID, vegasSnapshot } from './vegas';

/**
 * The Vegas trip as a group trip (v2, PRD decision 8): Matthew ("you", the owner) with two
 * pretend travelers, Blake and Willem, so splits, likes and opt-outs can be tested alone. Later
 * group tickets add their flights, likes, opt-outs and expenses here.
 */

export const BLAKE = 'user-blake';
export const WILLEM = 'user-willem';

const profiles: Profile[] = [
  ...vegasSnapshot.profiles,
  { id: BLAKE, displayName: 'Blake', venmo: 'blake-demo' },
  { id: WILLEM, displayName: 'Willem', cashapp: '$willemdemo', zelle: 'willem@example.com' },
];

const members: Membership[] = [
  ...vegasSnapshot.members,
  { tripId: VEGAS_TRIP_ID, userId: BLAKE, role: 'member' },
  { tripId: VEGAS_TRIP_ID, userId: WILLEM, role: 'member' },
];

/** Who added what, beyond Matthew's own (unmarked) items. */
const BUCKET_ADDED_BY: Record<string, string> = { 'bucket-golden-tiki': BLAKE };
const STOP_ADDED_BY: Record<string, string> = { 'item-04': WILLEM }; // Dinner at Peppermill, Nov 12

/**
 * Bucket List likes (TR-59): Blake's Golden Tiki has two (Blake and Willem), Lotus of Siam one
 * (Blake), the rest none. Popular: Golden Tiki, Lotus of Siam, then the rest newest first.
 */
const BUCKET_LIKES: Record<string, string[]> = {
  'bucket-golden-tiki': [BLAKE, WILLEM],
  'bucket-lotus-of-siam': [BLAKE],
};

/**
 * Shared expenses (TR-62, ADR 0030): Blake bought the Sphere tickets for all three (it replaces
 * Matthew's own Sphere expense), Matthew paid a dinner in euros for himself and Willem (rate from
 * the demo rates), and Willem paid an Uber for all three.
 */
export const GROUP_EXPENSES: Expense[] = [
  {
    id: 'expense-group-sphere',
    tripId: VEGAS_TRIP_ID,
    amountMinor: 45000,
    currency: 'USD',
    category: 'Activities',
    description: 'Sphere tickets',
    paidAt: '2026-10-20T12:00:00-07:00',
    bookingId: null,
    addedBy: BLAKE,
    paidBy: BLAKE,
    itineraryItemId: 'item-07', // Sphere Experience, Nov 13
    shares: [
      { userId: ME, shareMinor: 15000 },
      { userId: BLAKE, shareMinor: 15000 },
      { userId: WILLEM, shareMinor: 15000 },
    ],
    rateToTrip: 1,
    tripCurrency: 'USD',
  },
  {
    id: 'expense-group-dinner',
    tripId: VEGAS_TRIP_ID,
    amountMinor: 12000,
    currency: 'EUR',
    category: 'Food & Drinks',
    description: 'Dinner at Peppermill',
    paidAt: '2026-11-12T21:30:00-08:00',
    bookingId: null,
    paidBy: ME,
    itineraryItemId: 'item-04', // Dinner at Peppermill, Nov 12
    shares: [
      { userId: ME, shareMinor: 6000 },
      { userId: WILLEM, shareMinor: 6000 },
    ],
    rateToTrip: 1.16,
    tripCurrency: 'USD',
  },
  {
    id: 'expense-group-uber',
    tripId: VEGAS_TRIP_ID,
    amountMinor: 3600,
    currency: 'USD',
    category: 'Transport',
    description: 'Uber to the Strip',
    paidAt: '2026-11-13T09:40:00-08:00',
    bookingId: null,
    addedBy: WILLEM,
    paidBy: WILLEM,
    shares: [
      { userId: ME, shareMinor: 1200 },
      { userId: BLAKE, shareMinor: 1200 },
      { userId: WILLEM, shareMinor: 1200 },
    ],
    rateToTrip: 1,
    tripCurrency: 'USD',
  },
];

export const groupSnapshot: DataSnapshot = {
  ...vegasSnapshot,
  members,
  profiles,
  expenses: [...vegasSnapshot.expenses.filter((e) => e.id !== 'expense-sphere'), ...GROUP_EXPENSES],
  bucketItems: vegasSnapshot.bucketItems
    .map((b) => (BUCKET_ADDED_BY[b.id] ? { ...b, addedBy: BUCKET_ADDED_BY[b.id] } : b))
    // Matthew's own items say so, so Blake and Willem see "Added by Matthew" (TR-59).
    .map((b) => ({ ...b, addedBy: b.addedBy ?? ME }))
    .map((b) => (BUCKET_LIKES[b.id] ? { ...b, likedBy: BUCKET_LIKES[b.id] } : b)),
  items: vegasSnapshot.items.map((i) =>
    STOP_ADDED_BY[i.id] ? { ...i, addedBy: STOP_ADDED_BY[i.id] } : i,
  ),
};

/**
 * `group-vegas` seen by Willem, a member, not the organizer (TR-56): no Remove, and Leave trip. He
 * is also on Matthew's Cape Town trip, so leaving Vegas selects it.
 */
export const groupMemberSnapshot: DataSnapshot = {
  ...groupSnapshot,
  me: WILLEM,
  members: [...members, { tripId: 'trip-cape-town', userId: WILLEM, role: 'member' }],
};

/** A friend Matthew invites to Vegas (TR-57): on no trip yet. */
export const ALEX = 'user-alex';
/** Matthew's invite link to the Vegas trip in `group-invite`. */
export const VEGAS_INVITE_TOKEN = 'demo-vegas-invite';

/**
 * `group-vegas` seen by Alex, who opened Matthew's invite link (TR-57): the preview shows "with
 * Matthew and 2 others", and Join adds Alex to the trip in memory.
 */
export const groupInviteSnapshot: DataSnapshot = {
  ...groupSnapshot,
  me: ALEX,
  profiles: [...profiles, { id: ALEX, displayName: 'Alex' }],
  invites: [{ token: VEGAS_INVITE_TOKEN, tripId: VEGAS_TRIP_ID, createdBy: vegasSnapshot.me }],
};

/** A flight booking of Blake's or Willem's: private to them, as flights are (ADR 0027). */
const memberFlight = (
  id: string,
  addedBy: string,
  data: Pick<
    FlightData,
    'airline' | 'airlineCode' | 'flightNumber' | 'from' | 'to' | 'departs' | 'arrives'
  >,
): Booking => ({
  id,
  tripId: VEGAS_TRIP_ID,
  addedBy,
  visibility: 'private',
  originalPath: null,
  type: 'flight',
  data: {
    aircraft: null,
    terminal: null,
    gate: null,
    seat: '22C',
    boardingTime: null,
    boardingGroup: null,
    cabin: 'Main',
    confirmation: 'PRIV8',
    passenger: addedBy,
    ...data,
  },
});

const LAS = { code: 'LAS', city: 'Las Vegas', placeId: 'place-las' };
const ORD = { code: 'ORD', city: 'Chicago', placeId: null };
const JFK = { code: 'JFK', city: 'New York', placeId: null };
const PT = 'America/Los_Angeles';

/** Blake's and Willem's flights in and out of Vegas (TR-58): landing 2:10 and 2:45 PM on Nov 12. */
export const memberFlights: Booking[] = [
  memberFlight('booking-blake-out', BLAKE, {
    airline: 'United Airlines',
    airlineCode: 'UA',
    flightNumber: 'UA 1187',
    from: ORD,
    to: LAS,
    departs: { date: '2026-11-12', time: '11:50', timezone: 'America/Chicago' },
    arrives: { date: '2026-11-12', time: '14:10', timezone: PT },
  }),
  memberFlight('booking-willem-out', WILLEM, {
    airline: 'JetBlue',
    airlineCode: 'B6',
    flightNumber: 'B6 1123',
    from: JFK,
    to: LAS,
    departs: { date: '2026-11-12', time: '11:40', timezone: 'America/New_York' },
    arrives: { date: '2026-11-12', time: '14:45', timezone: PT },
  }),
  memberFlight('booking-blake-home', BLAKE, {
    airline: 'United Airlines',
    airlineCode: 'UA',
    flightNumber: 'UA 2290',
    from: LAS,
    to: ORD,
    departs: { date: '2026-11-16', time: '16:05', timezone: PT },
    arrives: { date: '2026-11-16', time: '21:55', timezone: 'America/Chicago' },
  }),
  memberFlight('booking-willem-home', WILLEM, {
    airline: 'JetBlue',
    airlineCode: 'B6',
    flightNumber: 'B6 1124',
    from: LAS,
    to: JFK,
    departs: { date: '2026-11-16', time: '16:30', timezone: PT },
    arrives: { date: '2026-11-17', time: '00:58', timezone: 'America/New_York' },
  }),
];

/**
 * `group-vegas` with everyone's flights (TR-58): Blake and Willem land 35 min apart after
 * Matthew, and fly home on Nov 16. Their bookings stay private; Plan shows their times only.
 */
export const groupArrivalsSnapshot: DataSnapshot = {
  ...groupSnapshot,
  // Matthew's flights say so, so the scenario reads the same as any of the three.
  bookings: [
    ...groupSnapshot.bookings.map((b) =>
      b.type === 'flight' ? { ...b, addedBy: b.addedBy ?? vegasSnapshot.me } : b,
    ),
    ...memberFlights,
  ],
};
