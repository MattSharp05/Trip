// Deterministic live statuses for demo sessions (TR-26). The `flight-status` function answers
// with these when FLIGHT_STATUS_PROVIDER=fixture, and scenario demo sessions use them in the app
// without calling the function (like the sample parses, ADR 0016).

import { normalizeFlightNumber, type FlightStatus, type FlightStatusRequest } from './schema.ts';

/** The demo trip's outbound flight, running late from a new gate (scenario vegas-flight-delayed). */
export const DEMO_DELAYS: Readonly<Record<string, { delayMinutes: number; gate: string }>> = {
  AA2410: { delayMinutes: 25, gate: 'E79' },
};

const later = (iso: string, minutes: number) =>
  new Date(Date.parse(iso) + minutes * 60_000).toISOString();

/**
 * A flight on time with the booked gate and terminal (nulls keep the booked values), or, when
 * `delayed` and the flight is in `DEMO_DELAYS`, late and moved to another gate.
 */
export function fixtureFlightStatus(
  request: Pick<FlightStatusRequest, 'flightNumber' | 'departsAt' | 'arrivesAt'>,
  delayed: boolean,
): FlightStatus {
  const delay = delayed ? DEMO_DELAYS[normalizeFlightNumber(request.flightNumber)] : undefined;
  const minutes = delay?.delayMinutes ?? 0;
  return {
    state: 'active',
    delayMinutes: minutes,
    departure: {
      terminal: null,
      gate: delay?.gate ?? null,
      revisedAt: minutes ? later(request.departsAt, minutes) : null,
    },
    arrival: {
      terminal: null,
      gate: null,
      revisedAt: minutes ? later(request.arrivesAt, minutes) : null,
    },
    updatedAt: later(request.departsAt, -60),
  };
}
