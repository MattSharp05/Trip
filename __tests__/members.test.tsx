import BottomSheet from '@gorhom/bottom-sheet';
import { router as nav } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';
import { ActionSheetIOS, Alert, StyleSheet, type AlertButton } from 'react-native';

import TabLayout from '../app/(tabs)/_layout';
import DiscoverScreen from '../app/(tabs)/discover/index';
import OrganizeScreen from '../app/(tabs)/organize/index';
import PlanScreen from '../app/(tabs)/plan/index';
import TripsScreen from '../app/(tabs)/trips/index';
import ScenarioRoute from '../app/scenario/[name]';
import RootLayout from '../app/_layout';
import { resetFakeAuth } from '@/features/auth/testing';
import { exitScenario } from '@/scenarios';
import { SHEET_FULL, SHEET_HALF } from '@/core/sheet';
import { useSelectionStore } from '@/stores/selection';
import { useTripStore } from '@/stores/trip';
import { colors } from '@/theme';

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
  jest.restoreAllMocks();
});

async function open(scenario: string) {
  const router = renderRouter(routes, { initialUrl: `/scenario/${scenario}` });
  await screen.findByTestId('day-header-weather');
  return router;
}

/** The avatars' members, left to right. */
const avatars = (testID: string) =>
  screen
    .getAllByTestId(new RegExp(`^${testID}-user-[a-z]+$`))
    .map((a) => a.props.testID.replace(`${testID}-`, ''));

/**
 * Taps the button of the latest Alert labelled `text`, then lets the write's refetch land: React
 * Query batches its updates on a timer, and renderRouter's fake timers only move when told to.
 */
async function pressAlert(text: string) {
  const alert = jest.mocked(Alert.alert).mock.calls.at(-1)!;
  const buttons = alert[2] as AlertButton[];
  await act(async () => buttons.find((b) => b.text === text)!.onPress!());
  await act(async () => {
    jest.advanceTimersByTime(100);
  });
}

async function openSheet() {
  fireEvent.press(screen.getByTestId('plan-members'));
  return within(await screen.findByTestId('plan-members-sheet'));
}

describe('Member avatars', () => {
  it('group-vegas: Blake, Willem and you last on Plan, with the orange ring on you', async () => {
    await open('group-vegas');
    await waitFor(() =>
      expect(avatars('plan-members')).toEqual(['user-blake', 'user-willem', 'user-matthew']),
    );
    expect(screen.getByTestId('plan-members')).toHaveTextContent('BWM');
    const ring = (id: string) =>
      StyleSheet.flatten(screen.getByTestId(`plan-members-${id}`).props.style).borderColor;
    expect(ring('user-matthew')).toBe(colors.accent);
    expect(ring('user-blake')).toBe(colors.hairline);
    expect(screen.getByTestId('plan-members').props.accessibilityLabel).toBe(
      'Trip members: You, Blake, Willem',
    );
  });

  it('shows on Organize and Discover too, next to the trip title', async () => {
    await open('group-vegas');
    act(() => nav.navigate('/organize'));
    expect(await screen.findByTestId('organize-members')).toHaveTextContent('BWM');
    act(() => nav.navigate('/discover'));
    expect(await screen.findByTestId('discover-members')).toHaveTextContent('BWM');
  });

  it('a trip with only you shows none', async () => {
    await open('vegas-plan-day-2');
    await act(async () => {});
    expect(screen.queryByTestId('plan-members')).toBeNull();
    act(() => nav.navigate('/organize'));
    await screen.findByTestId('organize-trip-title');
    expect(screen.queryByTestId('organize-members')).toBeNull();
  });
});

describe('Members sheet', () => {
  it('lists Matthew (Organizer, You), Blake and Willem', async () => {
    await open('group-vegas');
    const sheet = await openSheet();
    expect(screen.getByText('Trip members')).toBeOnTheScreen();
    const rows = sheet.getAllByTestId(/^plan-members-sheet-user-[a-z]+$/);
    expect(rows.map((r) => r.props.accessibilityLabel)).toEqual([
      'Matthew, Organizer · You',
      'Blake',
      'Willem',
    ]);
    // The organizer can remove the others, not themselves, and can't leave.
    expect(sheet.queryByTestId('plan-members-sheet-user-matthew-menu')).toBeNull();
    expect(sheet.getByTestId('plan-members-sheet-user-blake-menu')).toBeOnTheScreen();
    expect(sheet.queryByTestId('plan-members-sheet-leave')).toBeNull();
  });

  it('the organizer removes Blake from a row menu, confirmed: he leaves the avatars and the sheet', async () => {
    const menu = jest
      .spyOn(ActionSheetIOS, 'showActionSheetWithOptions')
      .mockImplementation((_options, callback) => callback(0));
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await open('group-vegas');
    const sheet = await openSheet();

    fireEvent.press(sheet.getByTestId('plan-members-sheet-user-blake-menu'));
    expect(menu.mock.calls[0][0]).toMatchObject({
      title: 'Blake',
      options: ['Remove from trip', 'Cancel'],
      destructiveButtonIndex: 0,
    });
    expect(jest.mocked(Alert.alert).mock.calls[0][0]).toBe('Remove Blake from the trip?');
    await pressAlert('Remove');

    await waitFor(() => expect(sheet.queryByTestId('plan-members-sheet-user-blake')).toBeNull());
    expect(avatars('plan-members')).toEqual(['user-willem', 'user-matthew']);
  });

  it('cancelling the confirm keeps Blake', async () => {
    jest
      .spyOn(ActionSheetIOS, 'showActionSheetWithOptions')
      .mockImplementation((_options, callback) => callback(0));
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await open('group-vegas');
    const sheet = await openSheet();
    fireEvent.press(sheet.getByTestId('plan-members-sheet-user-blake-menu'));
    expect(jest.mocked(Alert.alert).mock.calls[0][2]).toContainEqual(
      expect.objectContaining({ text: 'Cancel', style: 'cancel' }),
    );
    await act(async () => {});
    expect(sheet.getByTestId('plan-members-sheet-user-blake')).toBeOnTheScreen();
  });

  it('group-vegas-member: Willem sees no Remove, and Leave trip', async () => {
    await open('group-vegas-member');
    await waitFor(() =>
      expect(avatars('plan-members')).toEqual(['user-matthew', 'user-blake', 'user-willem']),
    );
    const sheet = await openSheet();
    const rows = sheet.getAllByTestId(/^plan-members-sheet-user-[a-z]+$/);
    expect(rows.map((r) => r.props.accessibilityLabel)).toEqual([
      'Willem, You',
      'Matthew, Organizer',
      'Blake',
    ]);
    expect(sheet.queryAllByTestId(/-menu$/)).toHaveLength(0);
    expect(sheet.getByTestId('plan-members-sheet-leave')).toHaveTextContent('Leave trip');
  });

  it('leaving the trip (confirmed) drops it from Trips and selects the next trip', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await open('group-vegas-member');
    const sheet = await openSheet();
    fireEvent.press(sheet.getByTestId('plan-members-sheet-leave'));
    expect(jest.mocked(Alert.alert).mock.calls[0][0]).toBe('Leave Las Vegas?');
    await pressAlert('Leave');

    await waitFor(() => expect(useTripStore.getState().selectedTripId).toBe('trip-cape-town'));
    expect(useSelectionStore.getState().tripId).toBe('trip-cape-town');
    await waitFor(() =>
      expect(screen.getByTestId('plan-trip-title').props.accessibilityLabel).toBe(
        'Cape Town, Dec 18, 2026 – Jan 6, 2027',
      ),
    );

    act(() => nav.navigate('/trips'));
    fireEvent.press(await screen.findByRole('tab', { name: 'All' }));
    await waitFor(() => expect(screen.getAllByText('Cape Town').length).toBeGreaterThan(0));
    expect(screen.queryByText('Las Vegas')).toBeNull();
  });
});

describe('Opening a trip lands on Plan with the map', () => {
  /** Leaves Plan's sheet at full height, covering the map; returns the spy on its snaps. */
  function coverMap() {
    const snap = jest.spyOn(BottomSheet.prototype, 'snapToIndex');
    const planSheet = screen
      .UNSAFE_getAllByType(BottomSheet)
      .find((s) => s.props.children.props.testID === 'plan-sheet')!;
    act(() => planSheet.props.onChange(SHEET_FULL));
    return snap;
  }

  it('from a trip card', async () => {
    const router = await open('vegas-plan-day-2');
    const snap = coverMap();
    act(() => nav.navigate('/trips'));
    fireEvent.press(await screen.findByTestId('trip-card-trip-cape-town'));
    await waitFor(() => expect(router.getPathname()).toBe('/plan'));
    expect(useTripStore.getState().selectedTripId).toBe('trip-cape-town');
    expect(useSelectionStore.getState()).toMatchObject({
      tripId: 'trip-cape-town',
      selectedDay: '2026-12-18',
    });
    expect(snap).toHaveBeenCalledWith(SHEET_HALF);
  });

  it('from a globe dot', async () => {
    const router = await open('vegas-plan-day-2');
    const snap = coverMap();
    act(() => nav.navigate('/trips'));
    fireEvent(await screen.findByTestId('globe-trip-trip-tokyo'), 'touchEnd');
    await waitFor(() => expect(router.getPathname()).toBe('/plan'));
    expect(useSelectionStore.getState()).toMatchObject({
      tripId: 'trip-tokyo',
      selectedDay: '2027-03-20',
    });
    expect(snap).toHaveBeenCalledWith(SHEET_HALF);
  });

  it('from the trip switcher on another tab', async () => {
    const router = await open('vegas-plan-day-2');
    const snap = coverMap();
    act(() => nav.navigate('/organize'));
    fireEvent.press(await screen.findByTestId('organize-trip-title'));
    fireEvent.press(await screen.findByTestId('organize-trip-title-switcher-trip-tokyo'));
    await waitFor(() => expect(router.getPathname()).toBe('/plan'));
    expect(useSelectionStore.getState()).toMatchObject({
      tripId: 'trip-tokyo',
      selectedDay: '2027-03-20',
    });
    expect(snap).toHaveBeenCalledWith(SHEET_HALF);
    expect(await screen.findByTestId('trip-map')).toBeOnTheScreen();
  });
});
