import BottomSheet from '@gorhom/bottom-sheet';
import { act, fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
import { Dimensions, FlatList, StyleSheet } from 'react-native';
import * as maps from 'react-native-maps';

import TabLayout from '../app/(tabs)/_layout';
import PlanScreen from '../app/(tabs)/plan/index';
import TripsScreen from '../app/(tabs)/trips/index';
import ScenarioRoute from '../app/scenario/[name]';
import RootLayout from '../app/_layout';
import { SHEET_COLLAPSED, SHEET_FULL, SHEET_HALF } from '@/core/sheet';
import { resetFakeAuth } from '@/features/auth/testing';
import { exitScenario } from '@/scenarios';

// TR-46 QA round 2: "We need to scroll the bottom tab all the way down and have the map be able
// to take the full screen", the same for the Trips globe, and a free day of the Tokyo trip that
// showed North America.
jest.mock('@/services/supabase', () => ({
  supabase: { auth: require('@/features/auth/testing').fakeAuth },
}));

const calls = (maps as unknown as { mapCalls: { method: string; args: any[] }[] }).mapCalls;

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

type Sheet = { props: Record<string, any> };
let sheetID = 'plan-sheet';
/** The map's sheet (both tabs are mounted, each with its own). */
const sheet = () =>
  screen
    .UNSAFE_getAllByType(BottomSheet)
    .find((s) => within(s).queryByTestId(sheetID)) as unknown as Sheet;
const heightOf = (testID: string) =>
  (StyleSheet.flatten(screen.getByTestId(testID).props.style) as { height: number }).height;

/** The sheet settles at `index` (the library calls onChange once it has). */
function settle(index: number) {
  act(() => sheet().props.onChange(index));
}

/** The nearest view above `testID` that listens for its layout. */
function laidOut(testID: string) {
  let node = screen.getByTestId(testID).parent;
  while (node && !node.props.onLayout) node = node.parent;
  return node!;
}
const layout = (height: number) => ({ nativeEvent: { layout: { height, width: 402 } } });

/** The body under the header is measured: the screen's layout after its first frame. */
function measureBody(testID: string, height: number) {
  act(() => laidOut(testID).props.onLayout(layout(height)));
}

let scrollToIndex: jest.SpyInstance;
beforeEach(() => {
  calls.length = 0;
  resetFakeAuth(null);
  scrollToIndex = jest.spyOn(FlatList.prototype, 'scrollToIndex').mockImplementation(() => {});
});
afterEach(() => {
  scrollToIndex.mockRestore();
  jest.restoreAllMocks();
  act(() => exitScenario());
});

describe('Plan: the map can take the full screen', () => {
  async function open() {
    sheetID = 'plan-sheet';
    renderRouter(routes, { initialUrl: '/scenario/vegas-plan-day-2' });
    await screen.findByTestId('trip-map');
    measureBody('plan-map-area', 700);
  }

  it('snaps collapsed, half and full, opening at half', async () => {
    await open();
    const { snapPoints, index } = sheet().props;
    expect(index).toBe(SHEET_HALF);
    expect(snapPoints).toHaveLength(3);
    const [collapsed, half, full] = snapPoints;
    expect(collapsed).toBeGreaterThan(0);
    expect(collapsed).toBeLessThan(half);
    expect(full).toBe('100%');
  });

  it('grows the map down to the collapsed sheet, and back when it comes up', async () => {
    await open();
    const half = heightOf('plan-map-area');
    // Going down: the map grows as soon as the sheet starts moving, so no gap shows.
    act(() => sheet().props.onAnimate(SHEET_HALF, SHEET_COLLAPSED));
    const collapsed = heightOf('plan-map-area');
    expect(collapsed).toBeGreaterThan(half);
    // Only the grabber, the day header and the tab bar's room are left under it.
    expect(collapsed).toBeGreaterThan(700 - 200);
    settle(SHEET_HALF);
    expect(heightOf('plan-map-area')).toBe(half);
    // Full covers the map: it keeps the half-height map underneath.
    settle(SHEET_FULL);
    expect(heightOf('plan-map-area')).toBe(half);
  });

  it('re-frames the day for the new map height', async () => {
    await open();
    const map = laidOut('trip-map');
    act(() => map.props.onLayout(layout(300)));
    calls.length = 0;
    act(() => map.props.onLayout(layout(560)));
    const fit = calls.find((c) => c.method === 'fitToCoordinates');
    expect(fit?.args[0]).toHaveLength(4);
  });

  it('keeps the selected stop in view when the map changes height', async () => {
    await open();
    fireEvent.press(screen.getByText('Sphere Experience'));
    const map = laidOut('trip-map');
    act(() => map.props.onLayout(layout(300)));
    calls.length = 0;
    act(() => map.props.onLayout(layout(560)));
    expect(calls.map((c) => c.method)).toEqual(['animateCamera']);
    // Centred on Sphere at the same zoom.
    expect(calls[0].args[0]).toEqual({ center: { latitude: 36.1207, longitude: -115.1622 } });
  });

  it('brings a full sheet back to half on a pick, and leaves a collapsed one down', async () => {
    const snap = jest.spyOn(BottomSheet.prototype as any, 'snapToIndex');
    await open();
    settle(SHEET_FULL);
    fireEvent.press(screen.getByTestId('itinerary-row-item-06'));
    expect(snap).toHaveBeenLastCalledWith(SHEET_HALF);
    snap.mockClear();
    settle(SHEET_COLLAPSED);
    fireEvent(screen.getByTestId('pin-place-carbone'), 'touchEnd');
    expect(snap).not.toHaveBeenCalled();
  });
});

describe('Plan: a day with nothing placed shows the trip city', () => {
  it('frames Tokyo on a free day of the Tokyo trip', async () => {
    renderRouter(routes, { initialUrl: '/scenario/tokyo-free-day' });
    const map = await screen.findByTestId('trip-map');
    const region = map.props.initialRegion;
    expect(region).toBeDefined();
    expect(region.latitude).toBeCloseTo(35.68, 1);
    expect(region.longitude).toBeCloseTo(139.65, 1);
    expect(region.latitudeDelta).toBeLessThan(1);
  });
});

describe('Trips: the globe can be seen whole', () => {
  async function open() {
    sheetID = 'trips-sheet';
    renderRouter(routes, { initialUrl: '/scenario/vegas-trips' });
    await screen.findByTestId('trips-globe-map');
    measureBody('trips-globe', 720);
  }

  it('puts the trip list in a sheet over the globe, with the filter on its top row', async () => {
    await open();
    expect(screen.getByTestId('trips-sheet')).toBeTruthy();
    expect(screen.getByTestId('trips-filter')).toBeTruthy();
    expect(sheet().props.snapPoints).toHaveLength(3);
  });

  it('grows the globe when the sheet goes down, raising the camera on a phone so the Earth fits', async () => {
    // An iPhone 17 Pro's window (Jest's default is wider than it is tall).
    const iPhone = { width: 402, height: 874, scale: 3, fontScale: 1 };
    const before = { window: Dimensions.get('window'), screen: Dimensions.get('screen') };
    Dimensions.set({ window: iPhone, screen: iPhone });
    try {
      await open();
      const half = heightOf('trips-globe');
      calls.length = 0;
      act(() => sheet().props.onAnimate(SHEET_HALF, SHEET_COLLAPSED));
      expect(heightOf('trips-globe')).toBeGreaterThan(half);
      // (The spin's own setCamera calls only move the centre.)
      const camera = calls.filter((c) => c.method === 'setCamera' && c.args[0].altitude).at(-1);
      expect(camera?.args[0].altitude).toBeGreaterThan(24_000_000);
    } finally {
      Dimensions.set(before);
    }
  });
});
