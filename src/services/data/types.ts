/**
 * The app's data model, as screens see it. It mirrors the Supabase tables (TDD → Data & state) in
 * camelCase. Dates are `YYYY-MM-DD` and times `HH:MM` (24h), both local wall-clock time in the
 * trip's timezone (flights carry each airport's own timezone). Money is integer minor units plus
 * an ISO currency code.
 */

export interface Money {
  amountMinor: number;
  currency: string;
}

/** Credit for a cover photo (Unsplash guidelines: "Photo by <name> on Unsplash", with links). */
export interface PhotoCredit {
  source: 'unsplash';
  photographer: string;
  photographerUrl: string;
  photoUrl: string;
}

export interface Trip {
  id: string;
  city: string;
  country: string | null;
  lat: number | null;
  lng: number | null;
  /** IANA timezone, e.g. `America/Los_Angeles`. */
  timezone: string;
  startDate: string;
  endDate: string;
  coverPhotoUrl: string | null;
  /** Who took the cover photo; null (or absent in fixtures) when it needs no credit line. */
  coverPhotoCredit?: PhotoCredit | null;
  /** Not in the database yet: demo data only. */
  budget?: Money | null;
}

/** What "create a trip" saves; the source assigns the id. */
export type NewTrip = Omit<Trip, 'id' | 'budget'>;

export interface Place {
  id: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  /** food, landmark, hotel, airport, car, arena, bar, nightlife, attraction */
  kind: string | null;
  photoUrl: string | null;
  sourceUrl: string | null;
}

export type ItemKind = 'flight' | 'hotel' | 'car' | 'event' | 'food' | 'activity';

export interface ItineraryItem {
  id: string;
  tripId: string;
  day: string;
  startTime: string | null;
  durationMinutes: number | null;
  placeId: string | null;
  kind: ItemKind;
  bookingId: string | null;
  /** Fixed items (bookings, tickets) never move when Smart Add reshuffles a day. */
  fixed: boolean;
  /** Display title; without one, screens show the place's name. Not in the database yet. */
  title?: string;
}

export interface LocalDateTime {
  date: string;
  time: string;
  timezone: string;
}

export interface Airport {
  code: string;
  city: string;
  placeId: string | null;
}

export interface FlightData {
  airline: string;
  airlineCode: string;
  flightNumber: string;
  aircraft: string | null;
  from: Airport;
  to: Airport;
  departs: LocalDateTime;
  arrives: LocalDateTime;
  terminal: string | null;
  gate: string | null;
  seat: string | null;
  boardingTime: string | null;
  boardingGroup: string | null;
  cabin: string | null;
  confirmation: string;
  passenger: string;
  /** A picture of the boarding pass the user added. Kept in the booking's JSON, not a column. */
  passImage?: PassImage | null;
  /** Where the barcode sits on `passImage`, as fractions of its size. */
  passCrop?: PassCrop | null;
}

/**
 * An image file and its pixel size. `uri` is a file URI from the photo picker, or `fixture:<name>`
 * for a scenario's bundled sample.
 */
export interface PassImage {
  uri: string;
  width: number;
  height: number;
}

/** A rectangle on an image, each value a fraction (0–1) of the image's width or height. */
export interface PassCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HotelData {
  name: string;
  placeId: string;
  checkIn: LocalDateTime;
  checkOut: LocalDateTime;
  confirmation: string;
  room: string | null;
  address: string;
  phone: string | null;
  website: string | null;
  email: string | null;
}

export interface CarData {
  company: string;
  pickupPlaceId: string;
  returnPlaceId: string;
  pickup: LocalDateTime;
  dropoff: LocalDateTime;
  confirmation: string;
  vehicle: string | null;
}

export interface TicketData {
  event: string;
  placeId: string;
  starts: LocalDateTime;
  section: string | null;
  row: string | null;
  seats: string | null;
  confirmation: string;
}

interface BookingBase {
  id: string;
  tripId: string;
  /**
   * Storage path of the original file (PDF, screenshot), if one was imported; `fixture:<name>` for
   * a scenario's bundled sample.
   */
  originalPath: string | null;
}

export type Booking =
  | (BookingBase & { type: 'flight'; data: FlightData })
  | (BookingBase & { type: 'hotel'; data: HotelData })
  | (BookingBase & { type: 'car'; data: CarData })
  | (BookingBase & { type: 'ticket'; data: TicketData });

export type BookingType = Booking['type'];

export interface BucketItem {
  id: string;
  tripId: string;
  placeId: string;
  durationMinutes: number | null;
  /** Opening window; an end before the start runs past midnight (bars). */
  windowStart: string | null;
  windowEnd: string | null;
  /** Where it came from: tiktok, instagram, search, discover. */
  source: string | null;
  /** Events have a fixed date and time. */
  fixedDate: string | null;
  fixedTime: string | null;
}

export interface Expense {
  id: string;
  tripId: string;
  amountMinor: number;
  currency: string;
  category: string;
  bookingId: string | null;
  /** ISO instant. */
  paidAt: string | null;
  /** Not in the database yet: demo data only. */
  description?: string;
}

export interface TravelDocument {
  id: string;
  type: 'passport' | 'visa';
  country: string | null;
  expiresOn: string | null;
  imagePath: string | null;
}

/** Everything one trip's screens need, loaded together. */
export interface TripData {
  trip: Trip;
  places: Place[];
  items: ItineraryItem[];
  bookings: Booking[];
  bucketItems: BucketItem[];
  expenses: Expense[];
}

/** A whole account's data: what a scenario loads into the demo session. */
export interface DataSnapshot {
  trips: Trip[];
  places: Place[];
  items: ItineraryItem[];
  bookings: Booking[];
  bucketItems: BucketItem[];
  expenses: Expense[];
  documents: TravelDocument[];
}
