import type { Query } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { type DataSource, dataKeys, queryClient, useDataSource } from './data';
import { supabase } from './supabase';

/** Trip-scoped tables in the `supabase_realtime` publication (migration 0054_realtime.sql). */
export const LIVE_TABLES = [
  'trip_members',
  'itinerary_items',
  'bucket_items',
  'bookings',
  'expenses',
  'places',
] as const;

/** A burst of changes (a Smart Add plan, a reorder) refetches once. */
export const LIVE_DEBOUNCE_MS = 300;

/**
 * Every query about the trip: its data (`dataKeys.trip`), and any other key under the source that
 * names the trip (members, expenses). Plus the trips list, since the trip's own row may have
 * changed (name, dates, cover).
 */
function isTripQuery(query: Query, source: DataSource, tripId: string): boolean {
  const key = query.queryKey;
  const [root, sourceId] = dataKeys.all(source);
  if (key[0] !== root || key[1] !== sourceId) return false;
  return key[2] === dataKeys.trips(source)[2] || key.slice(2).includes(tripId);
}

function refetchTrip(source: DataSource, tripId: string): void {
  void queryClient.invalidateQueries({
    predicate: (query) => isTripQuery(query, source, tripId),
  });
}

/**
 * Other members' changes to the trip appear without pulling to refresh (ADR 0028): one Realtime
 * channel for the open trip, and any change refetches the trip's queries. Deletes arrive as an
 * update of the trip's own row (the publication carries no deletes; see 0054_realtime_no_deletes).
 * The channel closes when the app goes to the background and reopens, with one refetch for what it
 * missed, when it comes back. Demo sessions (scenarios) never open one.
 */
export function useTripLiveUpdates(tripId: string | null): void {
  const source = useDataSource();

  useEffect(() => {
    if (!tripId || source.kind !== 'supabase') return;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const changed = () => {
      clearTimeout(timer);
      timer = setTimeout(() => refetchTrip(source, tripId), LIVE_DEBOUNCE_MS);
    };
    const open = () => {
      channel = supabase.channel(`trip:${tripId}`);
      for (const table of LIVE_TABLES) {
        channel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table, filter: `trip_id=eq.${tripId}` },
          changed,
        );
      }
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trips', filter: `id=eq.${tripId}` },
        changed,
      );
      channel.subscribe();
    };
    const close = () => {
      clearTimeout(timer);
      if (channel) void supabase.removeChannel(channel);
      channel = null;
    };

    open();
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        close();
      } else if (state === 'active' && !channel) {
        open();
        refetchTrip(source, tripId);
      }
    });
    return () => {
      appState.remove();
      close();
    };
  }, [source, tripId]);
}
