import * as Linking from 'expo-linking';

import { supabase } from '@/services/supabase';

import { authErrorMessage, authMessages } from './errors';
import { normalizeEmail } from './validation';

/** Every call resolves to an error message in plain words, or null on success. Never throws. */
export type AuthResult = { error: string | null };

async function run(
  action: Parameters<typeof authErrorMessage>[1],
  call: () => Promise<{ error: unknown }>,
): Promise<AuthResult> {
  try {
    const { error } = await call();
    return { error: error ? authErrorMessage(error, action) : null };
  } catch (error) {
    return { error: authErrorMessage(error, action) };
  }
}

/** Creates the account and signs in straight away (email confirmation is off, TR-4). */
export async function signUpWithEmail(email: string, password: string): Promise<AuthResult> {
  let signedIn = true;
  const result = await run('sign-up', async () => {
    const { data, error } = await supabase.auth.signUp({ email: normalizeEmail(email), password });
    signedIn = !!data?.session;
    return { error };
  });
  // Only if email confirmation is ever switched back on: the account exists but has no session yet.
  if (!result.error && !signedIn) return { error: authMessages.confirmEmail };
  return result;
}

export function signInWithEmail(email: string, password: string): Promise<AuthResult> {
  return run('sign-in', () =>
    supabase.auth.signInWithPassword({ email: normalizeEmail(email), password }),
  );
}

/** Where the reset email's link sends the user: `trip://auth/reset` (exp://…/--/auth/reset in Expo Go). */
export function passwordResetRedirect(): string {
  return Linking.createURL('auth/reset');
}

/** Sends Supabase's password reset email. */
export function sendPasswordReset(email: string): Promise<AuthResult> {
  return run('reset', () =>
    supabase.auth.resetPasswordForEmail(normalizeEmail(email), {
      redirectTo: passwordResetRedirect(),
    }),
  );
}

/**
 * Signs out on this device. The session is cleared locally even when offline, so the user always
 * lands back on Welcome. The Settings button arrives with TR-11.
 */
export function signOut(): Promise<AuthResult> {
  return run('sign-in', () => supabase.auth.signOut({ scope: 'local' }));
}
