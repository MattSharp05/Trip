import { act, fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
import { Alert, Share, type AlertButton } from 'react-native';

import TabLayout from '../app/(tabs)/_layout';
import DiscoverScreen from '../app/(tabs)/discover/index';
import OrganizeScreen from '../app/(tabs)/organize/index';
import PlanScreen from '../app/(tabs)/plan/index';
import TripsScreen from '../app/(tabs)/trips/index';
import AuthLayout from '../app/auth/_layout';
import Welcome from '../app/auth/index';
import SignIn from '../app/auth/sign-in';
import SignUp from '../app/auth/sign-up';
import InviteRoute from '../app/invite/[token]';
import ScenarioRoute from '../app/scenario/[name]';
import RootLayout from '../app/_layout';
import Index from '../app/index';
import { resetPendingInvite } from '@/features/auth/pendingInvite';
import { resetFakeAuth, testSession } from '@/features/auth/testing';
import { clearPreferenceCache } from '@/features/settings';
import { exitScenario } from '@/scenarios';
import { groupInviteSnapshot, VEGAS_INVITE_TOKEN } from '@/scenarios/fixtures/group';
import { VEGAS_TRIP_ID } from '@/scenarios/fixtures/vegas';
import { createDemoSource, useActiveSource, type DataSnapshot } from '@/services/data';
import { queryClient } from '@/services/data/hooks';
import { useTripStore } from '@/stores/trip';

// Auth is the fake client; the account's data is a demo source standing in for the RPCs.
jest.mock('@/services/supabase', () => {
  const { fakeAuth } = require('@/features/auth/testing');
  return {
    supabase: {
      auth: { ...fakeAuth, updateUser: async () => ({ data: {}, error: null }) },
      // Sign-up saves the name to the profile.
      from: () => ({
        update: () => ({
          eq: (_: string, id: string) => ({
            select: () => ({
              single: async () => ({ data: { id, display_name: 'Alex' }, error: null }),
            }),
          }),
        }),
      }),
    },
  };
});
jest.mock('@/services/photos', () => ({ findCoverPhoto: async () => null }));

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
  'auth/sign-in': SignIn,
  'invite/[token]': InviteRoute,
  'scenario/[name]': ScenarioRoute,
  'dev/gallery': () => null,
  'dev/push': () => null,
};

const ME = testSession.user.id;
const INVITE = `/invite/${VEGAS_INVITE_TOKEN}`;

/** The signed-in account (Alex, on no trip yet) with Matthew's invite to Las Vegas. */
const account = (patch: Partial<DataSnapshot> = {}): DataSnapshot => ({
  ...groupInviteSnapshot,
  me: ME,
  profiles: [...groupInviteSnapshot.profiles, { id: ME, displayName: 'Alex' }],
  ...patch,
});

function useAccount(snapshot: DataSnapshot) {
  const source = createDemoSource(snapshot, 'account');
  act(() => useActiveSource.setState({ source }));
  return source;
}

beforeEach(() => {
  resetPendingInvite();
  clearPreferenceCache();
  queryClient.clear();
  useTripStore.getState().selectTrip(null);
  global.fetch = jest.fn(async () => {
    throw new Error('offline');
  }) as unknown as typeof fetch;
});
afterEach(() => {
  act(() => exitScenario());
  jest.restoreAllMocks();
});

async function joinAndLand(router: ReturnType<typeof renderRouter>) {
  await act(async () => fireEvent.press(screen.getByTestId('invite-preview-join')));
  expect(await screen.findByTestId('plan-header')).toBeOnTheScreen();
  expect(router.getPathname()).toBe('/plan');
  expect(useTripStore.getState().selectedTripId).toBe(VEGAS_TRIP_ID);
}

describe('Opening an invite link', () => {
  it('signed out: keeps the invite through sign-up, then shows it and Join opens Plan', async () => {
    resetFakeAuth(null);
    const source = useAccount(account());
    const router = renderRouter(routes, { initialUrl: INVITE });

    expect(await screen.findByRole('button', { name: 'Continue with email' })).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/auth');

    fireEvent.press(screen.getByRole('button', { name: 'Continue with email' }));
    fireEvent.changeText(await screen.findByTestId('auth-name'), 'Alex');
    fireEvent.changeText(screen.getByTestId('auth-email'), 'alex@example.com');
    fireEvent.changeText(screen.getByTestId('auth-password'), 'long enough');
    await act(async () => fireEvent.press(screen.getByTestId('auth-submit')));

    expect(await screen.findByText('Join Las Vegas')).toBeOnTheScreen();
    expect(router.getPathname()).toBe(INVITE);
    expect(screen.getByText('Nov 12 – 16 · with Matthew and 2 others')).toBeOnTheScreen();

    await joinAndLand(router);
    expect((await source.listMembers(VEGAS_TRIP_ID)).find((m) => m.isMe)?.role).toBe('member');
  });

  it('signed in: shows the preview straight away', async () => {
    resetFakeAuth(testSession);
    useAccount(account());
    const router = renderRouter(routes, { initialUrl: INVITE });

    const card = await screen.findByTestId('invite-preview-card');
    expect(within(card).getByText('Join Las Vegas')).toBeOnTheScreen();
    await joinAndLand(router);
  });

  it('already on the trip: opens it', async () => {
    resetFakeAuth(testSession);
    useAccount(
      account({
        members: [
          ...groupInviteSnapshot.members,
          { tripId: VEGAS_TRIP_ID, userId: ME, role: 'member' },
        ],
      }),
    );
    const router = renderRouter(routes, { initialUrl: INVITE });

    expect(await screen.findByTestId('plan-header')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/plan');
    expect(screen.queryByText('Join Las Vegas')).toBeNull();
  });

  it('a reset or unknown link says it is no longer active', async () => {
    resetFakeAuth(testSession);
    useAccount(
      account({ invites: groupInviteSnapshot.invites!.map((i) => ({ ...i, revoked: true })) }),
    );
    renderRouter(routes, { initialUrl: INVITE });
    expect(
      await screen.findByText('This invite link is no longer active. Ask for a new one.'),
    ).toBeOnTheScreen();
  });

  it('a malformed link says so without asking the server', async () => {
    resetFakeAuth(testSession);
    const source = useAccount(account());
    const preview = jest.spyOn(source, 'previewInvite');
    renderRouter(routes, { initialUrl: '/invite/a.b' });
    expect(await screen.findByTestId('invite-preview-inactive')).toBeOnTheScreen();
    expect(preview).not.toHaveBeenCalled();
  });

  it('asks a placeholder-named account for a name first', async () => {
    resetFakeAuth(testSession);
    useAccount(
      account({
        profiles: [...groupInviteSnapshot.profiles, { id: ME, displayName: 'test' }],
      }),
    );
    renderRouter(routes, { initialUrl: INVITE });
    expect(await screen.findByText('What should friends call you?')).toBeOnTheScreen();
    expect(screen.getByText('Join Las Vegas')).toBeOnTheScreen();
  });
});

describe('group-invite scenario', () => {
  it('shows the preview, and Join adds you in memory and opens Plan', async () => {
    resetFakeAuth(null);
    const router = renderRouter(routes, { initialUrl: '/scenario/group-invite' });

    expect(await screen.findByText('Join Las Vegas')).toBeOnTheScreen();
    expect(screen.getByText('Nov 12 – 16 · with Matthew and 2 others')).toBeOnTheScreen();
    await joinAndLand(router);
    // You join the avatars: Matthew, Blake, Willem, then you.
    expect(await screen.findByTestId('plan-members-user-alex')).toBeOnTheScreen();
  });
});

describe('Invite friends', () => {
  async function pressAlert(text: string) {
    const buttons = jest.mocked(Alert.alert).mock.calls.at(-1)![2] as AlertButton[];
    await act(async () => buttons.find((b) => b.text === text)!.onPress!());
  }

  it('the members sheet shares the link; Reset link makes a new one', async () => {
    jest.spyOn(Alert, 'alert');
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    resetFakeAuth(null);
    renderRouter(routes, { initialUrl: '/scenario/group-vegas' });
    await screen.findByTestId('day-header-weather');

    fireEvent.press(screen.getByTestId('plan-members'));
    const sheet = within(await screen.findByTestId('plan-members-sheet'));
    await act(async () => fireEvent.press(sheet.getByText('Invite friends')));
    const message = share.mock.calls[0][0].message!;
    expect(message).toMatch(
      /^Join my Las Vegas trip on Trip: exp:\/\/u\.expo\.dev\/.+\/--\/invite\/demo-trip-vegas-1\?runtime-version=/,
    );

    // Sharing again reuses the link.
    await act(async () => fireEvent.press(sheet.getByText('Invite friends')));
    expect(share.mock.calls[1][0].message).toBe(message);

    fireEvent.press(sheet.getByText('Reset link'));
    expect(jest.mocked(Alert.alert).mock.calls.at(-1)![0]).toBe('Reset the invite link?');
    await pressAlert('Reset');
    expect(sheet.getByText('Link reset. The old link no longer works.')).toBeOnTheScreen();
    await act(async () => fireEvent.press(sheet.getByText('Invite friends')));
    expect(share.mock.calls[2][0].message).toContain('/invite/demo-trip-vegas-2?');
  });

  it('on a trip with only you, an invite icon opens the same sheet', async () => {
    resetFakeAuth(null);
    renderRouter(routes, { initialUrl: '/scenario/vegas-plan-day-2' });
    await screen.findByTestId('day-header-weather');
    expect(screen.queryByTestId('plan-members')).toBeNull();

    fireEvent.press(screen.getByTestId('plan-members-invite'));
    const sheet = within(await screen.findByTestId('plan-members-sheet'));
    expect(sheet.getByText('Invite friends')).toBeOnTheScreen();
  });
});
