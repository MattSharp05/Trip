import { act, fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';

import TabLayout from '../app/(tabs)/_layout';
import DiscoverScreen from '../app/(tabs)/discover/index';
import OrganizeScreen from '../app/(tabs)/organize/index';
import PlanScreen from '../app/(tabs)/plan/index';
import TripsScreen from '../app/(tabs)/trips/index';
import ScenarioRoute from '../app/scenario/[name]';
import RootLayout from '../app/_layout';
import { resetFakeAuth } from '@/features/auth/testing';
import { exitScenario } from '@/scenarios';

// Signed out: scenario links get through the auth gate on their own (TR-7).
jest.mock('@/services/supabase', () => ({
  supabase: { auth: require('@/features/auth/testing').fakeAuth },
}));
jest.mock('@/services/photos', () => ({ findCoverPhoto: async () => null }));

const routes = {
  _layout: RootLayout,
  '(tabs)/_layout': TabLayout,
  '(tabs)/trips/index': TripsScreen,
  '(tabs)/plan/index': PlanScreen,
  '(tabs)/organize/index': OrganizeScreen,
  '(tabs)/discover/index': DiscoverScreen,
  'dev/gallery': () => null,
  'auth/index': () => null,
  'scenario/[name]': ScenarioRoute,
};

beforeEach(() => {
  resetFakeAuth(null);
  global.fetch = jest.fn(async () => {
    throw new Error('offline');
  }) as unknown as typeof fetch;
});
afterEach(() => {
  act(() => exitScenario());
});

async function open(scenario: string) {
  renderRouter(routes, { initialUrl: `/scenario/${scenario}` });
  await screen.findByTestId('day-header-weather');
}

/** The card's rows, top to bottom, as their spoken labels. */
const rows = (testID: string) =>
  within(screen.getByTestId(testID))
    .getAllByTestId(new RegExp(`^${testID}-user-[a-z]+$`))
    .map((r) => r.props.accessibilityLabel);

describe('Arrivals card (TR-58)', () => {
  it('lists everyone landing on day 1, with the pickup hint', async () => {
    await open('group-plan-arrivals');
    expect(await screen.findByTestId('arrivals-LAS')).toBeOnTheScreen();
    expect(rows('arrivals-LAS')).toEqual([
      'Matthew, AA 2410, lands 11:02 AM LAS',
      'Blake, UA 1187, lands 2:10 PM LAS',
      'Willem, B6 1123, lands 2:45 PM LAS',
    ]);
    expect(screen.getByTestId('arrivals-LAS-hint')).toHaveTextContent(
      'Blake and Willem land 35 min apart at LAS',
    );
    expect(screen.getByText('Arrivals')).toBeOnTheScreen();
    expect(screen.queryByTestId('departures-LAS')).toBeNull();
    // Your own flight keeps its itinerary row; the others' bookings stay private.
    expect(screen.getByText('Arrive in Las Vegas')).toBeOnTheScreen();
  });

  it('shows Departures on the last day, and nothing in between', async () => {
    await open('group-plan-arrivals');
    await screen.findByTestId('arrivals-LAS');
    await act(async () => fireEvent.press(screen.getByTestId('pill-2026-11-14')));
    expect(screen.queryByTestId('arrivals')).toBeNull();
    await act(async () => fireEvent.press(screen.getByTestId('pill-2026-11-16')));
    expect(await screen.findByTestId('departures-LAS')).toBeOnTheScreen();
    expect(rows('departures-LAS')).toEqual([
      'Matthew, AA 2411, leaves 1:45 PM LAS',
      'Blake, UA 2290, leaves 4:05 PM LAS',
      'Willem, B6 1124, leaves 4:30 PM LAS',
    ]);
    expect(screen.getByTestId('departures-LAS-hint')).toHaveTextContent(
      'Blake and Willem leave 25 min apart from LAS',
    );
  });

  it.each(['group-vegas', 'vegas-flight-day'])(
    'stays out of %s, where only your own flight lands',
    async (scenario) => {
      await open(scenario);
      expect((await screen.findAllByText('Arrive in Las Vegas')).length).toBeGreaterThan(0);
      expect(screen.queryByTestId('arrivals')).toBeNull();
    },
  );
});
