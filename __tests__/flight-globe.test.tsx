import { act, fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
import { render } from '@testing-library/react-native';
import { AccessibilityInfo, ScrollView } from 'react-native';

import TabLayout from '../app/(tabs)/_layout';
import OrganizeLayout from '../app/(tabs)/organize/_layout';
import PlanScreen from '../app/(tabs)/plan/index';
import ScenarioRoute from '../app/scenario/[name]';
import RootLayout from '../app/_layout';
import { along, greatCircle } from '@/core/flights';
import { resetFakeAuth } from '@/features/auth/testing';
import { AppleGlobe, flight as sample } from '@/features/map/globe';
import { exitScenario } from '@/scenarios';
import { BLAKE, WILLEM } from '@/scenarios/fixtures/group';
import { useSelectionStore } from '@/stores/selection';
import { mapColors } from '@/theme';
import { mapCalls } from '../__mocks__/react-native-maps';

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
  const router = await renderRouter(routes, { initialUrl: `/scenario/${scenario}` });
  await screen.findByTestId('trip-map');
  return router;
}

const arc = () => screen.getByTestId('globe-arc').props.coordinates as (typeof TPA)[];
const near = (p: typeof TPA) => ({
  latitude: expect.closeTo(p.latitude, 9),
  longitude: expect.closeTo(p.longitude, 9),
});

let scrollTo: jest.SpyInstance;

beforeEach(() => {
  resetFakeAuth(null);
  scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(() => {});
});
afterEach(() => {
  scrollTo.mockRestore();
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
    // TR-26: the status slot holds the live status pill (the demo status: on time).
    expect(
      await within(screen.getByTestId('flight-card-status')).findByText('On time'),
    ).toBeTruthy();
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

describe('converging flight paths (TR-63)', () => {
  const ORD = { latitude: 41.9742, longitude: -87.9073 };
  const JFK = { latitude: 40.6413, longitude: -73.7781 };
  const line = (testID: string) => screen.getByTestId(testID).props;
  const ends = (testID: string) => {
    const coords = line(testID).coordinates as (typeof TPA)[];
    return [coords[0], coords[coords.length - 1]];
  };

  async function openGlobe() {
    await renderRouter(routes, { initialUrl: '/scenario/group-flight-globe' });
    await screen.findByTestId('flight-globe');
    await screen.findByTestId(`globe-arc-${BLAKE}`);
  }

  it('group-flight-globe opens on three arcs into LAS, labelled B and W', async () => {
    await openGlobe();
    expect(screen.queryByTestId('trip-map')).toBeNull();
    expect(screen.getAllByTestId(/^globe-arc/)).toHaveLength(3);
    expect(ends('globe-arc')).toEqual([near(TPA), near(LAS)]);
    expect(ends(`globe-arc-${BLAKE}`)).toEqual([near(ORD), near(LAS)]);
    expect(ends(`globe-arc-${WILLEM}`)).toEqual([near(JFK), near(LAS)]);
    // Yours is the full-weight line with the plane; the others are thinner and lighter.
    expect(line('globe-arc')).toMatchObject({ strokeColor: mapColors.route, strokeWidth: 3 });
    expect(line(`globe-arc-${BLAKE}`)).toMatchObject({
      strokeColor: mapColors.routeOther,
      strokeWidth: 2,
    });
    expect(screen.getAllByTestId('globe-plane')).toHaveLength(1);
    // Each initial sits at the traveller's home airport.
    const blake = screen.getByTestId(`globe-initial-${BLAKE}`);
    expect(blake).toHaveTextContent('B');
    expect(blake.props.coordinate).toEqual(near(ORD));
    expect(screen.getByTestId(`globe-initial-${WILLEM}`)).toHaveTextContent('W');
    // The camera opens framing every airport: centred between the coasts.
    const { center } = line('flight-globe-map').initialCamera;
    expect(center.longitude).toBeLessThan(TPA.longitude);
    expect(center.longitude).toBeGreaterThan(LAS.longitude);
  });

  it('tapping Blake in Arrivals highlights his arc, dims the rest and frames it', async () => {
    await openGlobe();
    const everyone = line('flight-globe-map').initialCamera.altitude;
    mapCalls.length = 0;
    fireEvent.press(await screen.findByTestId(`arrivals-LAS-${BLAKE}`));

    expect(useSelectionStore.getState().focusedTraveler).toBe(BLAKE);
    expect(line(`globe-arc-${BLAKE}`)).toMatchObject({
      strokeColor: mapColors.route,
      strokeWidth: 3,
    });
    expect(line(`globe-arc-${WILLEM}`).strokeColor).toBe(mapColors.routeDim);
    expect(line('globe-arc').strokeColor).toBe(mapColors.routeDim);
    expect(screen.getByTestId(`arrivals-LAS-${BLAKE}`)).toBeSelected();
    const [camera] = mapCalls.filter((c) => c.method === 'animateCamera');
    const { center, altitude } = camera.args[0] as { center: typeof TPA; altitude: number };
    // Down on Chicago → Las Vegas: between them, and closer in than the view of everyone.
    expect(center.longitude).toBeLessThan(ORD.longitude);
    expect(center.longitude).toBeGreaterThan(LAS.longitude);
    expect(altitude).toBeLessThan(everyone);

    // Blake again shows everyone alike.
    fireEvent.press(screen.getByTestId(`arrivals-LAS-${BLAKE}`));
    expect(useSelectionStore.getState().focusedTraveler).toBeNull();
    expect(line(`globe-arc-${WILLEM}`).strokeColor).toBe(mapColors.routeOther);
  });

  it('tapping a traveller on the city map opens the globe; another day clears the highlight', async () => {
    await renderRouter(routes, { initialUrl: '/scenario/group-plan-arrivals' });
    await screen.findByTestId('trip-map');
    fireEvent.press(await screen.findByTestId(`arrivals-LAS-${WILLEM}`));
    expect(screen.getByTestId('flight-globe')).toBeTruthy();
    expect(line(`globe-arc-${WILLEM}`).strokeColor).toBe(mapColors.route);
    // The globe opens already framed on New York → Las Vegas.
    const { center } = line('flight-globe-map').initialCamera;
    expect(center.longitude).toBeGreaterThan(-97);
    expect(center.longitude).toBeLessThan(JFK.longitude);

    fireEvent.press(screen.getByText('13'));
    expect(useSelectionStore.getState().focusedTraveler).toBeNull();
  });

  it('on the last day the arcs go outward from LAS', async () => {
    await renderRouter(routes, { initialUrl: '/scenario/group-plan-arrivals' });
    await screen.findByTestId('trip-map');
    fireEvent.press(screen.getByTestId('pill-2026-11-16'));
    fireEvent.press(screen.getByRole('button', { name: 'Show the flight' }));
    await screen.findByTestId(`globe-arc-${BLAKE}`);
    expect(ends('globe-arc')).toEqual([near(LAS), near(TPA)]);
    expect(ends(`globe-arc-${BLAKE}`)).toEqual([near(LAS), near(ORD)]);
    expect(ends(`globe-arc-${WILLEM}`)).toEqual([near(LAS), near(JFK)]);
    expect(screen.getByTestId(`globe-initial-${WILLEM}`).props.coordinate).toEqual(near(JFK));
  });

  it('a solo trip still shows just your flight', async () => {
    await openPlan('vegas-flight-day');
    fireEvent.press(screen.getByTestId('itinerary-row-item-01'));
    await act(async () => {});
    expect(screen.getAllByTestId(/^globe-arc/)).toHaveLength(1);
  });
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
