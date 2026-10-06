import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { AccessibilityInfo } from 'react-native';
import * as maps from 'react-native-maps';

import TabLayout from '../app/(tabs)/_layout';
import PlanScreen from '../app/(tabs)/plan/index';
import TripsScreen from '../app/(tabs)/trips/index';
import ScenarioRoute from '../app/scenario/[name]';
import RootLayout from '../app/_layout';
import { resetFakeAuth } from '@/features/auth/testing';
import { exitScenario } from '@/scenarios';
import { useTripStore } from '@/stores/trip';

// Signed out: scenario links get through the auth gate on their own (TR-7).
jest.mock('@/services/supabase', () => ({
  supabase: { auth: require('@/features/auth/testing').fakeAuth },
}));

// The automatic Jest mock (__mocks__/react-native-maps.tsx) records camera calls. renderRouter
// turns on Jest's fake timers, so time is moved on by hand.
const calls = (maps as unknown as { mapCalls: { method: string; args: any[] }[] }).mapCalls;
const setCameraCalls = () => calls.filter((c) => c.method === 'setCamera');

const routes = {
  _layout: RootLayout,
  '(tabs)/_layout': TabLayout,
  '(tabs)/trips/index': TripsScreen,
  '(tabs)/plan/index': PlanScreen,
  '(tabs)/organize/index': () => null,
  '(tabs)/discover/index': () => null,
  'auth/index': () => null,
  'scenario/[name]': ScenarioRoute,
};

const dots = () =>
  screen.getAllByTestId(/^globe-trip-/).map((dot) => dot.props.testID.replace('globe-trip-', ''));

function reduceMotion(enabled: boolean) {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(enabled);
}

async function openTrips() {
  const router = renderRouter(routes, { initialUrl: '/scenario/vegas-trips' });
  const map = await screen.findByTestId('trips-globe-map');
  return { router, map };
}

beforeEach(() => {
  calls.length = 0;
  resetFakeAuth(null);
  reduceMotion(false);
});
afterEach(() => {
  act(() => exitScenario());
  jest.restoreAllMocks();
});

describe('Trips globe on vegas-trips', () => {
  it("is Apple's satellite globe, opening on the next trip", async () => {
    const { map } = await openTrips();
    expect(map.props.mapType).toBe('hybridFlyover');
    expect(map.props.initialCamera.center.longitude).toBeCloseTo(-115.17, 1);
    expect(map.props.initialCamera.altitude).toBeGreaterThan(10_000_000);
  });

  it('has a labelled dot per trip shown below, following Upcoming / Past / All', async () => {
    await openTrips();
    // Today is Fri Nov 13 2026: Las Vegas is under way, New York is over.
    expect(dots()).toEqual(['trip-vegas', 'trip-cape-town', 'trip-tokyo']);
    expect(screen.getByTestId('globe-trip-trip-vegas')).toHaveTextContent('Las Vegas');

    fireEvent.press(screen.getByRole('tab', { name: 'All' }));
    expect(dots()).toEqual(['trip-new-york', 'trip-vegas', 'trip-cape-town', 'trip-tokyo']);
    fireEvent.press(screen.getByRole('tab', { name: 'Past' }));
    expect(dots()).toEqual(['trip-new-york']);
  });

  it('tapping a dot selects that trip and opens its plan', async () => {
    const { router } = await openTrips();
    act(() => useTripStore.getState().selectTrip(null));
    fireEvent(screen.getByTestId('globe-trip-trip-vegas'), 'touchEnd');
    await act(async () => {});
    expect(useTripStore.getState().selectedTripId).toBe('trip-vegas');
    expect(router.getPathname()).toBe('/plan');
  });

  it('turns slowly once the map is ready', async () => {
    const { map } = await openTrips();
    await act(async () => {});
    expect(setCameraCalls()).toHaveLength(0);
    act(() => map.props.onMapReady());
    await waitFor(() => expect(setCameraCalls().length).toBeGreaterThan(1));
    const [first] = setCameraCalls();
    const last = setCameraCalls()[setCameraCalls().length - 1];
    expect(last.args[0].center.longitude).toBeLessThan(first.args[0].center.longitude);
  });

  it('stays still with Reduce Motion on', async () => {
    reduceMotion(true);
    const { map } = await openTrips();
    await act(async () => {});
    act(() => map.props.onMapReady());
    act(() => jest.advanceTimersByTime(2000));
    expect(setCameraCalls()).toHaveLength(0);
  });

  it('stops turning when Reduce Motion is switched on', async () => {
    const listeners: ((on: boolean) => void)[] = [];
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((
      _event: string,
      listener: (on: boolean) => void,
    ) => {
      listeners.push(listener);
      return { remove: () => {} };
    }) as never);
    const { map } = await openTrips();
    await act(async () => {});
    act(() => map.props.onMapReady());
    await waitFor(() => expect(setCameraCalls().length).toBeGreaterThan(0));

    act(() => listeners.forEach((l) => l(true)));
    calls.length = 0;
    act(() => jest.advanceTimersByTime(2000));
    expect(setCameraCalls()).toHaveLength(0);
  });
});

it('shows no globe for a new account', async () => {
  renderRouter(routes, { initialUrl: '/scenario/empty-account' });
  expect(await screen.findByText('Plan your first trip')).toBeOnTheScreen();
  expect(screen.queryByTestId('trips-globe')).toBeNull();
});
