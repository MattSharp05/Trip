import { act, fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
import { render } from '@testing-library/react-native';
import { AccessibilityInfo, FlatList } from 'react-native';

import TabLayout from '../app/(tabs)/_layout';
import OrganizeLayout from '../app/(tabs)/organize/_layout';
import PlanScreen from '../app/(tabs)/plan/index';
import ScenarioRoute from '../app/scenario/[name]';
import RootLayout from '../app/_layout';
import { along, greatCircle } from '@/core/flights';
import { resetFakeAuth } from '@/features/auth/testing';
import { AppleGlobe, flight as sample } from '@/features/map/globe';
import { exitScenario } from '@/scenarios';

jest.mock('@/services/supabase', () => ({
  supabase: { auth: require('@/features/auth/testing').fakeAuth },
}));

const routes = {
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

const TPA = { latitude: 27.9755, longitude: -82.5332 };
const LAS = { latitude: 36.084, longitude: -115.1537 };

async function openPlan(scenario: string) {
  const router = renderRouter(routes, { initialUrl: `/scenario/${scenario}` });
  await screen.findByTestId('trip-map');
  return router;
}

const arc = () => screen.getByTestId('globe-arc').props.coordinates as (typeof TPA)[];
const near = (p: typeof TPA) => ({
  latitude: expect.closeTo(p.latitude, 9),
  longitude: expect.closeTo(p.longitude, 9),
});

let scrollToIndex: jest.SpyInstance;

beforeEach(() => {
  resetFakeAuth(null);
  scrollToIndex = jest.spyOn(FlatList.prototype, 'scrollToIndex').mockImplementation(() => {});
});
afterEach(() => {
  scrollToIndex.mockRestore();
  jest.restoreAllMocks();
  act(() => exitScenario());
});

describe('Plan on a travel day', () => {
  it('tapping "Arrive in Las Vegas" shows TPA → LAS on the globe and the AA 2410 card', async () => {
    await openPlan('vegas-flight-day');
    expect(screen.queryByTestId('flight-globe')).toBeNull();
    fireEvent.press(screen.getByTestId('itinerary-row-item-01'));

    expect(screen.getByTestId('flight-globe')).toBeTruthy();
    expect(screen.queryByTestId('trip-map')).toBeNull();
    expect(screen.getByTestId('flight-globe-map').props.mapType).toBe('hybridFlyover');
    expect(arc()[0]).toEqual(near(TPA));
    expect(arc()[arc().length - 1]).toEqual(near(LAS));
    expect(screen.getByTestId('globe-end-TPA')).toBeTruthy();
    expect(screen.getByTestId('globe-end-LAS')).toBeTruthy();
    expect(screen.getByTestId('globe-plane')).toBeTruthy();

    const card = within(screen.getByTestId('flight-card'));
    expect(card.getByText('AA 2410')).toBeTruthy();
    expect(card.getByText('TPA')).toBeTruthy();
    expect(card.getByText('Tampa')).toBeTruthy();
    expect(card.getByText('LAS')).toBeTruthy();
    expect(card.getByText('Las Vegas')).toBeTruthy();
    expect(card.getByText('9:05 AM')).toBeTruthy();
    expect(card.getByText('11:02 AM')).toBeTruthy();
    // The card sits at the top of the sheet, over the day header.
    expect(within(screen.getByTestId('plan-sheet')).getByTestId('flight-card')).toBeTruthy();
    // TR-26 fills the status slot; it's empty until then.
    expect(screen.getByTestId('flight-card-status').props.children).toBeUndefined();
  });

  it('the plane button shows the flight, and the Map pill goes back to the city map', async () => {
    await openPlan('vegas-flight-day');
    fireEvent.press(screen.getByRole('button', { name: 'Show the flight' }));
    expect(screen.getByTestId('flight-globe')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Map' }));
    expect(screen.getByTestId('trip-map')).toBeTruthy();
    expect(screen.queryByTestId('flight-globe')).toBeNull();
    expect(screen.queryByTestId('flight-card')).toBeNull();
  });

  it('Mon 16 shows LAS → TPA and AA 2411', async () => {
    await openPlan('vegas-flight-home');
    fireEvent.press(screen.getByRole('button', { name: 'Show the flight' }));
    expect(arc()[0]).toEqual(near(LAS));
    expect(arc()[arc().length - 1]).toEqual(near(TPA));
    expect(within(screen.getByTestId('flight-card')).getByText('AA 2411')).toBeTruthy();
  });

  it('another day, or another stop, goes back to the map', async () => {
    await openPlan('vegas-flight-day');
    fireEvent.press(screen.getByTestId('itinerary-row-item-01'));
    fireEvent.press(screen.getByTestId('itinerary-row-item-02'));
    expect(screen.getByTestId('trip-map')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Show the flight' }));
    fireEvent.press(screen.getByText('13'));
    expect(screen.getByTestId('trip-map')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Show the flight' })).toBeNull();
  });

  it('tapping the card opens the flight details', async () => {
    const router = await openPlan('vegas-flight-day');
    fireEvent.press(screen.getByTestId('itinerary-row-item-01'));
    fireEvent.press(screen.getByTestId('flight-card'));
    await act(async () => {});
    expect(router.getPathname()).toBe('/organize/flight/booking-flight-out');
  });
});

it('a day without a flight has no plane button', async () => {
  await openPlan('vegas-plan-day-2');
  expect(screen.queryByRole('button', { name: 'Show the flight' })).toBeNull();
});

describe('the plane', () => {
  const route = greatCircle(sample.from, sample.to);
  const plane = () => screen.getByTestId('globe-plane').props.coordinate;
  const at = (t: number) => {
    const p = along(route, t).at;
    return { latitude: p.lat, longitude: p.lng };
  };

  it('waits at the midpoint with Reduce Motion on', async () => {
    jest.useFakeTimers();
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    render(<AppleGlobe />);
    await act(async () => {});
    expect(plane()).toEqual(at(0.5));
    act(() => jest.advanceTimersByTime(2000));
    expect(plane()).toEqual(at(0.5));
    jest.useRealTimers();
  });

  it('flies the arc with Reduce Motion off', async () => {
    jest.useFakeTimers();
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    render(<AppleGlobe />);
    await act(async () => {});
    expect(plane()).toEqual(at(0));
    act(() => jest.advanceTimersByTime(3500));
    expect(plane().longitude).toBeLessThan(sample.from.lng);
    expect(plane().longitude).toBeGreaterThan(sample.to.lng);
    jest.useRealTimers();
  });
});
