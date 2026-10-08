import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';
import * as Haptics from 'expo-haptics';
import { FlatList } from 'react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import TabLayout from '../app/(tabs)/_layout';
import PlanScreen from '../app/(tabs)/plan/index';
import ScenarioRoute from '../app/scenario/[name]';
import RootLayout from '../app/_layout';
import { resetFakeAuth } from '@/features/auth/testing';
import { exitScenario } from '@/scenarios';
import { useActiveSource } from '@/services/data/active';
import { useSelectionStore } from '@/stores/selection';

jest.mock('@/services/supabase', () => ({
  supabase: { auth: require('@/features/auth/testing').fakeAuth },
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(async () => {}),
  selectionAsync: jest.fn(async () => {}),
  notificationAsync: jest.fn(async () => {}),
  ImpactFeedbackStyle: { Medium: 'medium' },
  NotificationFeedbackType: { Warning: 'warning' },
}));

jest.mock('@/services/places', () => ({
  searchPlaces: jest.fn(async () => []),
  searchSpots: jest.fn(async () => [
    {
      id: 'N42',
      name: 'Eggslut',
      kind: 'food',
      area: 'Paradise',
      address: '3708 South Las Vegas Boulevard, Paradise',
      lat: 36.1092,
      lng: -115.1745,
    },
  ]),
}));

/** The time wheel: a tap picks `mockPick.time` (or keeps the value). */
const mockPick: { time: string | null } = { time: null };
jest.mock('@react-native-community/datetimepicker', () => {
  const { Pressable, Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ value, onChange, testID }: any) => (
      <Pressable
        testID={testID}
        onPress={() => {
          const next = new Date(value);
          if (mockPick.time) {
            const [h, m] = mockPick.time.split(':').map(Number);
            next.setHours(h, m);
          }
          onChange({ type: 'set' }, next);
        }}
      >
        <Text>{value.toTimeString().slice(0, 5)}</Text>
      </Pressable>
    ),
  };
});

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

const BRUNCH = 'item-05';
const FOUNTAINS = 'item-06';
const SPHERE = 'item-07';

async function openFriday() {
  renderRouter(routes, { initialUrl: '/scenario/vegas-plan-day-2' });
  await screen.findByTestId(`itinerary-row-${BRUNCH}`);
}

/** Each row's time and title, top to bottom. */
const rows = () =>
  within(screen.getByTestId('itinerary-list'))
    .getAllByTestId(/^itinerary-row-/)
    .map((row) => {
      const [time, title] = within(row)
        .queryAllByText(/./)
        .map((t) => t.props.children);
      return `${time} ${title}`;
    });

const action = (itemId: string, actionName: string) =>
  act(async () => {
    fireEvent(screen.getByTestId(`itinerary-row-${itemId}`), 'accessibilityAction', {
      nativeEvent: { actionName },
    });
  });

const toast = () => screen.getByTestId('plan-toast');

let scrollToIndex: jest.SpyInstance;

beforeEach(() => {
  resetFakeAuth(null);
  mockPick.time = null;
  jest.clearAllMocks();
  scrollToIndex = jest.spyOn(FlatList.prototype, 'scrollToIndex').mockImplementation(() => {});
});
afterEach(() => {
  scrollToIndex.mockRestore();
  act(() => exitScenario());
});

describe('Editing the itinerary on vegas-plan-day-2', () => {
  it('reorders two flexible stops, swapping their times, and recomputes the travel legs', async () => {
    await openFriday();
    expect(screen.getByTestId(`travel-leg-${BRUNCH}`)).toBeTruthy();

    await action(BRUNCH, 'moveLater');

    await waitFor(() =>
      expect(rows()).toEqual([
        '10:00 AM Bellagio Fountains',
        '12:00 PM Brunch at Mon Ami Gabi',
        '3:00 PM Sphere Experience',
        '8:00 PM Dinner at Carbone',
      ]),
    );
    // Legs follow the new order: Fountains → Brunch → Sphere.
    expect(screen.getByTestId(`travel-leg-${FOUNTAINS}`)).toBeTruthy();
    expect(screen.getByTestId(`travel-leg-${BRUNCH}`)).toBeTruthy();
    const saved = await useActiveSource.getState().source.getTripData('trip-vegas');
    expect(saved?.items.find((i) => i.id === BRUNCH)?.startTime).toBe('12:00');
  });

  /** Touch and hold a row until it lifts, then drag it `dy` points and let go. */
  const holdAndDrag = (id: string, dy: number) =>
    act(() => {
      fireGestureHandler(getByGestureTestId(`itinerary-hold-${id}`), [
        { state: State.BEGAN, absoluteY: 300 },
        { state: State.ACTIVE, absoluteY: 300 },
      ]);
      fireGestureHandler(getByGestureTestId(`itinerary-drag-${id}`), [
        { state: State.BEGAN, absoluteY: 300 },
        { state: State.ACTIVE, absoluteY: 302 },
        { state: State.ACTIVE, absoluteY: 300 + dy },
        { state: State.END, absoluteY: 300 + dy },
      ]);
    });

  it('touch and hold lifts a row with a haptic; dragging it and letting go reorders', async () => {
    await openFriday();
    holdAndDrag(BRUNCH, 90);

    expect(Haptics.impactAsync).toHaveBeenCalledWith('medium');
    expect(Haptics.selectionAsync).toHaveBeenCalled();
    await waitFor(() => expect(rows()[0]).toBe('10:00 AM Bellagio Fountains'));
    expect(rows()[1]).toBe('12:00 PM Brunch at Mon Ami Gabi');
  });

  it('a hold let go without moving puts the row back where it was', async () => {
    await openFriday();
    const before = rows();
    act(() => {
      fireGestureHandler(getByGestureTestId(`itinerary-hold-${BRUNCH}`), [
        { state: State.BEGAN, absoluteY: 300 },
        { state: State.ACTIVE, absoluteY: 300 },
      ]);
    });
    expect(Haptics.impactAsync).toHaveBeenCalledWith('medium');
    // The finger lifts: the drag pan ends without having started.
    act(() => {
      fireGestureHandler(getByGestureTestId(`itinerary-drag-${BRUNCH}`), [
        { state: State.BEGAN, absoluteY: 300 },
        { state: State.FAILED, absoluteY: 300 },
      ]);
    });
    expect(rows()).toEqual(before);
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  });

  it('without the hold, a drag on a row does nothing (it is a scroll or a swipe)', async () => {
    await openFriday();
    const before = rows();
    act(() => {
      fireGestureHandler(getByGestureTestId(`itinerary-drag-${BRUNCH}`), [
        { state: State.BEGAN, absoluteY: 300 },
        { state: State.ACTIVE, absoluteY: 302 },
        { state: State.ACTIVE, absoluteY: 390 },
        { state: State.END, absoluteY: 390 },
      ]);
    });
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
    expect(rows()).toEqual(before);
  });

  it('Edit mode: the drag handles move a row without a hold, and Done hides them', async () => {
    await openFriday();
    expect(screen.queryByTestId(`itinerary-handle-${BRUNCH}`)).toBeNull();

    fireEvent.press(screen.getByTestId('day-header-reorder'));
    expect(within(screen.getByTestId('day-header-reorder')).getByText('Done')).toBeTruthy();
    act(() => {
      fireGestureHandler(getByGestureTestId(`itinerary-handle-${BRUNCH}`), [
        { state: State.BEGAN, translationY: 0 },
        { state: State.ACTIVE, translationY: 4 },
        { state: State.ACTIVE, translationY: 90 },
        { state: State.END, translationY: 90 },
      ]);
    });

    expect(Haptics.impactAsync).toHaveBeenCalledWith('medium');
    await waitFor(() => expect(rows()[0]).toBe('10:00 AM Bellagio Fountains'));

    fireEvent.press(screen.getByTestId('day-header-reorder'));
    expect(within(screen.getByTestId('day-header-reorder')).getByText('Edit')).toBeTruthy();
    expect(screen.queryByTestId(`itinerary-handle-${BRUNCH}`)).toBeNull();
  });

  it('refuses dropping onto a fixed stop, with a message, and keeps the order', async () => {
    await openFriday();
    await action(FOUNTAINS, 'moveLater');

    expect(within(toast()).getByText('Overlaps Sphere Experience at 3:00 PM.')).toBeTruthy();
    expect(rows()[1]).toBe('12:00 PM Bellagio Fountains');
  });

  it('refuses a drag onto a fixed stop with a warning haptic', async () => {
    await openFriday();
    holdAndDrag(FOUNTAINS, 80);
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('warning');
    expect(within(toast()).getByText('Overlaps Sphere Experience at 3:00 PM.')).toBeTruthy();
  });

  it('deletes a stop with Undo, and Undo puts it back', async () => {
    await openFriday();
    await act(async () => fireEvent.press(screen.getByTestId(`itinerary-delete-${FOUNTAINS}`)));

    await waitFor(() => expect(rows()).not.toContain('12:00 PM Bellagio Fountains'));
    expect(within(toast()).getByText('Removed Bellagio Fountains')).toBeTruthy();

    await act(async () => fireEvent.press(within(toast()).getByText('Undo')));
    await waitFor(() => expect(rows()).toContain('12:00 PM Bellagio Fountains'));
  });

  it('changes a time from the time picker, and the day re-sorts', async () => {
    await openFriday();
    fireEvent.press(screen.getByTestId(`itinerary-time-${FOUNTAINS}`));
    expect(await screen.findByText('Change time')).toBeTruthy();

    mockPick.time = '09:00';
    fireEvent.press(screen.getByTestId('time-picker'));
    await act(async () => fireEvent.press(screen.getByTestId('time-save')));

    await waitFor(() => expect(rows()[0]).toBe('9:00 AM Bellagio Fountains'));
  });

  it('refuses a time that overlaps a fixed stop, inside the sheet', async () => {
    await openFriday();
    fireEvent.press(screen.getByTestId(`itinerary-time-${FOUNTAINS}`));
    mockPick.time = '14:30';
    fireEvent.press(await screen.findByTestId('time-picker'));
    await act(async () => fireEvent.press(screen.getByTestId('time-save')));

    expect(screen.getByTestId('sheet-error')).toHaveTextContent(
      'Overlaps Sphere Experience at 3:00 PM.',
    );
    expect(rows()[1]).toBe('12:00 PM Bellagio Fountains');
  });

  it('moves a stop to another day', async () => {
    await openFriday();
    await act(async () => fireEvent.press(screen.getByTestId(`itinerary-move-${FOUNTAINS}`)));
    await act(async () => fireEvent.press(await screen.findByTestId('move-day-2026-11-14')));

    await waitFor(() => expect(rows()).not.toContain('12:00 PM Bellagio Fountains'));
    expect(within(toast()).getByText('Moved Bellagio Fountains to Sat, Nov 14')).toBeTruthy();

    act(() => useSelectionStore.getState().selectDay('2026-11-14'));
    await waitFor(() => expect(rows()).toContain('12:00 PM Bellagio Fountains'));
  });

  it('edits a stop in its detail sheet: title, duration and notes', async () => {
    await openFriday();
    await act(async () => fireEvent.press(screen.getByTestId(`itinerary-edit-${BRUNCH}`)));
    expect(await screen.findByText('Edit stop')).toBeTruthy();
    expect(screen.getByTestId('detail-duration')).toHaveTextContent('1 hr 15 min');

    fireEvent.changeText(screen.getByTestId('detail-title'), 'Crêpes at Mon Ami Gabi');
    fireEvent.press(screen.getByTestId('detail-longer'));
    fireEvent.changeText(screen.getByTestId('detail-notes'), 'Patio table');
    await act(async () => fireEvent.press(screen.getByTestId('detail-save')));

    await waitFor(() => expect(rows()[0]).toBe('10:00 AM Crêpes at Mon Ami Gabi'));
    const saved = await useActiveSource.getState().source.getTripData('trip-vegas');
    expect(saved?.items.find((i) => i.id === BRUNCH)).toMatchObject({
      durationMinutes: 90,
      notes: 'Patio table',
    });
  });

  it('adds a stop from the day header: place search, then a time', async () => {
    await openFriday();
    fireEvent.press(screen.getByTestId('day-header-add'));
    expect(await screen.findByText('Add a stop')).toBeTruthy();
    expect(screen.queryByTestId('bucket-drop-pin')).toBeNull();

    fireEvent.changeText(screen.getByTestId('spot-input'), 'Eggslut');
    fireEvent.press(await screen.findByTestId('spot-N42', {}, { timeout: 2000 }));
    mockPick.time = '13:15';
    fireEvent.press(screen.getByTestId('add-stop-time'));
    await act(async () => fireEvent.press(screen.getByTestId('add-stop-save')));

    await waitFor(() => expect(rows()).toContain('1:15 PM Eggslut'));
    expect(within(toast()).getByText('Added Eggslut to Fri, Nov 13')).toBeTruthy();
  });

  it('rolls back an edit the server refuses', async () => {
    await openFriday();
    const source = useActiveSource.getState().source;
    jest.spyOn(source, 'saveItineraryItem').mockRejectedValue(new Error('offline'));

    await action(BRUNCH, 'moveLater');

    await waitFor(() =>
      expect(within(toast()).getByText("Couldn't save that change. Try again.")).toBeTruthy(),
    );
    expect(rows()[0]).toBe('10:00 AM Brunch at Mon Ami Gabi');
  });

  it("doesn't let a booking's time change here", async () => {
    renderRouter(routes, { initialUrl: '/scenario/vegas-plan-day-2' });
    await screen.findByTestId(`itinerary-row-${BRUNCH}`);
    act(() => useSelectionStore.getState().selectDay('2026-11-15'));
    fireEvent.press(await screen.findByTestId('itinerary-time-item-12'));

    expect(within(toast()).getByText('UFC 310 gets its time from the booking.')).toBeTruthy();
    expect(screen.queryByText('Change time')).toBeNull();
  });

  it('keeps fixed stops in place: picking one up says why', async () => {
    await openFriday();
    await action(SPHERE, 'moveEarlier');
    expect(within(toast()).getByText('Sphere Experience has a fixed time.')).toBeTruthy();
  });
});
