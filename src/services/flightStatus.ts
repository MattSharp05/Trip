import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { now } from '@/core/clock';
import { instantIn } from '@/core/dates';
import { demoFlightStatus } from '@/scenarios/fixtures/flightStatus';
import { queryClient } from '@/services/data/hooks';
import type { FlightData, LocalDateTime } from '@/services/data/types';
import { useScenarioStore } from '@/stores/scenario';

import {
  inStatusWindow,
  readFlightStatus,
  WINDOW_AFTER_MS,
  WINDOW_BEFORE_MS,
  type FlightStatus,
  type FlightStatusRequest,
} from '../../supabase/functions/_shared/flightStatus/schema';
import { invokeFunction } from './functions';

export type { FlightStatus, FlightStatusRequest };

/** The function caches answers for 10 minutes; asking more often would only read its cache. */
export const STATUS_REFRESH_MS = 10 * 60 * 1000;

const instant = (at: LocalDateTime) => instantIn(at.timezone, at.date, at.time);

/** What `flight-status` needs to know about a booked flight. */
export function flightStatusRequest(flight: FlightData): FlightStatusRequest {
  return {
    flightNumber: flight.flightNumber,
    date: flight.departs.date,
    from: flight.from.code,
    departsAt: instant(flight.departs),
    arrivesAt: instant(flight.arrives),
  };
}

/** The flight's live-status window, as instants. */
function windowOf(request: FlightStatusRequest) {
  return { departsAt: new Date(request.departsAt), arrivesAt: new Date(request.arrivesAt) };
}

/** True while the flight is in its live-status window (24 h before departure to 2 h after arrival). */
export function isStatusLive(flight: FlightData, instantNow: Date = now()): boolean {
  const { departsAt, arrivesAt } = windowOf(flightStatusRequest(flight));
  return inStatusWindow(departsAt, arrivesAt, instantNow);
}

/** Asks the `flight-status` Edge Function; any error (not set up, allowance used) throws. */
export async function fetchFlightStatus(
  request: FlightStatusRequest,
): Promise<FlightStatus | null> {
  const body = await invokeFunction<{ status?: unknown }>('flight-status', { ...request });
  return readFlightStatus(body.status);
}

/** setTimeout's longest delay (about 24.8 days); later edges are re-checked when it fires. */
const MAX_TIMER_MS = 2 ** 31 - 1;

/** Re-renders when the window opens or closes, so an open screen starts and stops by itself. */
function useWindowEdges(request: FlightStatusRequest | null): void {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!request) return;
    const { departsAt, arrivesAt } = windowOf(request);
    const t = now().getTime();
    const edges = [
      departsAt.getTime() - WINDOW_BEFORE_MS,
      arrivesAt.getTime() + WINDOW_AFTER_MS + 1,
    ];
    const next = edges.find((edge) => edge > t);
    if (next === undefined) return;
    const timer = setTimeout(() => setTick((n) => n + 1), Math.min(next - t, MAX_TIMER_MS));
    return () => clearTimeout(timer);
  }, [request?.departsAt, request?.arrivesAt]); // eslint-disable-line react-hooks/exhaustive-deps
}

/**
 * A booked flight's live status, refreshed every 10 minutes inside its window and null outside it.
 * A demo session (scenario) gets a deterministic fixture status and never calls the function.
 * Errors stay quiet: the screens then show the booked details without a pill.
 */
export function useFlightStatus(flight: FlightData | null | undefined): FlightStatus | null {
  const scenario = useScenarioStore((s) => s.active);
  const request = flight ? flightStatusRequest(flight) : null;
  useWindowEdges(request);
  const live = request
    ? inStatusWindow(windowOf(request).departsAt, windowOf(request).arrivesAt, now())
    : false;
  const { data } = useQuery(
    {
      queryKey: [
        'flight-status',
        scenario ?? 'live',
        request?.flightNumber,
        request?.date,
        request?.from,
      ],
      queryFn: (): Promise<FlightStatus | null> => {
        if (!request) return Promise.resolve(null);
        if (scenario) return Promise.resolve(demoFlightStatus(scenario, request));
        return fetchFlightStatus(request);
      },
      enabled: live,
      staleTime: STATUS_REFRESH_MS,
      // Polls only while the window is open, checked at each tick.
      refetchInterval: () =>
        !scenario &&
        request &&
        inStatusWindow(windowOf(request).departsAt, windowOf(request).arrivesAt, now())
          ? STATUS_REFRESH_MS
          : false,
      retry: false,
    },
    queryClient,
  );
  return live ? (data ?? null) : null;
}
