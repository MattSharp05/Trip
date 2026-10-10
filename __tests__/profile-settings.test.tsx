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
import SignUp from '../app/auth/sign-up';
import ScenarioRoute from '../app/scenario/[name]';
import SettingsLayout from '../app/settings/_layout';
import Settings from '../app/settings/index';
import Payment from '../app/settings/payment';
import Profile from '../app/settings/profile';
import RootLayout from '../app/_layout';
import Index from '../app/index';
import { fakeAuth, resetFakeAuth, testSession } from '@/features/auth/testing';
import { askForName, clearPreferenceCache } from '@/features/settings';
import { exitScenario } from '@/scenarios';
import { createDemoSource, useActiveSource, useDataSource } from '@/services/data';
import type { DataSnapshot } from '@/services/data';
import { queryClient } from '@/services/data/hooks';

const mockUpdateUser = jest.fn();
const mockProfileWrite = jest.fn();
jest.mock('@/services/supabase', () => {
  const { fakeAuth: auth } = require('@/features/auth/testing');
  return {
    supabase: {
      auth: { ...auth, updateUser: (...args: unknown[]) => mockUpdateUser(...args) },
      from: (table: string) => ({
        update: (values: unknown) => ({
          eq: (column: string, value: string) => {
            mockProfileWrite(table, values, column, value);
            return {
              select: () => ({
                single: async () => ({ data: { id: value, display_name: 'x' }, error: null }),
              }),
            };
          },
        }),
      }),
    },
  };
});

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
  'auth/sign-up': SignUp,
  'scenario/[name]': ScenarioRoute,
  'dev/gallery': () => null,
  'dev/push': () => null,
  'settings/_layout': SettingsLayout,
  'settings/index': Settings,
  'settings/profile': Profile,
  'settings/payment': Payment,
};

/** A signed-in account whose name is still the placeholder made from test@example.com. */
const placeholderAccount: DataSnapshot = {
  trips: [],
  places: [],
  items: [],
  bookings: [],
  bucketItems: [],
  expenses: [],
  documents: [],
  me: testSession.user.id,
  members: [],
  profiles: [{ id: testSession.user.id, displayName: 'test' }],
};

const withMetadata = (data: Record<string, unknown>) =>
  ({ ...testSession, user: { ...testSession.user, user_metadata: data } }) as Session;

/** Reads what the active data source holds for "my profile". */
let readProfile: () => ReturnType<ReturnType<typeof useDataSource>['getMyProfile']>;

beforeEach(() => {
  mockUpdateUser.mockReset().mockResolvedValue({ data: {}, error: null });
  mockProfileWrite.mockReset();
  clearPreferenceCache();
  act(() => exitScenario());
  queryClient.clear();
});

afterEach(() => {
  act(() => exitScenario());
});

function useAccount(snapshot: DataSnapshot) {
  const source = createDemoSource(snapshot, 'account');
  act(() => useActiveSource.setState({ source }));
  readProfile = () => source.getMyProfile();
}

describe('your name at sign-up', () => {
  it('asks for a name first and saves it to the profile', async () => {
    resetFakeAuth(null);
    renderRouter(routes, { initialUrl: '/auth/sign-up' });

    fireEvent.changeText(await screen.findByTestId('auth-email'), 'new@example.com');
    fireEvent.changeText(screen.getByTestId('auth-password'), 'long enough');
    fireEvent.press(screen.getByTestId('auth-submit'));
    expect(screen.getByTestId('auth-name-error')).toHaveTextContent('Enter your name.');
    expect(fakeAuth.signUp).not.toHaveBeenCalled();

    fireEvent.changeText(screen.getByTestId('auth-name'), ' Matthew ');
    await act(async () => fireEvent.press(screen.getByTestId('auth-submit')));

    expect(fakeAuth.signUp).toHaveBeenCalledWith({
      email: 'new@example.com',
      password: 'long enough',
      options: { data: { name_prompt: 'saved' } },
    });
    expect(mockProfileWrite).toHaveBeenCalledWith(
      'profiles',
      { display_name: 'Matthew', venmo: null, cashapp: null, zelle: null },
      'id',
      testSession.user.id,
    );
    expect(await screen.findByRole('header', { name: 'My Trips' })).toBeOnTheScreen();
  });
});

describe('the one-time name sheet', () => {
  it('asks a placeholder name once; after saving, never again', async () => {
    resetFakeAuth(testSession);
    useAccount(placeholderAccount);
    const first = renderRouter(routes, { initialUrl: '/trips' });

    expect(await screen.findByText('What should friends call you?')).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId('name-prompt-save'));
    expect(screen.getByTestId('name-prompt-input-error')).toHaveTextContent('Enter your name.');

    fireEvent.changeText(screen.getByTestId('name-prompt-input'), 'Blake');
    await act(async () => fireEvent.press(screen.getByTestId('name-prompt-save')));

    expect((await readProfile()).displayName).toBe('Blake');
    expect(mockUpdateUser).toHaveBeenCalledWith({ data: { name_prompt: 'saved' } });
    first.unmount();

    // Next launch, even before the profile changes are seen: saved means never again.
    queryClient.clear();
    useAccount(placeholderAccount);
    resetFakeAuth(withMetadata({ name_prompt: 'saved' }));
    renderRouter(routes, { initialUrl: '/trips' });
    expect(await screen.findByRole('header', { name: 'My Trips' })).toBeOnTheScreen();
    act(() => askForName());
    await act(async () => {});
    expect(screen.queryByText('What should friends call you?')).toBeNull();
  });

  it('after a dismissal, asks again only from a group feature', async () => {
    resetFakeAuth(testSession);
    useAccount(placeholderAccount);
    const first = renderRouter(routes, { initialUrl: '/trips' });
    fireEvent.press(await screen.findByTestId('name-prompt-skip'));
    expect(mockUpdateUser).toHaveBeenCalledWith({ data: { name_prompt: 'dismissed' } });
    first.unmount();

    queryClient.clear();
    resetFakeAuth(withMetadata({ name_prompt: 'dismissed' }));
    renderRouter(routes, { initialUrl: '/trips' });
    expect(await screen.findByRole('header', { name: 'My Trips' })).toBeOnTheScreen();
    await act(async () => {});
    expect(screen.queryByText('What should friends call you?')).toBeNull();

    act(() => askForName());
    expect(await screen.findByText('What should friends call you?')).toBeOnTheScreen();
  });

  it('never asks an account that already has a name', async () => {
    resetFakeAuth(testSession);
    useAccount({ ...placeholderAccount, profiles: [{ id: 'test-user', displayName: 'Matthew' }] });
    renderRouter(routes, { initialUrl: '/trips' });
    expect(await screen.findByRole('header', { name: 'My Trips' })).toBeOnTheScreen();
    await act(async () => {});
    expect(screen.queryByText('What should friends call you?')).toBeNull();
  });
});

describe('Settings → Profile', () => {
  it('changes your name', async () => {
    resetFakeAuth(testSession);
    useAccount({ ...placeholderAccount, profiles: [{ id: 'test-user', displayName: 'Matthew' }] });
    const router = renderRouter(routes, { initialUrl: '/settings' });

    fireEvent.press(await screen.findByTestId('settings-name'));
    const input = await screen.findByTestId('profile-name-input');
    expect(input).toHaveDisplayValue('Matthew');
    fireEvent.changeText(input, 'Matt');
    await act(async () => fireEvent.press(screen.getByTestId('profile-name-save')));

    await waitFor(() => expect(router.getPathname()).toBe('/settings'));
    expect((await readProfile()).displayName).toBe('Matt');
  });

  it('validates and saves payment info in a demo session; empty fields save as not set', async () => {
    resetFakeAuth(null);
    const router = renderRouter(routes, { initialUrl: '/scenario/group-vegas' });
    await waitFor(() => expect(router.getPathname()).toBe('/plan'));
    act(() => nav.push('/settings'));

    await waitFor(() =>
      expect(screen.getByTestId('settings-payment')).toHaveTextContent(/Not set/),
    );
    fireEvent.press(screen.getByTestId('settings-payment'));
    expect(
      await screen.findByText('Friends on your trips see these when they settle up.'),
    ).toBeOnTheScreen();

    fireEvent.changeText(screen.getByTestId('payment-venmo'), 'matt sharp');
    fireEvent.changeText(screen.getByTestId('payment-zelle'), '555-0142');
    await act(async () => fireEvent.press(screen.getByTestId('payment-save')));
    expect(screen.getByTestId('payment-venmo-error')).toHaveTextContent(
      'Use letters, numbers, - and _ only.',
    );
    expect(screen.getByTestId('payment-zelle-error')).toHaveTextContent(
      'Enter an email or a US phone number.',
    );

    fireEvent.changeText(screen.getByTestId('payment-venmo'), '@matt-sharp');
    fireEvent.changeText(screen.getByTestId('payment-zelle'), '212 555 0142');
    await act(async () => fireEvent.press(screen.getByTestId('payment-save')));

    await waitFor(() => expect(router.getPathname()).toBe('/settings'));
    await waitFor(() =>
      expect(screen.getByTestId('settings-payment')).toHaveTextContent(/Venmo, Zelle/),
    );
    const profile = await useActiveSource.getState().source.getMyProfile();
    expect(profile).toEqual({
      id: profile.id,
      displayName: 'Matthew',
      venmo: 'matt-sharp',
      zelle: '(212) 555-0142',
    });
    // Nothing reached the server.
    expect(mockUpdateUser).not.toHaveBeenCalled();
    expect(mockProfileWrite).not.toHaveBeenCalled();
  });
});
