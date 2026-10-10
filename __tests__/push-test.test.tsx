import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import * as Notifications from 'expo-notifications';
import { AppState } from 'react-native';

import DevIndexScreen from '../app/dev/index';
import PushTestScreen, { PUSH_DELAY_MS } from '../app/dev/push';
import RootLayout from '../app/_layout';
import { resetFakeAuth, testSession } from '@/features/auth/testing';
import { sendExpoPush } from '@/services/expoPush';

jest.mock('@/services/supabase', () => ({
  supabase: { auth: require('@/features/auth/testing').fakeAuth },
}));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { eas: { projectId: 'trip-project-id' } } } },
}));
jest.mock('@/services/expoPush', () => ({ sendExpoPush: jest.fn(async () => 'ticket-1') }));

const notifications = Notifications as jest.Mocked<typeof Notifications> & {
  deliver: (notification: unknown) => void;
};

const routes = {
  _layout: RootLayout,
  'dev/index': DevIndexScreen,
  'dev/push': PushTestScreen,
  // The root stack names these; stand-ins keep its warnings out of the output.
  '(tabs)/_layout': () => null,
  'settings/index': () => null,
  'auth/index': () => null,
  'dev/gallery': () => null,
};

/** Holds the 5-second "lock your phone" wait; calling the result ends it. */
function holdPushDelay(): () => void {
  const realSetTimeout = global.setTimeout;
  let release: (() => void) | undefined;
  const spy = jest.spyOn(global, 'setTimeout').mockImplementation(((
    fn: () => void,
    ms?: number,
  ) => {
    if (ms !== PUSH_DELAY_MS) return realSetTimeout(fn, ms);
    release = fn;
    return 0;
  }) as typeof setTimeout);
  return () => {
    spy.mockRestore();
    if (!release) throw new Error('the push delay never started');
    release();
  };
}

beforeEach(() => {
  resetFakeAuth(testSession);
  jest.clearAllMocks();
});

describe('push test (TR-52)', () => {
  it('opens from the developer index', async () => {
    const router = renderRouter(routes, { initialUrl: '/dev' });
    fireEvent.press(await screen.findByRole('button', { name: 'Push test' }));
    expect(router.getPathname()).toBe('/dev/push');
    await act(async () => {});
  });

  it('asks permission, shows the token, sends the push after the delay and sees it arrive', async () => {
    renderRouter(routes, { initialUrl: '/dev/push' });
    fireEvent.press(await screen.findByRole('button', { name: 'Allow notifications' }));

    expect(await screen.findByText('ExponentPushToken[test-token]')).toBeOnTheScreen();
    expect(notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({
      projectId: 'trip-project-id',
    });
    expect(notifications.setNotificationHandler).toHaveBeenCalled();

    const endDelay = holdPushDelay();
    fireEvent.press(screen.getByRole('button', { name: 'Send test push' }));
    expect(await screen.findByText(/Lock your phone now/)).toBeOnTheScreen();
    expect(sendExpoPush).not.toHaveBeenCalled();
    const appState = AppState.currentState;
    AppState.currentState = 'background'; // Matthew locked the phone
    try {
      await act(async () => endDelay());
    } finally {
      AppState.currentState = appState;
    }

    expect(sendExpoPush).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'ExponentPushToken[test-token]',
        data: { tag: 'trip-push-test' },
      }),
    );
    expect(
      await screen.findByText(/Sent at .* with the app in the background \(ticket ticket-1\)/),
    ).toBeOnTheScreen();

    expect(screen.getByTestId('push-arrived')).toHaveTextContent(/Not yet/);
    act(() => notifications.deliver({}));
    expect(screen.getByTestId('push-arrived')).not.toHaveTextContent(/Not yet/);
  });

  it('shows the exact error when Expo Go gives no token', async () => {
    notifications.getPermissionsAsync.mockResolvedValueOnce({
      status: 'granted',
      granted: true,
    } as Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>);
    notifications.getExpoPushTokenAsync.mockRejectedValueOnce(
      new Error('No "projectId" found in Expo Go'),
    );
    renderRouter(routes, { initialUrl: '/dev/push' });

    expect(await screen.findByText('No "projectId" found in Expo Go')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Send test push' })).toBeNull();
  });

  it('shows the error when Expo refuses the push', async () => {
    jest
      .mocked(sendExpoPush)
      .mockRejectedValueOnce(new Error('Expo Push refused it: InvalidCredentials'));
    notifications.getPermissionsAsync.mockResolvedValueOnce({
      status: 'granted',
      granted: true,
    } as Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>);
    renderRouter(routes, { initialUrl: '/dev/push' });

    const button = await screen.findByRole('button', { name: 'Send test push' });
    const endDelay = holdPushDelay();
    fireEvent.press(button);
    await screen.findByText(/Lock your phone now/);
    await act(async () => endDelay());
    expect(await screen.findByText('Expo Push refused it: InvalidCredentials')).toBeOnTheScreen();
  });
});
