import { act, renderHook } from '@testing-library/react-native';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

import {
  forgetInvite,
  rememberInvite,
  resetPendingInvite,
  useReturnToInvite,
} from './pendingInvite';

const mockStore = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => void mockStore.set(key, value)),
  deleteItemAsync: jest.fn(async (key: string) => void mockStore.delete(key)),
}));
jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));

const TOKEN = 'Ab3_-xYz0123456789abcd';
const KEY = 'trip.pendingInvite';

beforeEach(() => {
  mockStore.clear();
  resetPendingInvite();
  jest.mocked(router.replace).mockClear();
});

async function launch(signedIn: boolean) {
  const hook = renderHook(({ on }: { on: boolean }) => useReturnToInvite(on), {
    initialProps: { on: signedIn },
  });
  await act(async () => {});
  return hook;
}

describe('the invite kept through sign-in', () => {
  it('opens once signed in', async () => {
    const hook = await launch(false);
    act(() => rememberInvite(TOKEN));
    expect(router.replace).not.toHaveBeenCalled();
    expect(mockStore.get(KEY)).toMatch(new RegExp(` ${TOKEN}$`));

    hook.rerender({ on: true });
    expect(router.replace).toHaveBeenCalledWith(`/invite/${TOKEN}`);

    act(() => forgetInvite());
    await act(async () => {});
    expect(mockStore.has(KEY)).toBe(false);
  });

  it('survives a relaunch', async () => {
    mockStore.set(KEY, `${Date.now() - 60_000} ${TOKEN}`);
    await launch(true);
    expect(router.replace).toHaveBeenCalledWith(`/invite/${TOKEN}`);
  });

  it('is dropped after a day, or when it is not a token', async () => {
    mockStore.set(KEY, `${Date.now() - 25 * 60 * 60 * 1000} ${TOKEN}`);
    await launch(true);
    resetPendingInvite();
    mockStore.set(KEY, `${Date.now()} ../evil?x=1`);
    await launch(true);
    mockStore.set(KEY, TOKEN);
    resetPendingInvite();
    await launch(true);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('is not brought back by a late read once the invite was handled', async () => {
    jest.mocked(SecureStore.getItemAsync).mockImplementationOnce(async () => {
      forgetInvite();
      return `${Date.now()} ${TOKEN}`;
    });
    await launch(true);
    expect(router.replace).not.toHaveBeenCalled();
  });
});
