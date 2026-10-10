import type { Session } from '@supabase/supabase-js';
import { router as nav } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import TabLayout from '../app/(tabs)/_layout';
import DiscoverScreen from '../app/(tabs)/discover/index';
import OrganizeScreen from '../app/(tabs)/organize/index';
import PlanScreen from '../app/(tabs)/plan/index';
import TripsScreen from '../app/(tabs)/trips/index';
import AuthLayout from '../app/auth/_layout';
import Welcome from '../app/auth/index';
import DevIndex from '../app/dev/index';
import ScenarioRoute from '../app/scenario/[name]';
import SettingsLayout from '../app/settings/_layout';
import Currency from '../app/settings/currency';
import Settings from '../app/settings/index';
import Privacy from '../app/settings/privacy';
import Terms from '../app/settings/terms';
import RootLayout from '../app/_layout';
import Index from '../app/index';
import { DayHeader } from '@/features/plan';
import { emitAuthChange, fakeAuth, resetFakeAuth, testSession } from '@/features/auth/testing';
import { clearPreferenceCache, useTemperatureUnit } from '@/features/settings';
import * as prefs from '@/features/settings/preferences';
import { usePreferenceStore } from '@/features/settings/usePreferences';
import { exitScenario, loadScenario } from '@/scenarios';
import { queryClient } from '@/services/data/hooks';
import { useTripStore } from '@/stores/trip';

const mockUpdateUser = jest.fn();
jest.mock('@/services/supabase', () => {
  const { fakeAuth: auth } = require('@/features/auth/testing');
  return {
    supabase: {
      auth: { ...auth, updateUser: (...args: unknown[]) => mockUpdateUser(...args) },
      // The real account's selected trip opens a live-updates channel (TR-54).
      channel: () => {
        const channel = { on: () => channel, subscribe: () => channel };
        return channel;
      },
      removeChannel: async () => 'ok',
    },
  };
});

/** Like supabase-js: saving metadata reports the updated user to every auth listener. */
function saveMetadata({ data }: { data: Record<string, unknown> }) {
  const session = {
    ...testSession,
    user: { ...testSession.user, user_metadata: data },
  } as Session;
  emitAuthChange('USER_UPDATED', session);
  return Promise.resolve({ data: { user: session.user }, error: null });
}

/** Somewhere else in the app that shows a temperature, reading the shared preference. */
function WeatherProbe() {
  const unit = useTemperatureUnit();
  return (
    <DayHeader
      day="2026-11-13"
      weather={{ day: '2026-11-13', code: 0, highC: 24, lowC: 13 }}
      unit={unit}
    />
  );
}

const routes = {
  _layout: RootLayout,
  index: Index,
  '(tabs)/_layout': TabLayout,
  '(tabs)/trips/index': TripsScreen,
  '(tabs)/plan/index': PlanScreen,
  '(tabs)/organize/index': OrganizeScreen,
  '(tabs)/discover/index': DiscoverScreen,
  'auth/_layout': AuthLayout,
  'auth/index': Welcome,
  'dev/index': DevIndex,
  'dev/gallery': () => null,
  'scenario/[name]': ScenarioRoute,
  'settings/_layout': SettingsLayout,
  'settings/index': () => (
    <>
      <Settings />
      <WeatherProbe />
    </>
  ),
  'settings/currency': Currency,
  'settings/terms': Terms,
  'settings/privacy': Privacy,
};

beforeEach(() => {
  jest.spyOn(prefs, 'deviceLocale').mockReturnValue('en-US');
  mockUpdateUser.mockReset().mockImplementation(saveMetadata);
  clearPreferenceCache();
  act(() => exitScenario());
});

describe('settings', () => {
  it('opens from the profile button on Trips and shows the account', async () => {
    resetFakeAuth(testSession);
    const router = renderRouter(routes, { initialUrl: '/trips' });
    fireEvent.press(await screen.findByRole('button', { name: 'Settings' }));
    expect(await screen.findByText('test@example.com')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/settings');
    expect(screen.getByTestId('settings-sign-out')).toBeOnTheScreen();
    expect(screen.getByText('Trip 1.0.0')).toBeOnTheScreen();
  });

  it('switches temperatures shown elsewhere to °C and saves it to the account', async () => {
    resetFakeAuth(testSession);
    renderRouter(routes, { initialUrl: '/settings' });
    expect(await screen.findByText('75°')).toBeOnTheScreen();
    expect(screen.getByText('55°')).toBeOnTheScreen();

    await act(async () => fireEvent.press(screen.getByRole('tab', { name: '°C' })));

    expect(screen.getByText('24°')).toBeOnTheScreen();
    expect(screen.getByText('13°')).toBeOnTheScreen();
    expect(mockUpdateUser).toHaveBeenCalledWith({
      data: {
        preferences: { temperatureUnit: 'celsius', distanceUnit: 'miles', homeCurrency: 'USD' },
      },
    });
  });

  it('reads saved preferences from the account at launch', async () => {
    resetFakeAuth({
      ...testSession,
      user: {
        ...testSession.user,
        user_metadata: { preferences: { temperatureUnit: 'celsius', distanceUnit: 'km' } },
      },
    } as Session);
    renderRouter(routes, { initialUrl: '/settings' });
    expect(await screen.findByText('24°')).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Km' })).toBeSelected();
  });

  it('puts the unit back and says so when saving fails', async () => {
    resetFakeAuth(testSession);
    mockUpdateUser.mockResolvedValue({ data: {}, error: new Error('offline') });
    renderRouter(routes, { initialUrl: '/settings' });
    await screen.findByText('75°');

    await act(async () => fireEvent.press(screen.getByRole('tab', { name: '°C' })));

    expect(screen.getByText('75°')).toBeOnTheScreen();
    expect(
      screen.getByText("Couldn't save that. Check your connection and try again."),
    ).toBeOnTheScreen();
  });

  it('picks a home currency from the list', async () => {
    resetFakeAuth(testSession);
    const router = renderRouter(routes, { initialUrl: '/settings' });
    fireEvent.press(await screen.findByTestId('settings-currency'));
    expect(router.getPathname()).toBe('/settings/currency');
    expect(screen.getByRole('button', { name: 'US dollar, USD' })).toBeSelected();

    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Euro, EUR' })));

    await waitFor(() => expect(router.getPathname()).toBe('/settings'));
    expect(screen.getByTestId('settings-currency')).toHaveTextContent(/EUR/);
    expect(mockUpdateUser).toHaveBeenCalledWith({
      data: { preferences: expect.objectContaining({ homeCurrency: 'EUR' }) },
    });
  });

  it('signs out after confirming, back to Welcome with cached data cleared', async () => {
    resetFakeAuth(testSession);
    fakeAuth.signOut.mockImplementation(async () => {
      emitAuthChange('SIGNED_OUT', null);
      return { data: {}, error: null };
    });
    const router = renderRouter(routes, { initialUrl: '/trips' });
    await screen.findByRole('header', { name: 'My Trips' });
    act(() => useTripStore.getState().selectTrip('trip-1'));
    expect(queryClient.getQueryCache().getAll().length).toBeGreaterThan(0);

    fireEvent.press(screen.getByRole('button', { name: 'Settings' }));
    fireEvent.press(await screen.findByTestId('settings-sign-out'));
    expect(fakeAuth.signOut).not.toHaveBeenCalled();
    await act(async () => fireEvent.press(screen.getByTestId('sign-out-confirm')));

    expect(fakeAuth.signOut).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('button', { name: 'Continue with email' })).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/auth');
    expect(useTripStore.getState().selectedTripId).toBeNull();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });

  it('keeps Settings behind sign-in', async () => {
    resetFakeAuth(null);
    const router = renderRouter(routes, { initialUrl: '/settings' });
    expect(await screen.findByRole('button', { name: 'Continue with email' })).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/auth');
  });

  it('shows Demo data in a scenario session and keeps changes off the server', async () => {
    resetFakeAuth(null);
    const router = renderRouter(routes, { initialUrl: '/scenario/vegas-plan-day-2' });
    await waitFor(() => expect(router.getPathname()).toBe('/plan'));
    act(() => nav.push('/settings'));

    expect(await screen.findByText('Demo data')).toBeOnTheScreen();
    expect(screen.queryByTestId('settings-sign-out')).toBeNull();
    await act(async () => fireEvent.press(screen.getByRole('tab', { name: '°C' })));
    expect(screen.getByText('24°')).toBeOnTheScreen();
    expect(mockUpdateUser).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId('settings-dev'));
    expect(router.getPathname()).toBe('/dev');

    // Opening the scenario again starts from its defaults.
    act(() => void loadScenario('vegas-plan-day-2'));
    expect(usePreferenceStore.getState().changes).toEqual({});
  });

  it('shows Terms and Privacy as readable pages', async () => {
    resetFakeAuth(testSession);
    const router = renderRouter(routes, { initialUrl: '/settings' });
    fireEvent.press(await screen.findByRole('button', { name: 'Terms of Use' }));
    expect(router.getPathname()).toBe('/settings/terms');
    expect(await screen.findByRole('header', { name: 'A demo, as is' })).toBeOnTheScreen();

    act(() => nav.back());
    fireEvent.press(await screen.findByRole('button', { name: 'Privacy' }));
    expect(router.getPathname()).toBe('/settings/privacy');
    expect(screen.getByText(/never sent to Gemini or any other AI/)).toBeOnTheScreen();
    for (const service of ['Supabase', 'Google Gemini', 'Ticketmaster', 'Open-Meteo', 'Unsplash']) {
      expect(screen.getAllByText(new RegExp(service)).length).toBeGreaterThan(0);
    }
  });
});
