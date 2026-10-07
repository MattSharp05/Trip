import type { FlightStatus } from '@/services/flightStatus';
import type { FlightData } from '@/services/data/types';

import { flightFacts } from './flightInfo';

/**
 * What a flight's live status looks like (TR-26): one pill, and the booked gate and terminal
 * replaced by the live ones with an "Updated" label. No status (outside the window, not set up, an
 * error) means no pill and the booked details, never an error on the card.
 */

/** A departure this many minutes late or more reads "Delayed" (the US DOT's on-time line). */
export const DELAY_THRESHOLD_MINUTES = 15;

export type StatusTone = 'ok' | 'accent' | 'secondary';

export interface StatusPillModel {
  label: string;
  tone: StatusTone;
}

/** `25 min`, `1 h`, `1 h 40 min`. */
export function delayLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

const same = (a: string | null, b: string | null) =>
  (a ?? '').trim().toUpperCase() === (b ?? '').trim().toUpperCase();

/** True when the live departure gate or terminal differs from a booked one. */
export function gateChanged(flight: FlightData, status: FlightStatus): boolean {
  const { gate, terminal } = status.departure;
  return (
    (gate !== null && flight.gate !== null && !same(gate, flight.gate)) ||
    (terminal !== null && flight.terminal !== null && !same(terminal, flight.terminal))
  );
}

/**
 * The pill for a status, most important first: Cancelled, Diverted, Landed, Delayed, Gate change,
 * On time. Problems are orange (the app's one accent), on time is the semantic green.
 */
export function statusPill(
  flight: FlightData,
  status: FlightStatus | null,
): StatusPillModel | null {
  if (!status) return null;
  switch (status.state) {
    case 'cancelled':
      return { label: 'Cancelled', tone: 'accent' };
    case 'diverted':
      return { label: 'Diverted', tone: 'accent' };
    case 'landed':
      return { label: 'Landed', tone: 'secondary' };
    case 'active':
      if (status.delayMinutes >= DELAY_THRESHOLD_MINUTES) {
        return { label: `Delayed ${delayLabel(status.delayMinutes)}`, tone: 'accent' };
      }
      if (gateChanged(flight, status)) return { label: 'Gate change', tone: 'accent' };
      return { label: 'On time', tone: 'ok' };
  }
}

export interface LiveFact {
  label: string;
  value: string;
  /** The live value replaced (or filled in) the booked one. */
  updated: boolean;
}

/** The facts row with the live terminal and gate in place of the booked ones. */
export function liveFacts(flight: FlightData, status: FlightStatus | null): LiveFact[] {
  /** The live value when it says something new, else null (keep the booked one). */
  const newer = (live: string | null | undefined, booked: string | null) =>
    live && !same(live, booked) ? live : null;
  const terminal = newer(status?.departure.terminal, flight.terminal);
  const gate = newer(status?.departure.gate, flight.gate);
  const updated = new Set([terminal && 'Terminal', gate && 'Gate']);
  const withLive = { ...flight, terminal: terminal ?? flight.terminal, gate: gate ?? flight.gate };
  return flightFacts(withLive).map((fact) => ({ ...fact, updated: updated.has(fact.label) }));
}
