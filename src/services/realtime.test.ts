import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import { vegasSnapshot } from '@/scenarios/fixtures/vegas';

import { createDemoSource, dataKeys, queryClient, supabaseSource, useActiveSource } from './data';
import { LIVE_DEBOUNCE_MS, LIVE_TABLES, useTripLiveUpdates } from './realtime';
import { supabase } from './supabase';

type Binding = { filter: Record<string, string>; callback: () => void };
type FakeChannel = { name: string; bindings: Binding[]; subscribed: boolean };

const channels: FakeChannel[] = [];

jest.mock('./supabase', () => ({
  supabase: {
    channel: jest.fn((name: string) => {
      const fake = { name, bindings: [] as unknown[], subscribed: false };
      channels.push(fake as never);
      const api = {
        on: (_type: string, filter: unknown, callback: unknown) => {
          fake.bindings.push({ filter, callback });
          return api;
        },
        subscribe: () => {
          fake.subscribed = true;
          return api;
        },
        fake,
      };
      return api;
    }),
    removeChannel: jest.fn(async () => 'ok'),
  },
}));

let appStateListener: ((state: AppStateStatus) => void) | undefined;
const removeAppStateListener = jest.fn();

beforeEach(() => {
  jest.useFakeTimers();
  channels.length = 0;
  jest.mocked(supabase.channel).mockClear();
  jest.mocked(supabase.removeChannel).mockClear();
  removeAppStateListener.mockClear();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, handler) => {
    appStateListener = handler as (state: AppStateStatus) => void;
    return { remove: removeAppStateListener } as never;
  });
  useActiveSource.setState({ source: supabaseSource });
  queryClient.clear();
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

/** The fake channels passed to `supabase.removeChannel`, in order. */
function removedChannels(): FakeChannel[] {
  return jest
    .mocked(supabase.removeChannel)
    .mock.calls.map(([channel]) => (channel as unknown as { fake: FakeChannel }).fake);
}

describe('useTripLiveUpdates', () => {
  it("subscribes to the trip's channel with a filter per table", () => {
    renderHook(() => useTripLiveUpdates('trip-1'));

    expect(channels).toHaveLength(1);
    const [channel] = channels;
    expect(channel.name).toMatch(/^trip:trip-1:\d+$/);
    expect(channel.subscribed).toBe(true);
    expect(channel.bindings.map((b) => b.filter)).toEqual([
      ...LIVE_TABLES.map((table) => ({
        event: '*',
        schema: 'public',
        table,
        filter: 'trip_id=eq.trip-1',
      })),
      { event: '*', schema: 'public', table: 'trips', filter: 'id=eq.trip-1' },
    ]);
  });

  it("refetches the trip's queries once, after the debounce", () => {
    const tripKey = dataKeys.trip(supabaseSource, 'trip-1');
    const membersKey = ['data', 'supabase', 'members', 'trip-1'];
    const tripsKey = dataKeys.trips(supabaseSource);
    const otherTripKey = dataKeys.trip(supabaseSource, 'trip-2');
    const documentsKey = dataKeys.documents(supabaseSource);
    for (const key of [tripKey, membersKey, tripsKey, otherTripKey, documentsKey]) {
      queryClient.setQueryData(key, {});
    }
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    renderHook(() => useTripLiveUpdates('trip-1'));

    act(() => {
      channels[0].bindings[1].callback();
      channels[0].bindings[0].callback();
    });
    act(() => jest.advanceTimersByTime(LIVE_DEBOUNCE_MS - 1));
    expect(invalidate).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(1));
    expect(invalidate).toHaveBeenCalledTimes(1);

    const invalidated = (key: readonly unknown[]) =>
      queryClient.getQueryState(key)?.isInvalidated ?? false;
    expect(invalidated(tripKey)).toBe(true);
    expect(invalidated(membersKey)).toBe(true);
    expect(invalidated(tripsKey)).toBe(true);
    expect(invalidated(otherTripKey)).toBe(false);
    expect(invalidated(documentsKey)).toBe(false);
  });

  it('waits for a save in progress before refetching', () => {
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    const isMutating = jest.spyOn(queryClient, 'isMutating').mockReturnValue(1);
    renderHook(() => useTripLiveUpdates('trip-1'));

    act(() => channels[0].bindings[0].callback());
    act(() => jest.advanceTimersByTime(LIVE_DEBOUNCE_MS * 3));
    expect(invalidate).not.toHaveBeenCalled();

    isMutating.mockReturnValue(0);
    act(() => jest.advanceTimersByTime(LIVE_DEBOUNCE_MS));
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it('opens on the first foreground when mounted in the background', () => {
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    const currentState = AppState.currentState;
    AppState.currentState = 'background';
    try {
      renderHook(() => useTripLiveUpdates('trip-1'));
      expect(channels).toHaveLength(0);

      act(() => appStateListener?.('active'));
      expect(channels).toHaveLength(1);
      expect(invalidate).toHaveBeenCalledTimes(1);
    } finally {
      AppState.currentState = currentState;
    }
  });

  it('unsubscribes on unmount, without a pending refetch', () => {
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    const { unmount } = renderHook(() => useTripLiveUpdates('trip-1'));
    act(() => channels[0].bindings[0].callback());

    unmount();
    act(() => jest.advanceTimersByTime(LIVE_DEBOUNCE_MS));

    expect(removedChannels()).toEqual([channels[0]]);
    expect(removeAppStateListener).toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('moves to the new trip when the selected trip changes', () => {
    const { rerender } = renderHook(
      ({ tripId }: { tripId: string | null }) => useTripLiveUpdates(tripId),
      { initialProps: { tripId: 'trip-1' } },
    );

    rerender({ tripId: 'trip-2' });
    expect(removedChannels()).toEqual([channels[0]]);
    expect(channels.map((c) => c.name.replace(/:\d+$/, ''))).toEqual([
      'trip:trip-1',
      'trip:trip-2',
    ]);

    rerender({ tripId: null });
    expect(removedChannels()).toEqual([channels[0], channels[1]]);
    expect(channels).toHaveLength(2);
  });

  it('closes in the background and reopens with one refetch in the foreground', () => {
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    renderHook(() => useTripLiveUpdates('trip-1'));

    act(() => appStateListener?.('inactive'));
    expect(removedChannels()).toEqual([]);
    act(() => appStateListener?.('background'));
    expect(removedChannels()).toEqual([channels[0]]);
    expect(invalidate).not.toHaveBeenCalled();

    act(() => appStateListener?.('active'));
    expect(channels).toHaveLength(2);
    // A fresh topic: realtime-js would hand back the old channel while it is still closing.
    expect(channels[1].name).toMatch(/^trip:trip-1:\d+$/);
    expect(channels[1].name).not.toBe(channels[0].name);
    expect(invalidate).toHaveBeenCalledTimes(1);

    // Already open: coming back from `inactive` (Control Center) changes nothing.
    act(() => appStateListener?.('active'));
    expect(channels).toHaveLength(2);
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it('never subscribes in a demo session or without a trip', () => {
    renderHook(() => useTripLiveUpdates(null));
    useActiveSource.setState({ source: createDemoSource(vegasSnapshot, 'test') });
    renderHook(() => useTripLiveUpdates('trip-1'));

    expect(supabase.channel).not.toHaveBeenCalled();
  });
});
