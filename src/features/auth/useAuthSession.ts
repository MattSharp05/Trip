import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

import { supabase } from '@/services/supabase';

export type AuthState =
  { status: 'loading' } | { status: 'signedOut' } | { status: 'signedIn'; session: Session };

/** The parts of `supabase.auth` the hook needs, so tests can pass a fake. */
export type SessionSource = Pick<typeof supabase.auth, 'getSession' | 'onAuthStateChange'>;

function toState(session: Session | null): AuthState {
  return session ? { status: 'signedIn', session } : { status: 'signedOut' };
}

/**
 * The current auth state: `loading` while the stored session is read from the Keychain, then
 * `signedIn` or `signedOut`, following every sign-in, sign-out and token refresh.
 */
export function useAuthSession(source: SessionSource = supabase.auth): AuthState {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    const {
      data: { subscription },
    } = source.onAuthStateChange((_event, session) => {
      if (active) setState(toState(session));
    });

    // onAuthStateChange also reports the stored session, but only once supabase-js has finished
    // initialising; reading it here as well settles `loading` either way. An event that already
    // arrived wins over this read.
    source
      .getSession()
      .then(({ data }) => data.session)
      .catch(() => null)
      .then((session) => {
        if (active) setState((prev) => (prev.status === 'loading' ? toState(session) : prev));
      });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [source]);

  return state;
}
