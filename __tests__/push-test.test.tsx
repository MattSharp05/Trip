import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import * as Notifications from 'expo-notifications';
import { AppState, type AppStateStatus } from 'react-native';

import DevIndexScreen from '../app/dev/index';
import PushTestScreen from '../app/dev/push';
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
type Permission = Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>;
const permission = (status: string) => ({ status, granted: status === 'granted' }) as Permission;

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

/** Lets a test move the app to another state (locking makes it 'inactive', then 'background'). */
function appStateListeners() {
  const listeners = new Set<(state: AppStateStatus) => void>();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    listeners.add(listener);
    return { remove: () => listeners.delete(listener) } as ReturnType<
      typeof AppState.addEventListener
    >;
  });
  return (state: AppStateStatus) =>
    act(async () => listeners.forEach((listener) => listener(state)));
}

beforeEach(() => {
  resetFakeAuth(testSession);
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

describe('push test (TR-52)', () => {
  it('opens from the developer index', async () => {
    const router = renderRouter(routes, { initialUrl: '/dev' });
    fireEvent.press(await screen.findByRole('button', { name: 'Push test' }));
    expect(router.getPathname()).toBe('/dev/push');
    await act(async () => {});
  });

  it('asks permission, shows the token and sends the push as the phone locks', async () => {
    const moveTo = appStateListeners();
    renderRouter(routes, { initialUrl: '/dev/push' });
    fireEvent.press(await screen.findByRole('button', { name: 'Allow notifications' }));

    expect(await screen.findByText('ExponentPushToken[test-token]')).toBeOnTheScreen();
    expect(notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({
      projectId: 'trip-project-id',
    });
    expect(notifications.setNotificationHandler).toHaveBeenCalled();

    fireEvent.press(screen.getByRole('button', { name: 'Send when I lock' }));
    expect(await screen.findByText(/Now lock your phone/)).toBeOnTheScreen();
    expect(sendExpoPush).not.toHaveBeenCalled();

    await moveTo('inactive');
    expect(sendExpoPush).toHaveBeenCalledTimes(1);
    expect(sendExpoPush).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'ExponentPushToken[test-token]',
        data: expect.objectContaining({ tag: 'trip-push-test' }),
      }),
    );
    expect(
      await screen.findByText(/Sent at .* with the app in the background \(ticket ticket-1\)/),
    ).toBeOnTheScreen();
    await moveTo('background');
    expect(sendExpoPush).toHaveBeenCalledTimes(1);
  });

  it('sends now with the app open, sees it arrive and sees it opened', async () => {
    notifications.getPermissionsAsync.mockResolvedValueOnce(permission('granted'));
    renderRouter(routes, { initialUrl: '/dev/push' });

    fireEvent.press(await screen.findByRole('button', { name: 'Send now' }));
    expect(
      await screen.findByText(/Sent at .* with the app open \(ticket ticket-1\)/),
    ).toBeOnTheScreen();

    expect(screen.getByTestId('push-arrived')).toHaveTextContent(/Not yet/);
    act(() => notifications.deliver({}));
    expect(screen.getByTestId('push-arrived')).not.toHaveTextContent(/Not yet/);

    // Tapping this run's push opens Trip; an older test push doesn't count.
    const { data } = jest.mocked(sendExpoPush).mock.calls[0][0];
    const response = (run: string) =>
      ({
        notification: { request: { content: { data: { tag: 'trip-push-test', run } } } },
      }) as never;
    notifications.useLastNotificationResponse.mockReturnValue(response('older-run'));
    act(() => notifications.deliver({}));
    expect(screen.getByTestId('push-opened')).toHaveTextContent(/Not yet/);
    notifications.useLastNotificationResponse.mockReturnValue(response(data!.run));
    act(() => notifications.deliver({}));
    expect(screen.getByTestId('push-opened')).toHaveTextContent(/Yes/);
    notifications.useLastNotificationResponse.mockReturnValue(undefined);
  });

  it('shows the exact error when Expo Go gives no token', async () => {
    notifications.getPermissionsAsync.mockResolvedValueOnce(permission('granted'));
    notifications.getExpoPushTokenAsync.mockRejectedValueOnce(
      new Error('No "projectId" found in Expo Go'),
    );
    renderRouter(routes, { initialUrl: '/dev/push' });

    expect(await screen.findByText('No "projectId" found in Expo Go')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Send now' })).toBeNull();
  });

  it('shows the error when Expo refuses the push', async () => {
    jest
      .mocked(sendExpoPush)
      .mockRejectedValueOnce(new Error('Expo Push refused it: InvalidCredentials'));
    notifications.getPermissionsAsync.mockResolvedValueOnce(permission('granted'));
    renderRouter(routes, { initialUrl: '/dev/push' });

    fireEvent.press(await screen.findByRole('button', { name: 'Send now' }));
    expect(await screen.findByText('Expo Push refused it: InvalidCredentials')).toBeOnTheScreen();
  });

  it('says where to turn notifications back on after a denial', async () => {
    notifications.getPermissionsAsync.mockResolvedValueOnce(permission('denied'));
    renderRouter(routes, { initialUrl: '/dev/push' });

    expect(await screen.findByTestId('push-denied')).toHaveTextContent(/Settings app → Expo Go/);
    expect(screen.queryByRole('button', { name: 'Allow notifications' })).toBeNull();
  });
});
