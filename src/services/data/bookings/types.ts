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

/** Mine / Shared (ADR 0027): a private booking is seen by the traveller who added it only. */
export type BookingVisibility = 'shared' | 'private';

interface BookingBase {
  id: string;
  tripId: string;
  /** Who added it (profile id); absent in v1 fixtures, meaning you. */
  addedBy?: string;
  /** Absent in v1 fixtures: the default for its type (see `bookingVisibility`). */
  visibility?: BookingVisibility;
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

/** The bookings slice of `DataSource`. */
export interface BookingsSource {
  /** Updates an existing booking's JSON data and original file (e.g. a boarding pass crop). */
  saveBooking(booking: Booking): Promise<Booking>;
  /** Adds a new booking (an import); the caller picks its id. */
  createBooking(booking: Booking): Promise<Booking>;
  deleteBooking(id: string): Promise<void>;
}
