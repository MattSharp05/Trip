import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';

import TabLayout from '../app/(tabs)/_layout';
import OrganizeScreen from '../app/(tabs)/organize/index';
import PlanScreen from '../app/(tabs)/plan/index';
import TripsScreen from '../app/(tabs)/trips/index';
import ScenarioRoute from '../app/scenario/[name]';
import RootLayout from '../app/_layout';
import { setNow } from '@/core/clock';
import { resetFakeAuth } from '@/features/auth/testing';
import { exitScenario } from '@/scenarios';
import { DEFAULT_TODAY } from '@/scenarios/registry';
import { vegasSnapshot } from '@/scenarios/fixtures/vegas';
import { useActiveSource } from '@/services/data/active';
import { queryClient } from '@/services/data/hooks';
import { createDemoSource } from '@/services/data/source';
import { useSelectionStore } from '@/stores/selection';
import { useTripStore } from '@/stores/trip';

jest.mock('@/services/supabase', () => ({
  supabase: { auth: require('@/features/auth/testing').fakeAuth },
}));
jest.mock('@/services/photos', () => ({ findCoverPhoto: async () => null }));

const mockStore = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => void mockStore.set(key, value)),
  deleteItemAsync: jest.fn(async (key: string) => void mockStore.delete(key)),
}));

const routes = {
  _layout: RootLayout,
  '(tabs)/_layout': TabLayout,
  '(tabs)/trips/index': TripsScreen,
  '(tabs)/plan/index': PlanScreen,
  '(tabs)/organize/index': OrganizeScreen,
  '(tabs)/discover/index': () => null,
  'dev/gallery': () => null,
  'auth/index': () => null,
  'scenario/[name]': ScenarioRoute,
};

beforeEach(() => {
  resetFakeAuth(null);
  mockStore.clear();
  global.fetch = jest.fn(async () => {
    throw new Error('offline');
  }) as unknown as typeof fetch;
});
afterEach(() => act(() => exitScenario()));

async function openPlan(scenario: string) {
  renderRouter(routes, { initialUrl: `/scenario/${scenario}` });
  return screen.findByTestId('day-header-weather');
}

/** Waits for the Plan title to read `label` (city and dates; a skeleton shows while a trip loads). */
const inHeader = (label: string) =>
  waitFor(() => expect(screen.getByTestId('plan-trip-title').props.accessibilityLabel).toBe(label));
/** Tap a header's trip title, then a trip in its switcher. */
async function switchTo(title: string, tripId: string) {
  fireEvent.press(screen.getByTestId(title));
  fireEvent.press(await screen.findByTestId(`${title}-switcher-${tripId}`));
}

describe('Trip switcher on Plan', () => {
  it('lists upcoming trips, then past ones, with a check on the current trip', async () => {
    await openPlan('vegas-plan-day-2');
    fireEvent.press(screen.getByTestId('plan-trip-title'));
    await screen.findByTestId('plan-trip-title-switcher-trip-vegas');
    const sheet = within(screen.getByTestId('plan-trip-title-switcher'));
    expect(sheet.getByText('Upcoming')).toBeOnTheScreen();
    expect(sheet.getByText('Past')).toBeOnTheScreen();
    const rows = sheet.queryAllByTestId(/^plan-trip-title-switcher-trip-[a-z-]+$/);
    expect(rows.map((row) => row.props.accessibilityLabel)).toEqual([
      'Las Vegas, Nov 12 – Nov 16, 2026',
      'Cape Town, Dec 18, 2026 – Jan 6, 2027',
      'Tokyo, Mar 20 – Mar 29, 2027',
      'New York, Oct 16 – Oct 20, 2026',
    ]);
    const vegas = sheet.getByTestId('plan-trip-title-switcher-trip-vegas');
    expect(vegas.props.accessibilityState.selected).toBe(true);
    const newYork = sheet.getByTestId('plan-trip-title-switcher-trip-new-york');
    expect(newYork.props.accessibilityState.selected).toBe(false);
  });

  it('switching to New York shows its empty plan from its first day; Organize follows', async () => {
    await openPlan('vegas-plan-day-2');
    await switchTo('plan-trip-title', 'trip-new-york');

    expect(useTripStore.getState().selectedTripId).toBe('trip-new-york');
    await inHeader('New York, Oct 16 – Oct 20, 2026');
    await waitFor(() =>
      expect(screen.getByTestId('day-header-title').props.children).toBe('Fri, Oct 16'),
    );
    expect(useSelectionStore.getState()).toMatchObject({
      tripId: 'trip-new-york',
      selectedDay: '2026-10-16',
      selectedItemId: null,
    });
    expect(await screen.findByTestId('itinerary-free-day')).toBeOnTheScreen();

    act(() => {
      require('expo-router').router.navigate('/organize');
    });
    const organizeTitle = await screen.findByTestId('organize-trip-title');
    expect(within(organizeTitle).getByText('New York · Oct 16 – Oct 20, 2026')).toBeOnTheScreen();
  });

  it('switching back to a trip underway opens on today, not the scenario day', async () => {
    // vegas-free-day opens on Sat Nov 14; "today" is Fri Nov 13.
    await openPlan('vegas-free-day');
    expect(screen.getByTestId('day-header-title').props.children).toBe('Sat, Nov 14');
    await switchTo('plan-trip-title', 'trip-tokyo');
    await inHeader('Tokyo, Mar 20 – Mar 29, 2027');
    expect(useSelectionStore.getState().selectedDay).toBe('2027-03-20');

    await switchTo('plan-trip-title', 'trip-vegas');
    await inHeader('Las Vegas, Nov 12 – Nov 16, 2026');
    expect(useSelectionStore.getState().selectedDay).toBe('2026-11-13');
  });

  it('choosing the current trip only closes the sheet', async () => {
    await openPlan('vegas-plan-day-2');
    fireEvent.press(screen.getByTestId('pill-2026-11-15'));
    await switchTo('plan-trip-title', 'trip-vegas');
    expect(useSelectionStore.getState().selectedDay).toBe('2026-11-15');
  });
});

describe('Trip switcher on Organize', () => {
  it('shows the trip under the title and switches from there', async () => {
    renderRouter(routes, { initialUrl: '/scenario/vegas-wallet' });
    const title = await screen.findByTestId('organize-trip-title');
    expect(within(title).getByText('Las Vegas · Nov 12 – Nov 16, 2026')).toBeOnTheScreen();
    await switchTo('organize-trip-title', 'trip-cape-town');
    expect(await screen.findByText('Cape Town · Dec 18, 2026 – Jan 6, 2027')).toBeOnTheScreen();
    expect(useTripStore.getState().selectedTripId).toBe('trip-cape-town');
  });
});

describe('On a real account', () => {
  // The demo fixtures behind a source that reports itself as Supabase, so the choice is remembered.
  const account = { ...createDemoSource(vegasSnapshot, 'account'), kind: 'supabase' as const };

  beforeEach(() => {
    setNow(DEFAULT_TODAY);
    queryClient.clear();
    act(() => useActiveSource.getState().setSource(account));
  });

  it('the chosen trip survives a restart', async () => {
    act(() => useTripStore.getState().selectTrip('trip-vegas'));
    const first = renderRouter(
      { '(tabs)/plan/index': PlanScreen, '(tabs)/trips/index': TripsScreen },
      { initialUrl: '/plan' },
    );
    await screen.findByTestId('plan-trip-title');
    await switchTo('plan-trip-title', 'trip-tokyo');
    await waitFor(() => expect(mockStore.get('trip.selectedTripId')).toBe('trip-tokyo'));
    first.unmount();

    // A relaunch: nothing selected in memory; the app opens on Trips, which restores the choice.
    act(() => useTripStore.getState().selectTrip(null));
    queryClient.clear();
    renderRouter(
      { '(tabs)/plan/index': PlanScreen, '(tabs)/trips/index': TripsScreen },
      { initialUrl: '/trips' },
    );
    await waitFor(() => expect(useTripStore.getState().selectedTripId).toBe('trip-tokyo'));
  });
});
