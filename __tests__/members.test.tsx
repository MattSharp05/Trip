import BottomSheet from '@gorhom/bottom-sheet';
import { router as nav } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';
import { ActionSheetIOS, Alert, StyleSheet } from 'react-native';

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
 * Taps the in-sheet question's button labelled `text`, then lets the write's refetch land: React
 * Query batches its updates on a timer, and renderRouter's fake timers only move when told to.
 */
async function pressInSheet(text: string) {
  await act(async () => fireEvent.press(screen.getByRole('button', { name: text })));
  await act(async () => {
    jest.advanceTimersByTime(100);
  });
}

/**
 * Native dialogs open behind the sheet's full-window overlay on iOS (TR-56): nothing in the sheet
 * may use them. Returns the spies to check they stayed unused.
 */
function spyNativeDialogs() {
  return [
    jest.spyOn(Alert, 'alert').mockImplementation(() => {}),
    jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation(() => {}),
  ];
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
    const native = spyNativeDialogs();
    await open('group-vegas');
    const sheet = await openSheet();

    // The menu and the confirm take the sheet's place, with the list hidden under them.
    fireEvent.press(sheet.getByTestId('plan-members-sheet-user-blake-menu'));
    const menu = screen.getByTestId('plan-members-sheet-member-menu');
    expect(menu).toHaveTextContent(/^BlakeRemove from tripCancel$/);
    expect(screen.queryByTestId('plan-members-sheet')).toBeNull();
    expect(screen.queryByText('Trip members')).toBeNull();
    await pressInSheet('Remove from trip');
    expect(screen.queryByTestId('plan-members-sheet-member-menu')).toBeNull();
    expect(screen.getByTestId('plan-members-sheet-remove-confirm')).toHaveTextContent(
      'Remove Blake from the trip?What they added stays on the trip.RemoveCancel',
    );
    await pressInSheet('Remove');

    await waitFor(() => expect(sheet.queryByTestId('plan-members-sheet-user-blake')).toBeNull());
    expect(avatars('plan-members')).toEqual(['user-willem', 'user-matthew']);
    expect(screen.queryByTestId('plan-members-sheet-remove-confirm')).toBeNull();
    expect(screen.getByText('Trip members')).toBeOnTheScreen();
    for (const spy of native) expect(spy).not.toHaveBeenCalled();
  });

  it('cancelling the menu or the confirm keeps Blake and goes back to the list', async () => {
    await open('group-vegas');
    const sheet = await openSheet();
    fireEvent.press(sheet.getByTestId('plan-members-sheet-user-blake-menu'));
    await pressInSheet('Cancel');
    expect(screen.queryByTestId('plan-members-sheet-member-menu')).toBeNull();

    fireEvent.press(sheet.getByTestId('plan-members-sheet-user-blake-menu'));
    await pressInSheet('Remove from trip');
    await pressInSheet('Cancel');
    expect(screen.queryByTestId('plan-members-sheet-remove-confirm')).toBeNull();
    expect(screen.getByTestId('plan-members-sheet')).toBeOnTheScreen();
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
    const native = spyNativeDialogs();
    await open('group-vegas-member');
    const sheet = await openSheet();
    fireEvent.press(sheet.getByTestId('plan-members-sheet-leave'));
    expect(screen.getByTestId('plan-members-sheet-leave-confirm')).toHaveTextContent(
      'Leave Las Vegas?The trip disappears from your trips. What you added stays.LeaveCancel',
    );
    await pressInSheet('Leave');
    for (const spy of native) expect(spy).not.toHaveBeenCalled();

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
