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

/**
 * Creates the account and signs in straight away (email confirmation is off, TR-4), then saves the
 * traveller's name to their profile (TR-55). The account remembers it was named at sign-up, so the
 * one-time name sheet stays away; if saving the name fails, that is undone and the sheet asks later.
 */
export async function signUpWithEmail(
  name: string,
  email: string,
  password: string,
): Promise<AuthResult> {
  const created: { userId?: string } = {};
  const result = await run('sign-up', async () => {
    const { data, error } = await supabase.auth.signUp({
      email: normalizeEmail(email),
      password,
      options: { data: { name_prompt: 'saved' } },
    });
    created.userId = data?.session?.user.id;
    return { error };
  });
  if (result.error) return result;
  // Only if email confirmation is ever switched back on: the account exists but has no session yet.
  if (!created.userId) return { error: authMessages.confirmEmail };
  await saveName(created.userId, name);
  return result;
}

/** Writes the name over the one the database made up from the email. Never throws. */
async function saveName(userId: string, name: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: name.trim() })
      .eq('id', userId);
    if (!error) return;
  } catch {
    // Handled below.
  }
  try {
    await supabase.auth.updateUser({ data: { name_prompt: null } });
  } catch {
    // Offline as well: the name stays the placeholder until it is changed in Settings.
  }
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
