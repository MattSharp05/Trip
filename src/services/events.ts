import { useQuery } from '@tanstack/react-query';

import { queryClient } from '@/services/data/hooks';
import type { Trip } from '@/services/data/types';
import { useScenarioStore } from '@/stores/scenario';

import { fixtureEvents } from '../../supabase/functions/_shared/events/fixtures';
import {
  readEvents,
  type EventCategory,
  type EventsErrorCode,
  type EventsRequest,
  type TripEvent,
} from '../../supabase/functions/_shared/events/schema';

export type { EventCategory, EventsRequest, TripEvent };

/** The function keeps answers for 6 hours; asking sooner would only read its cache. */
export const EVENTS_STALE_MS = 6 * 60 * 60 * 1000;

export class EventsError extends Error {
  constructor(
    readonly code: EventsErrorCode,
    message: string,
  ) {
    super(message);
  }
}

const CODES: readonly EventsErrorCode[] = ['not_configured', 'invalid', 'limit_reached', 'failed'];

/** Required on first use, so demo sessions and tests never create a Supabase client. */
const client = (): (typeof import('./supabase'))['supabase'] =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('./supabase').supabase;

/** What `events` needs to know about a trip; null when the trip has no place or dates yet. */
export function eventsRequest(
  trip: Pick<Trip, 'lat' | 'lng' | 'startDate' | 'endDate'>,
): EventsRequest | null {
  const { lat, lng, startDate, endDate } = trip;
  if (lat == null || lng == null || !startDate || !endDate) return null;
  return { lat, lng, startDate, endDate };
}

/** Asks the `events` Edge Function; errors throw an EventsError with the function's code. */
export async function fetchEvents(request: EventsRequest): Promise<TripEvent[]> {
  const { data, error } = await client().functions.invoke<unknown>('events', {
    body: { ...request },
  });
  if (error) {
    // A non-2xx answer carries `{ error, message }`; anything else is a network failure.
    const context = (error as { context?: { json?: () => Promise<unknown> } }).context;
    const body = (await context?.json?.().catch(() => null)) as { error?: string } | null;
    const code = CODES.find((c) => c === body?.error) ?? 'failed';
    throw new EventsError(code, error.message);
  }
  const events = readEvents((data as { events?: unknown } | null)?.events);
  if (!events) throw new EventsError('failed', 'events returned no list');
  return events;
}

/**
 * Events near the trip on its dates, earliest first. A demo session (scenario) gets the
 * deterministic fixture events and never calls the function.
 */
export function useTripEvents(
  trip: Pick<Trip, 'id' | 'lat' | 'lng' | 'startDate' | 'endDate'> | null | undefined,
) {
  const scenario = useScenarioStore((s) => s.active);
  const request = trip ? eventsRequest(trip) : null;
  return useQuery(
    {
      queryKey: [
        'events',
        scenario ?? 'live',
        request?.lat,
        request?.lng,
        request?.startDate,
        request?.endDate,
      ],
      queryFn: (): Promise<TripEvent[]> => {
        if (!request) return Promise.resolve([]);
        if (scenario) return Promise.resolve(fixtureEvents(request));
        return fetchEvents(request);
      },
      enabled: request !== null,
      staleTime: EVENTS_STALE_MS,
      // "Not set up" won't change on a retry; a network blip might.
      retry: (count, error) =>
        count < 1 && !(error instanceof EventsError && error.code === 'not_configured'),
    },
    queryClient,
  );
}
