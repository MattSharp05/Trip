import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';
import { ScrollView } from 'react-native';

import TabLayout from '../app/(tabs)/_layout';
import PlanScreen from '../app/(tabs)/plan/index';
import ScenarioRoute from '../app/scenario/[name]';
import RootLayout from '../app/_layout';
import { resetFakeAuth } from '@/features/auth/testing';
import { exitScenario } from '@/scenarios';
import { ME } from '@/scenarios/fixtures/vegas';
import { WILLEM } from '@/scenarios/fixtures/group';
import { useActiveSource } from '@/services/data/active';
import { useSelectionStore } from '@/stores/selection';

jest.mock('@/services/supabase', () => ({
  supabase: { auth: require('@/features/auth/testing').fakeAuth },
}));
jest.mock('@/services/places', () => ({
  searchPlaces: jest.fn(async () => []),
  searchSpots: jest.fn(async () => []),
}));

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

const PEPPERMILL = 'item-04';
const BRUNCH = 'item-05';
const FOUNTAINS = 'item-06';
const SPHERE = 'item-07';

async function open(scenario: string, firstRow: string) {
  renderRouter(routes, { initialUrl: `/scenario/${scenario}` });
  await screen.findByTestId(`itinerary-row-${firstRow}`);
}

const editStop = (itemId: string) =>
  act(async () => fireEvent.press(screen.getByTestId(`itinerary-edit-${itemId}`)));

/** The Going section, as "name: status" lines, top to bottom. */
const goingLines = () =>
  within(screen.getByTestId('detail-going'))
    .getAllByTestId(/^detail-going-row-/)
    .map((row) => {
      const id = row.props.testID.replace('detail-going-row-', '');
      const name = within(row).getAllByText(/./)[1].props.children;
      const status = within(row).queryByTestId(`detail-going-status-${id}`);
      const value = status
        ? status.props.children
        : within(row).getByTestId('detail-going-switch').props.value
          ? 'on'
          : 'off';
      return `${name}: ${value}`;
    });

let scrollTo: jest.SpyInstance;

beforeEach(() => {
  resetFakeAuth(null);
  scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(() => {});
});
afterEach(() => {
  scrollTo.mockRestore();
  act(() => exitScenario());
});

describe('Shared itinerary: who is going (TR-60)', () => {
  it('group-plan-opt-out opens on Bellagio Fountains: Matthew and Blake going, Willem out', async () => {
    await open('group-plan-opt-out', BRUNCH);
    expect(await screen.findByText('Edit stop')).toBeTruthy();
    expect(useSelectionStore.getState().selectedItemId).toBe(FOUNTAINS);
    expect(goingLines()).toEqual(["I'm going: on", 'Blake: Going', 'Willem: Out']);
    expect(screen.getByTestId('detail-added-by')).toHaveTextContent('Added by you');

    // The row shows who's going (Blake, then you), since Willem is out.
    const going = screen.getByTestId(`itinerary-going-${FOUNTAINS}`);
    expect(
      within(going)
        .getAllByText(/./)
        .map((t) => t.props.children),
    ).toEqual(['B', 'M']);
    expect(screen.getByTestId(`itinerary-row-${FOUNTAINS}`).props.accessibilityLabel).toContain(
      'Going: you and Blake',
    );
  });

  it('keeps rows calm while everyone is in, and leaves flights and hotels without a Going list', async () => {
    await open('group-plan-opt-out', BRUNCH);
    expect(screen.queryByTestId(`itinerary-going-${BRUNCH}`)).toBeNull();
    expect(screen.queryByTestId(`itinerary-going-${SPHERE}`)).toBeNull();

    act(() => useSelectionStore.getState().selectDay('2026-11-12'));
    await screen.findByTestId('itinerary-row-item-03');
    await editStop('item-03'); // Check in at The Cosmopolitan
    expect(await screen.findByText('Edit stop')).toBeTruthy();
    expect(screen.queryByTestId('detail-going')).toBeNull();
  });

  it('says "Added by Willem" on the stop he added', async () => {
    await open('group-plan-opt-out', BRUNCH);
    act(() => useSelectionStore.getState().selectDay('2026-11-12'));
    await screen.findByTestId(`itinerary-row-${PEPPERMILL}`);
    await editStop(PEPPERMILL);
    expect(await screen.findByTestId('detail-added-by')).toHaveTextContent('Added by Willem');
  });

  it("turning off I'm going takes you off the list and shows You're out; on restores it", async () => {
    await open('group-plan-opt-out', BRUNCH);
    await screen.findByTestId('detail-going');
    const source = () => useActiveSource.getState().source;

    await act(async () =>
      fireEvent(screen.getByTestId('detail-going-switch'), 'valueChange', false),
    );
    await waitFor(() =>
      expect(goingLines()).toEqual(["I'm going: off", 'Blake: Going', 'Willem: Out']),
    );
    expect(screen.getByTestId(`itinerary-out-${FOUNTAINS}`)).toHaveTextContent(/^You're out/);
    const going = screen.getByTestId(`itinerary-going-${FOUNTAINS}`);
    expect(
      within(going)
        .getAllByText(/./)
        .map((t) => t.props.children),
    ).toEqual(['B']);
    let saved = await source().getTripData('trip-vegas');
    expect(saved?.items.find((i) => i.id === FOUNTAINS)?.optedOut).toEqual([WILLEM, ME]);

    await act(async () =>
      fireEvent(screen.getByTestId('detail-going-switch'), 'valueChange', true),
    );
    await waitFor(() =>
      expect(goingLines()).toEqual(["I'm going: on", 'Blake: Going', 'Willem: Out']),
    );
    expect(screen.queryByTestId(`itinerary-out-${FOUNTAINS}`)).toBeNull();
    saved = await source().getTripData('trip-vegas');
    expect(saved?.items.find((i) => i.id === FOUNTAINS)?.optedOut).toEqual([WILLEM]);
  });

  it('shows no Going section or Added by line on a trip of one', async () => {
    await open('vegas-plan-day-2', BRUNCH);
    await editStop(FOUNTAINS);
    expect(await screen.findByText('Edit stop')).toBeTruthy();
    expect(screen.queryByTestId('detail-going')).toBeNull();
    expect(screen.queryByTestId('detail-added-by')).toBeNull();
  });
});
