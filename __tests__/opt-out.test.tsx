import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';
import { ScrollView } from 'react-native';

import TabLayout from '../app/(tabs)/_layout';
import PlanScreen from '../app/(tabs)/plan/index';
import ScenarioRoute from '../app/scenario/[name]';
import RootLayout from '../app/_layout';
import { resetFakeAuth } from '@/features/auth/testing';
import { exitScenario } from '@/scenarios';
import { pairBalances } from '@/core/settle';
import { toLedger } from '@/features/budget/balances';
import { ME } from '@/scenarios/fixtures/vegas';
import { BLAKE, WILLEM } from '@/scenarios/fixtures/group';
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

  it("puts the switch back and says so when the opt-out can't be saved", async () => {
    await open('group-plan-opt-out', BRUNCH);
    await screen.findByTestId('detail-going');
    const source = useActiveSource.getState().source;
    jest.spyOn(source, 'optOut').mockRejectedValueOnce(new Error('offline'));

    await act(async () =>
      fireEvent(screen.getByTestId('detail-going-switch'), 'valueChange', false),
    );
    expect(await screen.findByText("Couldn't save that change. Try again.")).toBeOnTheScreen();
    expect(goingLines()).toEqual(["I'm going: on", 'Blake: Going', 'Willem: Out']);
    expect(screen.queryByTestId(`itinerary-out-${FOUNTAINS}`)).toBeNull();
  });

  it('shows no Going section or Added by line on a trip of one', async () => {
    await open('vegas-plan-day-2', BRUNCH);
    await editStop(FOUNTAINS);
    expect(await screen.findByText('Edit stop')).toBeTruthy();
    expect(screen.queryByTestId('detail-going')).toBeNull();
    expect(screen.queryByTestId('detail-added-by')).toBeNull();
  });
});

describe('Opting out takes you out of the expense split (TR-66)', () => {
  const source = () => useActiveSource.getState().source;
  const sphereShares = async () =>
    (await source().getTripData('trip-vegas'))?.expenses.find(
      (e) => e.id === 'expense-group-sphere',
    )?.shares;
  /** What `me` owes Blake (negative) or Blake owes `me`, from the saved expenses. */
  const withBlake = async (me: string) => {
    const expenses = (await source().getTripData('trip-vegas'))?.expenses ?? [];
    const [balance] = pairBalances(toLedger(expenses, me, 'USD', null), me, [BLAKE]);
    return `${balance.direction} ${balance.amountMinor}`;
  };

  async function openSphere(scenario: string, firstRow: string) {
    await open(scenario, firstRow);
    act(() => useSelectionStore.getState().selectDay('2026-11-13'));
    await screen.findByTestId(`itinerary-row-${SPHERE}`);
    await editStop(SPHERE);
    await screen.findByTestId('detail-going');
  }

  it('Willem opting out of the Sphere splits it 2 ways, and Blake is owed accordingly', async () => {
    // group-plan-opt-out's trip, seen by Willem.
    await openSphere('group-vegas-member', 'item-03');
    expect(screen.getByTestId('detail-expense-expense-group-sphere')).toHaveTextContent(
      'Sphere tickets $450.00 · split 3 ways',
    );
    expect(screen.queryByTestId('detail-expense-custom')).toBeNull();
    // Willem owes Blake $150 for the Sphere, less the $12 Uber Blake owes him; Matthew owes $150.
    expect(await withBlake(WILLEM)).toBe('youOwe 13800');
    expect(await withBlake(ME)).toBe('youOwe 15000');

    await act(async () =>
      fireEvent(screen.getByTestId('detail-going-switch'), 'valueChange', false),
    );
    await waitFor(() =>
      expect(screen.getByTestId('detail-expense-expense-group-sphere')).toHaveTextContent(
        'Sphere tickets $450.00 · split 2 ways',
      ),
    );
    expect(await sphereShares()).toEqual([
      { userId: BLAKE, shareMinor: 22500 },
      { userId: ME, shareMinor: 22500 },
    ]);
    expect(await withBlake(WILLEM)).toBe('owesYou 1200');
    expect(await withBlake(ME)).toBe('youOwe 22500');

    // Back in: three ways again.
    await act(async () =>
      fireEvent(screen.getByTestId('detail-going-switch'), 'valueChange', true),
    );
    await waitFor(() =>
      expect(screen.getByTestId('detail-expense-expense-group-sphere')).toHaveTextContent(
        /split 3 ways$/,
      ),
    );
    expect(await withBlake(WILLEM)).toBe('youOwe 13800');
  });

  it("keeps the switch when the opt-out saved but the split didn't", async () => {
    await openSphere('group-vegas-member', 'item-03');
    jest.spyOn(source(), 'setExpenseShares').mockRejectedValueOnce(new Error('offline'));
    await act(async () =>
      fireEvent(screen.getByTestId('detail-going-switch'), 'valueChange', false),
    );
    expect(
      await screen.findByText("Saved, but the expense split didn't update."),
    ).toBeOnTheScreen();
    await waitFor(() => expect(goingLines()).toContain("I'm going: off"));
    expect(await sphereShares()).toHaveLength(3);
  });

  it('leaves a custom split alone and says so', async () => {
    await open('group-plan-opt-out', BRUNCH);
    const custom = [
      { userId: BLAKE, shareMinor: 25000 },
      { userId: ME, shareMinor: 10000 },
      { userId: WILLEM, shareMinor: 10000 },
    ];
    await source().setExpenseShares('expense-group-sphere', custom);
    // Close the Fountains sheet the scenario opened, then edit the Sphere.
    await act(async () => fireEvent.press(screen.getByTestId('detail-save')));
    await editStop(SPHERE);
    expect(await screen.findByTestId('detail-expense-custom')).toHaveTextContent(
      'This activity has an expense with a custom split',
    );

    await act(async () =>
      fireEvent(screen.getByTestId('detail-going-switch'), 'valueChange', false),
    );
    await waitFor(() => expect(goingLines()[0]).toBe("I'm going: off"));
    expect(await sphereShares()).toEqual(custom);
  });
});
