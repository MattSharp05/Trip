import { act, fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
import { FlatList } from 'react-native';

import TabLayout from '../app/(tabs)/_layout';
import OrganizeLayout from '../app/(tabs)/organize/_layout';
import FlightRoute from '../app/(tabs)/organize/flight/[id]';
import OrganizeRoute from '../app/(tabs)/organize/index';
import PlanScreen from '../app/(tabs)/plan/index';
import ScenarioRoute from '../app/scenario/[name]';
import RootLayout from '../app/_layout';
import { resetFakeAuth } from '@/features/auth/testing';
import { exitScenario, loadScenario } from '@/scenarios';
import { invokeFunction } from '@/services/functions';

jest.mock('@/services/supabase', () => ({
  supabase: { auth: require('@/features/auth/testing').fakeAuth },
}));
jest.mock('@/services/functions', () => ({ invokeFunction: jest.fn() }));

// TR-26: the live status pill and the updated gate, in demo sessions (fixture statuses; the
// function is never called).

const planRoutes = {
  _layout: RootLayout,
  '(tabs)/_layout': TabLayout,
  '(tabs)/trips/index': () => null,
  '(tabs)/plan/index': PlanScreen,
  '(tabs)/organize/_layout': OrganizeLayout,
  '(tabs)/organize/index': () => null,
  '(tabs)/organize/flight/[id]': () => null,
  '(tabs)/discover/index': () => null,
  'dev/gallery': () => null,
  'auth/index': () => null,
  'scenario/[name]': ScenarioRoute,
};

const organizeRoutes = {
  '(tabs)/organize/_layout': OrganizeLayout,
  '(tabs)/organize/index': OrganizeRoute,
  '(tabs)/organize/flight/[id]': FlightRoute,
};

async function openWallet(scenario: string) {
  act(() => {
    loadScenario(scenario);
  });
  renderRouter(organizeRoutes, { initialUrl: '/organize' });
  return screen.findByTestId('wallet-card-booking-flight-out');
}

async function openFlight(scenario: string) {
  fireEvent.press(await openWallet(scenario));
  await screen.findByTestId('flight-facts');
}

let scrollToIndex: jest.SpyInstance;

beforeEach(() => {
  resetFakeAuth(null);
  scrollToIndex = jest.spyOn(FlatList.prototype, 'scrollToIndex').mockImplementation(() => {});
});
afterEach(() => {
  scrollToIndex.mockRestore();
  act(() => exitScenario());
  expect(invokeFunction).not.toHaveBeenCalled();
});

describe('Live flight status', () => {
  it('shows "Delayed 25 min" on the Plan flight card', async () => {
    renderRouter(planRoutes, { initialUrl: '/scenario/vegas-flight-delayed' });
    await screen.findByTestId('trip-map');
    fireEvent.press(screen.getByTestId('itinerary-row-item-01'));
    const status = within(screen.getByTestId('flight-card-status'));
    expect(await status.findByText('Delayed 25 min')).toBeOnTheScreen();
  });

  it('shows the pill on the wallet card', async () => {
    const card = within(await openWallet('vegas-flight-delayed'));
    expect(await card.findByText('Delayed 25 min')).toBeOnTheScreen();
  });

  it('replaces the booked gate with the new one, labelled Updated', async () => {
    await openFlight('vegas-flight-delayed');
    expect(await screen.findByText('Delayed 25 min')).toBeOnTheScreen();
    const facts = within(screen.getByTestId('flight-facts'));
    expect(facts.getByText('E79')).toBeOnTheScreen();
    expect(facts.queryByText('E75')).toBeNull();
    expect(facts.getByTestId('flight-fact-updated-gate')).toHaveTextContent('Updated');
    expect(facts.queryByTestId('flight-fact-updated-terminal')).toBeNull();
  });

  it('reads On time with the booked gate on a normal travel day', async () => {
    await openFlight('vegas-flight-day');
    expect(await screen.findByText('On time')).toBeOnTheScreen();
    expect(within(screen.getByTestId('flight-facts')).getByText('E75')).toBeOnTheScreen();
    expect(screen.queryByText('Updated')).toBeNull();
  });

  it('shows booked details and no pill outside the window', async () => {
    await openWallet('vegas-wallet');
    expect(screen.queryByTestId('flight-status-pill')).toBeNull();
    fireEvent.press(screen.getByTestId('wallet-card-booking-flight-out'));
    await screen.findByTestId('flight-facts');
    expect(screen.queryByTestId('flight-status-pill')).toBeNull();
    expect(within(screen.getByTestId('flight-facts')).getByText('E75')).toBeOnTheScreen();
  });
});
