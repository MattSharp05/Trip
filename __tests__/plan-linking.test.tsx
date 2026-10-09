import { render } from '@testing-library/react-native';
import { act, fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
import { ScrollView } from 'react-native';
import * as maps from 'react-native-maps';

import TabLayout from '../app/(tabs)/_layout';
import PlanScreen from '../app/(tabs)/plan/index';
import ScenarioRoute from '../app/scenario/[name]';
import RootLayout from '../app/_layout';
import { resetFakeAuth } from '@/features/auth/testing';
import { Itinerary, LEG_HEIGHT, ROW_HEIGHT } from '@/features/plan';
import { exitScenario } from '@/scenarios';
import { useSelectionStore } from '@/stores/selection';

jest.mock('@/services/supabase', () => ({
  supabase: { auth: require('@/features/auth/testing').fakeAuth },
}));

// The automatic Jest mock (__mocks__/react-native-maps.tsx) records camera calls.
const calls = (maps as unknown as { mapCalls: { method: string; args: any[] }[] }).mapCalls;

const routes = {
  _layout: RootLayout,
  '(tabs)/_layout': TabLayout,
  '(tabs)/trips/index': () => null,
  '(tabs)/plan/index': PlanScreen,
  '(tabs)/organize/index': () => null,
  '(tabs)/discover/index': () => null,
  'dev/gallery': () => null,
  'auth/index': () => null,
  'scenario/[name]': ScenarioRoute,
};

const SPHERE = { latitude: 36.1207, longitude: -115.1622 };

async function openPlan(scenario: string) {
  renderRouter(routes, { initialUrl: `/scenario/${scenario}` });
  await screen.findByTestId('trip-map');
}

/** Each row's visible text, top to bottom. */
const rows = () =>
  within(screen.getByTestId('itinerary-list'))
    .getAllByTestId(/^itinerary-row-/)
    .map((row) =>
      within(row)
        .queryAllByText(/./)
        .map((t) => t.props.children)
        .join(' | '),
    );

const row = (itemId: string) => screen.getByTestId(`itinerary-row-${itemId}`);

let scrollTo: jest.SpyInstance;

beforeEach(() => {
  calls.length = 0;
  resetFakeAuth(null);
  scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(() => {});
});
afterEach(() => {
  scrollTo.mockRestore();
  act(() => exitScenario());
});

describe('Plan itinerary on vegas-plan-day-2', () => {
  it("lists Friday's stops in order with local times, places and the timeline", async () => {
    await openPlan('vegas-plan-day-2');
    expect(rows()).toEqual([
      '10:00 AM | Brunch at Mon Ami Gabi | Paris Las Vegas',
      '12:00 PM | Bellagio Fountains | 3600 Las Vegas Blvd S',
      '3:00 PM | Sphere Experience | 255 Sands Ave',
      '8:00 PM | Dinner at Carbone | ARIA Resort & Casino',
    ]);
    expect(within(screen.getByTestId('plan-sheet')).getByText('Fri, Nov 13')).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Itinerary' })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'Bucket List (5)' })).not.toBeSelected();
    expect(screen.queryByTestId('itinerary-node-selected')).toBeNull();
  });

  it('tapping Sphere Experience selects it and its pin, and flies the map there', async () => {
    await openPlan('vegas-plan-day-2');
    fireEvent.press(row('item-07'));

    expect(useSelectionStore.getState()).toMatchObject({
      selectedItemId: 'item-07',
      selectedBy: 'list',
    });
    expect(row('item-07')).toBeSelected();
    expect(row('item-08')).not.toBeSelected();
    expect(within(screen.getByTestId('pin-place-sphere')).getByText('Sphere Experience'));
    expect(calls).toEqual([
      {
        method: 'animateCamera',
        args: [expect.objectContaining({ center: SPHERE }), expect.anything()],
      },
    ]);
    // A tapped row is already in view: the list doesn't move.
    expect(scrollTo).not.toHaveBeenCalled();

    // Tapping it again (after panning away) brings the map back.
    fireEvent.press(row('item-07'));
    expect(calls).toHaveLength(2);
  });

  it('tapping the Carbone pin highlights its row and scrolls it into view', async () => {
    await openPlan('vegas-plan-day-2');
    fireEvent(screen.getByTestId('pin-place-carbone'), 'touchEnd');

    expect(useSelectionStore.getState()).toMatchObject({
      selectedItemId: 'item-08',
      selectedBy: 'map',
    });
    expect(row('item-08')).toBeSelected();
    expect(within(row('item-08')).getByTestId('itinerary-node-selected')).toBeTruthy();
    // Carbone is the 4th stop, under three rows that each have a travel leg.
    expect(scrollTo).toHaveBeenCalledWith({ y: 3 * (ROW_HEIGHT + LEG_HEIGHT), animated: true });
    expect(calls[0].method).toBe('animateCamera');
  });

  it('changing day clears the selection and re-frames the map on that day', async () => {
    await openPlan('vegas-plan-day-2');
    fireEvent.press(row('item-07'));
    calls.length = 0;

    fireEvent.press(screen.getByTestId('pill-2026-11-14'));
    expect(useSelectionStore.getState()).toMatchObject({
      selectedDay: '2026-11-14',
      selectedItemId: null,
    });
    expect(rows()).toEqual([
      '11:00 AM | Gondola at The Venetian | 3355 Las Vegas Blvd S',
      '2:00 PM | The Forum Shops | Caesars Palace',
    ]);
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('fitToCoordinates');
    expect(calls[0].args[0]).toHaveLength(2);

    // The selected pill again re-frames the day.
    fireEvent.press(screen.getByTestId('pill-2026-11-14'));
    expect(calls[1].method).toBe('fitToCoordinates');
  });

  it('a grey dot opens its own day with the visit selected', async () => {
    await openPlan('vegas-plan-day-2');
    fireEvent(screen.getByTestId('pin-place-area15'), 'touchEnd');

    expect(useSelectionStore.getState()).toMatchObject({
      selectedDay: '2026-11-15',
      selectedItemId: 'item-11',
    });
    expect(screen.getByTestId('day-header-title').props.children).toBe('Sun, Nov 15');
    expect(row('item-11')).toBeSelected();
    expect(calls.at(-1)?.method).toBe('animateCamera');
  });

  it('switches to the Bucket List and back', async () => {
    await openPlan('vegas-plan-day-2');
    fireEvent.press(screen.getByRole('tab', { name: 'Bucket List (5)' }));
    expect(screen.queryByTestId('itinerary-list')).toBeNull();
    expect(screen.getByTestId('bucket-list')).toBeTruthy();
    fireEvent.press(screen.getByRole('tab', { name: 'Itinerary' }));
    expect(screen.getByTestId('itinerary-list')).toBeTruthy();
  });
});

describe('Plan itinerary, other scenarios', () => {
  it('vegas-free-day shows the free-day state, which opens the Bucket List', async () => {
    await openPlan('vegas-free-day');
    expect(screen.getByTestId('day-header-title').props.children).toBe('Sat, Nov 14');
    expect(
      screen.getByText('Free day. Use Smart Add on your Bucket List to fill it.'),
    ).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Open Bucket List' }));
    expect(screen.getByRole('tab', { name: 'Bucket List (5)' })).toBeSelected();
  });

  it('vegas-bucket opens on the Bucket List', async () => {
    await openPlan('vegas-bucket');
    expect(screen.getByRole('tab', { name: 'Bucket List (5)' })).toBeSelected();
    expect(screen.getByTestId('bucket-list')).toBeTruthy();
  });

  it("vegas-flight-day opens with the arrival selected and the flight's number", async () => {
    await openPlan('vegas-flight-day');
    expect(rows()[0]).toBe('11:02 AM | Arrive in Las Vegas | AA 2410');
    expect(row('item-01')).toBeSelected();
    // Opening on a selection doesn't move the map: the day's frame comes first.
    expect(calls.filter((c) => c.method === 'animateCamera')).toHaveLength(0);
  });
});

it('shows skeleton rows while the trip loads', async () => {
  render(
    <Itinerary
      entries={undefined}
      selectedId={null}
      revealKey={0}
      reveal={false}
      onSelect={() => {}}
      onOpenBucketList={() => {}}
      bottomInset={0}
    />,
  );
  // Let the skeletons read the Reduce Motion setting.
  await act(async () => {});
  expect(screen.getByTestId('itinerary-loading')).toBeTruthy();
  expect(screen.getAllByLabelText('Loading').length).toBeGreaterThanOrEqual(4);
});
