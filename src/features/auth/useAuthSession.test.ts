import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useAuthSession, type SessionSource } from './useAuthSession';

jest.mock('@/services/supabase', () => ({ supabase: { auth: {} } }));

const session = { access_token: 'token', user: { id: 'user-1' } } as Session;

function fakeSource(stored: Session | null | Promise<never>) {
  let listener: (event: AuthChangeEvent, session: Session | null) => void = () => {};
  const unsubscribe = jest.fn();
  const source = {
    getSession: jest.fn(() =>
      stored instanceof Promise
        ? stored
        : Promise.resolve({ data: { session: stored }, error: null }),
    ),
    onAuthStateChange: jest.fn((callback) => {
      listener = callback;
      return { data: { subscription: { id: 'sub', callback, unsubscribe } } };
    }),
  } as unknown as SessionSource;
  return { source, unsubscribe, emit: (e: AuthChangeEvent, s: Session | null) => listener(e, s) };
}

describe('useAuthSession', () => {
  it('starts loading, then reports the stored session', async () => {
    const { source } = fakeSource(session);
    const { result } = renderHook(() => useAuthSession(source));
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current).toEqual({ status: 'signedIn', session }));
  });

  it('reports signed out when nothing is stored', async () => {
    const { source } = fakeSource(null);
    const { result } = renderHook(() => useAuthSession(source));
    await waitFor(() => expect(result.current).toEqual({ status: 'signedOut' }));
  });

  it('treats an unreadable session as signed out', async () => {
    const { source } = fakeSource(Promise.reject(new Error('keychain')));
    const { result } = renderHook(() => useAuthSession(source));
    await waitFor(() => expect(result.current).toEqual({ status: 'signedOut' }));
  });

  it('follows sign-in and sign-out events', async () => {
    const { source, emit } = fakeSource(null);
    const { result } = renderHook(() => useAuthSession(source));
    await waitFor(() => expect(result.current.status).toBe('signedOut'));

    act(() => emit('SIGNED_IN', session));
    expect(result.current).toEqual({ status: 'signedIn', session });

    act(() => emit('SIGNED_OUT', null));
    expect(result.current).toEqual({ status: 'signedOut' });
  });

  it('lets an event that arrives first win over the stored-session read', async () => {
    let resolve: (value: unknown) => void = () => {};
    const pending = new Promise((r) => (resolve = r));
    const { source, emit } = fakeSource(null);
    (source.getSession as jest.Mock).mockReturnValue(pending);
    const { result } = renderHook(() => useAuthSession(source));

    act(() => emit('SIGNED_IN', session));
    await act(async () => resolve({ data: { session: null }, error: null }));
    expect(result.current).toEqual({ status: 'signedIn', session });
  });

  it('unsubscribes on unmount', () => {
    const { source, unsubscribe } = fakeSource(null);
    const { unmount } = renderHook(() => useAuthSession(source));
    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });
});
