import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { create } from 'zustand';

import { isInviteToken } from '@/core/inviteLink';

/**
 * An invite link opened while signed out (TR-57, ADR 0029): the token is kept on the device through
 * Welcome, sign-up or sign-in, then the app goes back to the invite.
 */
const KEY = 'trip.pendingInvite';
/**
 * A kept invite older than this is dropped, so a link opened and abandoned signed out doesn't greet
 * whoever signs in on the phone much later.
 */
const KEEP_MS = 24 * 60 * 60 * 1000;

/** `decided`: set or cleared in this run of the app, so the stored token loading late is ignored. */
const usePendingInvite = create<{ token: string | null; decided: boolean }>()(() => ({
  token: null,
  decided: false,
}));

/** Device storage is best effort: without it the invite is only kept until the app closes. */
async function attempt<T>(action: () => Promise<T>): Promise<T | null> {
  try {
    return await action();
  } catch {
    return null;
  }
}

export function rememberInvite(token: string): void {
  usePendingInvite.setState({ token, decided: true });
  void attempt(() => SecureStore.setItemAsync(KEY, `${Date.now()} ${token}`));
}

/** The invite screen calls this once it's showing the invite to a signed-in traveller. */
export function forgetInvite(): void {
  usePendingInvite.setState({ token: null, decided: true });
  void attempt(() => SecureStore.deleteItemAsync(KEY));
}

/**
 * Mounted in the root layout: once signed in, opens the invite kept from before sign-in (also one
 * kept across a relaunch, e.g. the app closed during sign-up).
 */
export function useReturnToInvite(signedIn: boolean): void {
  const token = usePendingInvite((s) => s.token);

  useEffect(() => {
    void attempt(() => SecureStore.getItemAsync(KEY)).then((stored) => {
      const [at, token] = (stored ?? '').split(' ');
      const fresh = Date.now() - Number(at) < KEEP_MS && isInviteToken(token ?? '');
      if (fresh && !usePendingInvite.getState().decided) {
        usePendingInvite.setState({ token, decided: true });
      }
    });
  }, []);

  useEffect(() => {
    if (signedIn && token) router.replace(`/invite/${token}`);
  }, [signedIn, token]);
}

/** Tests: forget everything, as a fresh launch. */
export function resetPendingInvite(): void {
  usePendingInvite.setState({ token: null, decided: false });
}
