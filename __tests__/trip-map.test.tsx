import { render } from '@testing-library/react-native';
import { act, fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
import { createRef } from 'react';
import * as maps from 'react-native-maps';

import TabLayout from '../app/(tabs)/_layout';
import PlanScreen from '../app/(tabs)/plan/index';
import TripsScreen from '../app/(tabs)/trips/index';
import ScenarioRoute from '../app/scenario/[name]';
import RootLayout from '../app/_layout';
import { FLY_MS, TripMap, type MapPin, type TripMapHandle } from '@/features/map';
import { AppleGlobe } from '@/features/map/globe';
import { resetFakeAuth } from '@/features/auth/testing';
import { exitScenario } from '@/scenarios';

// Signed out: scenario links get through the auth gate on their own (TR-7).
jest.mock('@/services/supabase', () => ({
  supabase: { auth: require('@/features/auth/testing').fakeAuth },
}));

// The automatic Jest mock (__mocks__/react-native-maps.tsx) records camera calls.
const calls = (maps as unknown as { mapCalls: { method: string; args: any[] }[] }).mapCalls;

const routes = {
  _layout: RootLayout,
  '(tabs)/_layout': TabLayout,
  '(tabs)/trips/index': TripsScreen,
  '(tabs)/plan/index': PlanScreen,
  '(tabs)/organize/index': () => null,
  '(tabs)/discover/index': () => null,
  'dev/gallery': () => null,
  'auth/index': () => null,
  'scenario/[name]': ScenarioRoute,
};

const FRIDAY = ['place-mon-ami-gabi', 'place-bellagio', 'place-sphere', 'place-carbone'];

async function openPlan(scenario: string) {
  renderRouter(routes, { initialUrl: `/scenario/${scenario}` });
  return screen.findByTestId('trip-map');
}

beforeEach(() => {
  calls.length = 0;
  resetFakeAuth(null);
});
afterEach(() => act(() => exitScenario()));

describe('Plan map on vegas-plan-day-2', () => {
  it("frames Friday's four pins with the route, other days as grey dots", async () => {
    const map = await openPlan('vegas-plan-day-2');
    const region = map.props.initialRegion;
    // Every Friday stop is inside the first frame.
    for (const id of FRIDAY) {
      const { latitude, longitude } = screen.getByTestId(`pin-${id}`).props.coordinate;
      expect(Math.abs(latitude - region.latitude)).toBeLessThan(region.latitudeDelta / 2);
      expect(Math.abs(longitude - region.longitude)).toBeLessThan(region.longitudeDelta / 2);
    }
    // The frame is the day, not the whole trip: the airport (another day) is outside it.
    const las = screen.getByTestId('pin-place-las').props.coordinate;
    expect(Math.abs(las.latitude - region.latitude)).toBeGreaterThan(region.latitudeDelta / 2);

    const route = screen.getByTestId('day-route');
    expect(route.props.coordinates).toHaveLength(4);
    expect(route.props.coordinates[3]).toEqual({ latitude: 36.1073, longitude: -115.1767 });
    expect(route.props.lineDashPattern).toEqual([6, 6]);

    expect(screen.getAllByTestId('pin-dot')).toHaveLength(8);
    expect(screen.getAllByTestId('pin-photo')).toHaveLength(2);
    expect(screen.getAllByTestId('pin-symbol')).toHaveLength(2);
    expect(map.props.userInterfaceStyle).toBe('dark');
  });

  it('selects a pin, shows its label and flies to it in half a second', async () => {
    await openPlan('vegas-plan-day-2');
    expect(screen.queryByText('Sphere Experience')).toBeNull();

    fireEvent(screen.getByTestId('pin-place-sphere'), 'touchEnd');
    expect(within(screen.getByTestId('pin-place-sphere')).getByText('Sphere Experience'));
    expect(calls).toEqual([
      {
        method: 'animateCamera',
        args: [
          expect.objectContaining({ center: { latitude: 36.1207, longitude: -115.1622 } }),
          { duration: FLY_MS },
        ],
      },
    ]);
    expect(FLY_MS).toBeLessThanOrEqual(500);
  });

  it('fits the day and toggles 3D from the map buttons', async () => {
    await openPlan('vegas-plan-day-2');

    fireEvent.press(screen.getByRole('button', { name: 'Fit the day' }));
    expect(calls[0].method).toBe('fitToCoordinates');
    expect(calls[0].args[0]).toHaveLength(4);
    expect(calls[0].args[1]).toMatchObject({ animated: true, edgePadding: { top: 56 } });

    fireEvent.press(screen.getByRole('button', { name: '3D' }));
    expect(calls[1].args[0]).toEqual({ pitch: 60 });
    expect(screen.getByRole('button', { name: '3D' })).toBeSelected();

    // In 3D, fly-to keeps the tilt.
    fireEvent(screen.getByTestId('pin-place-carbone'), 'touchEnd');
    expect(calls[2].args[0]).toMatchObject({ pitch: 60 });
  });

  it('draws 40 full pins on the crowded day', async () => {
    await openPlan('vegas-map-40-pins');
    const full = [...screen.getAllByTestId('pin-photo'), ...screen.getAllByTestId('pin-symbol')];
    expect(full).toHaveLength(40);
    expect(screen.getByTestId('day-route').props.coordinates).toHaveLength(40);
  });
});

describe('TripMap handle', () => {
  const pins: MapPin[] = [
    { id: 'a', coordinate: { lat: 36.1, lng: -115.1 }, kind: 'food', photo: null, label: 'A' },
    { id: 'b', coordinate: { lat: 36.2, lng: -115.2 }, kind: 'bar', photo: null, label: 'B' },
  ];

  function renderMap() {
    const ref = createRef<TripMapHandle>();
    const onPinPress = jest.fn();
    render(
      <TripMap
        ref={ref}
        pins={pins}
        routeIds={['a', 'b']}
        selectedId={null}
        dimmedIds={[]}
        onPinPress={onPinPress}
      />,
    );
    return { map: ref.current!, onPinPress };
  }

  it('fitTo frames the given pins and ignores unknown ids', () => {
    const { map } = renderMap();
    map.fitTo(['nope']);
    expect(calls).toHaveLength(0);

    map.fitTo(['a', 'b', 'nope']);
    expect(calls[0]).toMatchObject({
      method: 'fitToCoordinates',
      args: [
        [
          { latitude: 36.1, longitude: -115.1 },
          { latitude: 36.2, longitude: -115.2 },
        ],
        { animated: true },
      ],
    });
  });

  it('fitTo with one pin flies to it instead of zooming to street level', () => {
    const { map } = renderMap();
    map.fitTo(['b', 'b']);
    expect(calls[0]).toMatchObject({
      method: 'animateCamera',
      args: [
        { center: { latitude: 36.2, longitude: -115.2 }, altitude: 1500 },
        { duration: FLY_MS },
      ],
    });
  });

  it('flyTo ignores unknown pins; pressing a pin reports its id', () => {
    const { map, onPinPress } = renderMap();
    map.flyTo('nope');
    expect(calls).toHaveLength(0);
    fireEvent(screen.getByTestId('pin-b'), 'touchEnd');
    expect(onPinPress).toHaveBeenCalledWith('b');
  });

  it('re-frames when the route changes', () => {
    const view = (routeIds: string[]) => (
      <TripMap pins={pins} routeIds={routeIds} selectedId={null} dimmedIds={[]} />
    );
    const { rerender } = render(view(['a', 'b']));
    expect(calls).toHaveLength(0);
    rerender(view(['b']));
    expect(calls[0]).toMatchObject({ method: 'animateCamera' });
  });
});

it('the Apple globe from the spike still renders, with its flight arc', () => {
  const onReady = jest.fn();
  render(<AppleGlobe onReady={onReady} />);
  expect(screen.getByTestId('apple-globe').props.mapType).toBe('hybridFlyover');
});
