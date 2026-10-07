// Live flight status (TR-26, ADR 0017). Shared by the `flight-status` Edge Function, which builds
// these from the provider's answer, and the app, which validates the function's response and turns
// it into the status pill and the updated gate and terminal.
//
// Instants are ISO strings in UTC. Gates and terminals are null when the provider doesn't know
// them: the app keeps the booked value then.

import { z } from 'zod';

const instant = z.iso.datetime({ offset: true });
const maybe = z.string().trim().min(1).nullable();

/**
 * - `active`: scheduled, boarding or in the air; `delayMinutes` says how late.
 * - `landed`, `cancelled`, `diverted`: final states.
 */
export const flightStateSchema = z.enum(['active', 'landed', 'cancelled', 'diverted']);
export type FlightState = z.infer<typeof flightStateSchema>;

const movementSchema = z.object({
  terminal: maybe,
  gate: maybe,
  /** The latest estimate or actual time, when the provider has one. */
  revisedAt: instant.nullable(),
});

export const flightStatusSchema = z.object({
  state: flightStateSchema,
  /**
   * Minutes late, never negative: the departure until the plane leaves, then the arrival. Early
   * counts as 0.
   */
  delayMinutes: z.number().int().min(0),
  departure: movementSchema,
  arrival: movementSchema,
  /** When the provider last updated the flight (or when the answer was made). */
  updatedAt: instant,
});
export type FlightStatus = z.infer<typeof flightStatusSchema>;

/** What the app sends: the booked flight, so the function can check the window and pick the leg. */
export const flightStatusRequestSchema = z.object({
  /** As booked, with the airline code: `AA 2410`. */
  flightNumber: z
    .string()
    .trim()
    .regex(/^[A-Z0-9]{2,3}\s?\d{1,4}[A-Z]?$/i, 'Use a flight number like AA 2410'),
  /** The local departure date, `YYYY-MM-DD`. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** The departure airport's IATA code. */
  from: z.string().regex(/^[A-Z]{3}$/i),
  /** Booked departure and arrival instants. */
  departsAt: instant,
  arrivesAt: instant,
});
export type FlightStatusRequest = z.infer<typeof flightStatusRequestSchema>;

export type FlightStatusErrorCode =
  'not_configured' | 'outside_window' | 'limit_reached' | 'signed_out' | 'invalid' | 'failed';

/** The function's answer: a status (null when the provider doesn't know the flight) or an error. */
export type FlightStatusResponse =
  { status: FlightStatus | null } | { error: FlightStatusErrorCode; message: string };

const HOUR = 60 * 60 * 1000;

/** Live status starts 24 hours before the booked departure… */
export const WINDOW_BEFORE_MS = 24 * HOUR;
/** …and ends 2 hours after the booked arrival, so a delay and the landing still show. */
export const WINDOW_AFTER_MS = 2 * HOUR;

/** True while a flight is in its live-status window. Outside it, screens show the booking. */
export function inStatusWindow(departsAt: Date, arrivesAt: Date, instantNow: Date): boolean {
  const t = instantNow.getTime();
  return t >= departsAt.getTime() - WINDOW_BEFORE_MS && t <= arrivesAt.getTime() + WINDOW_AFTER_MS;
}

/** `AA 2410`, `aa2410` → `AA2410`: the form providers and the cache use. */
export function normalizeFlightNumber(flightNumber: string): string {
  return flightNumber.replace(/\s+/g, '').toUpperCase();
}

/** Reads the function's `status` field; anything malformed counts as "no live status". */
export function readFlightStatus(value: unknown): FlightStatus | null {
  const parsed = flightStatusSchema.nullable().safeParse(value);
  return parsed.success ? parsed.data : null;
}
