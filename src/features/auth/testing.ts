import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

type Listener = (event: AuthChangeEvent, session: Session | null) => void;

/**
 * Test-only stand-in for `supabase.auth`. Route tests replace the client with it:
 *
 *   jest.mock('@/services/supabase', () => ({
 *     supabase: { auth: require('@/features/auth/testing').fakeAuth },
 *   }));
 *
 * then call `resetFakeAuth(testSession)` (signed in) or `resetFakeAuth(null)` in `beforeEach`.
 */
export const testSession = {
  access_token: 'test-access-token',
  refresh_token: 'test-refresh-token',
  expires_in: 3600,
  token_type: 'bearer',
  user: { id: 'test-user', email: 'test@example.com' },
} as Session;

const listeners = new Set<Listener>();
let current: Session | null = null;

const ok = { data: {}, error: null };

// Like the real client with email confirmation off: signing up or in stores a session and reports it.
async function signIn() {
  emitAuthChange('SIGNED_IN', testSession);
  return { data: { session: testSession, user: testSession.user }, error: null };
}

export const fakeAuth = {
  getSession: jest.fn(async () => ({ data: { session: current }, error: null })),
  onAuthStateChange: jest.fn((listener: Listener) => {
    listeners.add(listener);
    return { data: { subscription: { unsubscribe: () => listeners.delete(listener) } } };
  }),
  signUp: jest.fn(signIn),
  signInWithPassword: jest.fn(signIn),
  resetPasswordForEmail: jest.fn(async () => ok),
  signOut: jest.fn(async () => ok),
  startAutoRefresh: jest.fn(),
  stopAutoRefresh: jest.fn(),
};

/** Sets the stored session and clears recorded calls; listeners from unmounted trees are dropped. */
export function resetFakeAuth(session: Session | null) {
  current = session;
  listeners.clear();
  fakeAuth.signUp.mockReset().mockImplementation(signIn);
  fakeAuth.signInWithPassword.mockReset().mockImplementation(signIn);
  fakeAuth.resetPasswordForEmail.mockReset().mockImplementation(async () => ok);
  fakeAuth.signOut.mockReset().mockImplementation(async () => ok);
}

/** Simulates supabase-js reporting an auth change (sign-in after sign-up, sign-out…). */
export function emitAuthChange(event: AuthChangeEvent, session: Session | null) {
  current = session;
  listeners.forEach((listener) => listener(event, session));
}
