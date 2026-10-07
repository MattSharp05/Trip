import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import OrganizeLayout from '../app/(tabs)/organize/_layout';
import OrganizeRoute from '../app/(tabs)/organize/index';
import PlanScreen from '../app/(tabs)/plan/index';
import { exitScenario, loadScenario } from '@/scenarios';
import { useActiveSource } from '@/services/data/active';
import { queryClient } from '@/services/data/hooks';
import type { DataSource } from '@/services/data/source';
import { useTripStore } from '@/stores/trip';

jest.mock('@/services/supabase', () => ({
  supabase: { auth: require('@/features/auth/testing').fakeAuth },
}));
jest.mock('@/services/photos', () => ({ findCoverPhoto: async () => null }));

// Demo readiness (TR-35): a failed load says so and offers Try again, instead of an endless
// skeleton or an "empty" screen.

let offline = true;

/** The scenario's data, unreachable while `offline`. */
function goOffline() {
  const demo = useActiveSource.getState().source;
  const fail =
    <A extends unknown[], R>(read: (...args: A) => Promise<R>) =>
    (...args: A) =>
      offline ? Promise.reject(new Error('offline')) : read(...args);
  const flaky: DataSource = {
    ...demo,
    id: `${demo.id}:flaky`,
    getTripData: fail(demo.getTripData),
    listDocuments: fail(demo.listDocuments),
  };
  offline = true;
  act(() => {
    queryClient.clear();
    useActiveSource.getState().setSource(flaky);
  });
}

beforeEach(() => {
  act(() => {
    loadScenario('vegas-wallet');
  });
  goOffline();
});
afterEach(() => act(() => exitScenario()));

it('Plan: says the trip could not load, and loads it on Try again', async () => {
  renderRouter({ '(tabs)/plan/index': PlanScreen }, { initialUrl: '/plan' });
  expect(await screen.findByTestId('plan-error', {}, { timeout: 5000 })).toBeTruthy();
  offline = false;
  fireEvent.press(screen.getByText('Try again'));
  expect(await screen.findByTestId('plan-header')).toBeTruthy();
});

it('Plan: with no trip, points to Trips instead of a bare title', async () => {
  act(() => useTripStore.getState().selectTrip(null));
  renderRouter({ '(tabs)/plan/index': PlanScreen }, { initialUrl: '/plan' });
  expect(await screen.findByTestId('plan-no-trip')).toBeTruthy();
  expect(screen.getByText('Go to Trips')).toBeTruthy();
});

it('Organize: an unreachable wallet is an error with Try again, not an empty wallet', async () => {
  renderRouter(
    { '(tabs)/organize/_layout': OrganizeLayout, '(tabs)/organize/index': OrganizeRoute },
    { initialUrl: '/organize' },
  );
  expect(await screen.findByTestId('wallet-error', {}, { timeout: 5000 })).toBeTruthy();
  expect(screen.queryByTestId('wallet-empty')).toBeNull();
  offline = false;
  fireEvent.press(screen.getByText('Try again'));
  expect(await screen.findByTestId('wallet-card-booking-flight-out')).toBeTruthy();
});
