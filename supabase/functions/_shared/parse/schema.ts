// What booking import reads out of a PDF or screenshot (TR-25, ADR 0004). Shared by the
// `parse-booking` Edge Function, which validates the model's answer with it, and the app, which
// validates the function's response and edits it on the review screen.
//
// Dates are `YYYY-MM-DD` and times `HH:MM` (24h), local wall-clock time where the thing happens.
// Prices are what the booking says, in major units (412.3 = $412.30); the app turns them into
// integer minor units when it saves an expense.

import { z } from 'zod';

const text = z.string().trim().min(1);
/** Optional text: the model sends null when the booking doesn't say. */
const maybe = text.nullable();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM (24h)');

/** A local date and time; the time is null when the booking gives only a date. */
export const whenSchema = z.object({ date, time: time.nullable() });

/** Coordinates are filled in by the function's geocoder, never by the model. */
const coordinates = {
  lat: z.number().min(-90).max(90).nullable().default(null),
  lng: z.number().min(-180).max(180).nullable().default(null),
};

export const locationSchema = z.object({
  name: text,
  address: maybe,
  city: maybe,
  country: maybe,
  ...coordinates,
});

export const airportSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/, 'Use the 3-letter airport code')
    .transform((c) => c.toUpperCase()),
  city: maybe,
  country: maybe,
  ...coordinates,
});

export const priceSchema = z
  .object({
    amount: z.number().nonnegative(),
    currency: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{3}$/, 'Use a 3-letter currency code')
      .transform((c) => c.toUpperCase()),
  })
  .nullable();

export const flightLegSchema = z.object({
  airline: text,
  /** IATA code, e.g. `AA`. */
  airlineCode: maybe,
  /** As printed, e.g. `AA 2410`. */
  flightNumber: text,
  from: airportSchema,
  to: airportSchema,
  departs: whenSchema,
  arrives: whenSchema,
  terminal: maybe,
  gate: maybe,
  seat: maybe,
  cabin: maybe,
});

export const flightSchema = z.object({
  type: z.literal('flight'),
  confirmation: maybe,
  passenger: maybe,
  /** Every flight on the booking in order: outbound, connections, return. */
  legs: z.array(flightLegSchema).min(1),
  price: priceSchema,
});

export const hotelSchema = z.object({
  type: z.literal('hotel'),
  hotel: locationSchema,
  checkIn: whenSchema,
  checkOut: whenSchema,
  confirmation: maybe,
  room: maybe,
  phone: maybe,
  website: maybe,
  email: maybe,
  price: priceSchema,
});

export const carSchema = z.object({
  type: z.literal('car'),
  company: text,
  pickupLocation: locationSchema,
  /** Null when the car goes back where it was picked up. */
  returnLocation: locationSchema.nullable(),
  pickup: whenSchema,
  dropoff: whenSchema,
  confirmation: maybe,
  vehicle: maybe,
  price: priceSchema,
});

export const ticketSchema = z.object({
  type: z.literal('ticket'),
  event: text,
  venue: locationSchema,
  starts: whenSchema,
  section: maybe,
  row: maybe,
  seats: maybe,
  confirmation: maybe,
  price: priceSchema,
});

export const reservationSchema = z.object({
  type: z.literal('reservation'),
  /** The restaurant (or other table booking) and where it is. */
  venue: locationSchema,
  starts: whenSchema,
  partySize: z.number().int().positive().nullable(),
  confirmation: maybe,
  price: priceSchema,
});

export const parsedBookingSchema = z.discriminatedUnion('type', [
  flightSchema,
  hotelSchema,
  carSchema,
  ticketSchema,
  reservationSchema,
]);

/** One import: the booking, plus the fields the model wasn't sure about (paths like `checkIn.time`). */
export const parseResultSchema = z.object({
  booking: parsedBookingSchema,
  uncertain: z.array(z.string()).default([]),
});

export type When = z.infer<typeof whenSchema>;
export type ParsedLocation = z.infer<typeof locationSchema>;
export type ParsedAirport = z.infer<typeof airportSchema>;
export type ParsedPrice = z.infer<typeof priceSchema>;
export type ParsedFlightLeg = z.infer<typeof flightLegSchema>;
export type ParsedFlight = z.infer<typeof flightSchema>;
export type ParsedHotel = z.infer<typeof hotelSchema>;
export type ParsedCar = z.infer<typeof carSchema>;
export type ParsedTicket = z.infer<typeof ticketSchema>;
export type ParsedReservation = z.infer<typeof reservationSchema>;
export type ParsedBooking = z.infer<typeof parsedBookingSchema>;
export type ParsedBookingType = ParsedBooking['type'];
export type ParseResult = z.infer<typeof parseResultSchema>;

/**
 * What the function returns when it can't give a booking. `code` drives the app's copy:
 * `not_configured` (no model key yet), `rate_limited` (free tier's per-minute cap), `unreadable`
 * (no booking found in the file), `failed` (anything else).
 */
export type ParseErrorCode = 'not_configured' | 'rate_limited' | 'unreadable' | 'failed';
export interface ParseError {
  error: ParseErrorCode;
  message: string;
}

/** Validates an untrusted value (the model's JSON, the function's response). */
export function readParseResult(
  value: unknown,
): { ok: true; result: ParseResult } | { ok: false; issues: string[] } {
  const parsed = parseResultSchema.safeParse(value);
  if (parsed.success) return { ok: true, result: parsed.data };
  return {
    ok: false,
    issues: parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
  };
}
