import { renderHook, waitFor } from '@testing-library/react-native';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import TabLayout from '../app/(tabs)/_layout';
import DiscoverScreen from '../app/(tabs)/discover/index';
import OrganizeScreen from '../app/(tabs)/organize/index';
import PlanScreen from '../app/(tabs)/plan/index';
import TripsScreen from '../app/(tabs)/trips/index';
import DevIndexScreen from '../app/dev/index';
import GalleryScreen from '../app/dev/gallery';
import ScenarioRoute from '../app/scenario/[name]';
import RootLayout from '../app/_layout';
import Index from '../app/index';
import { resetFakeAuth } from '@/features/auth/testing';
import { exitScenario } from '@/scenarios';
import { useTrips } from '@/services/data';
import { useScenarioStore } from '@/stores/scenario';
import { useTripStore } from '@/stores/trip';

jest.mock('@/services/supabase', () => ({
  supabase: { auth: require('@/features/auth/testing').fakeAuth },
}));

// Signed out, like a QA tester on a fresh Expo Go: scenario links must still reach the tabs.
beforeEach(() => resetFakeAuth(null));

const routes = {
  _layout: RootLayout,
  index: Index,
  '(tabs)/_layout': TabLayout,
  '(tabs)/trips/index': TripsScreen,
  '(tabs)/plan/index': PlanScreen,
  '(tabs)/organize/index': OrganizeScreen,
  '(tabs)/discover/index': DiscoverScreen,
  'dev/index': DevIndexScreen,
  'dev/gallery': GalleryScreen,
  'scenario/[name]': ScenarioRoute,
  // Native maps don't render in Jest; the index only links to it.
  'dev/map-spike': () => null,
};

describe('scenario deep links', () => {
  afterEach(() => act(() => exitScenario()));

  it('vegas-plan-day-2 lands on Plan with Las Vegas, Nov 13 selected', async () => {
    const router = renderRouter(routes, { initialUrl: '/scenario/vegas-plan-day-2' });
    await act(async () => {});
    expect(router.getPathname()).toBe('/plan');
    expect(useTripStore.getState().selectedTripId).toBe('trip-vegas');
    expect(useScenarioStore.getState().view.day).toBe('2026-11-13');
  });

  it('empty-account lands on Trips with no trips', async () => {
    const router = renderRouter(routes, {
      initialUrl: '/scenario/empty-account?channel-name=main',
    });
    await act(async () => {});
    expect(router.getPathname()).toBe('/trips');
    expect(useScenarioStore.getState().active).toBe('empty-account');
    expect(useTripStore.getState().selectedTripId).toBeNull();
  });

  it('shows an unknown scenario instead of loading anything', async () => {
    renderRouter(routes, { initialUrl: '/scenario/vegas-day-99' });
    expect(await screen.findByText('Unknown scenario')).toBeOnTheScreen();
    expect(screen.getByText('vegas-day-99')).toBeOnTheScreen();
    expect(useScenarioStore.getState().active).toBeNull();
  });

  it('hooks read the demo session once a scenario is loaded', async () => {
    renderRouter(routes, { initialUrl: '/scenario/vegas-wallet' });
    await act(async () => {});
    const { result } = renderHook(() => useTrips());
    await waitFor(() => expect(result.current.data).toHaveLength(4));
  });
});

describe('/dev index', () => {
  afterEach(() => act(() => exitScenario()));

  it('lists every scenario and the developer screens', async () => {
    renderRouter(routes, { initialUrl: '/dev' });
    for (const name of [
      'vegas-plan-day-2',
      'vegas-flight-day',
      'vegas-bucket',
      'vegas-wallet',
      'vegas-budget-eur',
      'empty-account',
    ]) {
      expect(await screen.findByText(name)).toBeOnTheScreen();
    }
    expect(screen.getByText('Design gallery')).toBeOnTheScreen();
    expect(screen.getByText('Map spike')).toBeOnTheScreen();
  });

  it('loads a scenario when tapped', async () => {
    const router = renderRouter(routes, { initialUrl: '/dev' });
    fireEvent.press(await screen.findByText('vegas-budget-eur'));
    await act(async () => {});
    expect(router.getPathname()).toBe('/organize');
    expect(useScenarioStore.getState().view).toEqual({ organizeView: 'budget', currency: 'EUR' });
  });

  it('shows the loaded demo session and exits it', async () => {
    renderRouter(routes, { initialUrl: '/scenario/vegas-plan-day-2' });
    await act(async () => {});
    renderRouter(routes, { initialUrl: '/dev' });
    expect(await screen.findByText('Today is Fri, Nov 13, 9:00 AM')).toBeOnTheScreen();
    expect(await screen.findByText('4 trips')).toBeOnTheScreen();
    expect(await screen.findByText('Las Vegas: 15 plans, 5 bookings')).toBeOnTheScreen();
    fireEvent.press(screen.getByText('Exit demo session'));
    await act(async () => {});
    expect(useScenarioStore.getState().active).toBeNull();
    expect(screen.queryByText('DEMO SESSION')).toBeNull();
  });

  it('opens the design gallery', async () => {
    const router = renderRouter(routes, { initialUrl: '/dev' });
    fireEvent.press(await screen.findByText('Design gallery'));
    await act(async () => {});
    expect(router.getPathname()).toBe('/dev/gallery');
  });
});
