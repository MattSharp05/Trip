import { useQuery } from '@tanstack/react-query';

import { now } from '@/core/clock';
import { instantIn } from '@/core/dates';
import { demoFlightStatus } from '@/scenarios/fixtures/flightStatus';
import { queryClient } from '@/services/data/hooks';
import type { FlightData, LocalDateTime } from '@/services/data/types';
import { useScenarioStore } from '@/stores/scenario';

import {
  inStatusWindow,
  readFlightStatus,
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

/** True while the flight is in its live-status window (24 h before departure to 2 h after arrival). */
export function isStatusLive(flight: FlightData, instantNow: Date = now()): boolean {
  const req = flightStatusRequest(flight);
  return inStatusWindow(new Date(req.departsAt), new Date(req.arrivesAt), instantNow);
}

/** Asks the `flight-status` Edge Function; any error (not set up, allowance used) throws. */
export async function fetchFlightStatus(
  request: FlightStatusRequest,
): Promise<FlightStatus | null> {
  const body = await invokeFunction<{ status?: unknown }>('flight-status', { ...request });
  return readFlightStatus(body.status);
}

/**
 * A booked flight's live status, refreshed every 10 minutes inside its window and null outside it.
 * A demo session (scenario) gets a deterministic fixture status and never calls the function.
 * Errors stay quiet: the screens then show the booked details without a pill.
 */
export function useFlightStatus(flight: FlightData | null | undefined): FlightStatus | null {
  const scenario = useScenarioStore((s) => s.active);
  const live = flight ? isStatusLive(flight) : false;
  const request = flight && live ? flightStatusRequest(flight) : null;
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
      enabled: request !== null,
      staleTime: STATUS_REFRESH_MS,
      refetchInterval: scenario ? false : STATUS_REFRESH_MS,
      retry: false,
    },
    queryClient,
  );
  return live ? (data ?? null) : null;
}
