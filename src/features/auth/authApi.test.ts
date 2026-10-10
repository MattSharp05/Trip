import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';

import { supabase } from '@/services/supabase';

import {
  passwordResetRedirect,
  sendPasswordReset,
  signInWithEmail,
  signOut,
  signUpWithEmail,
} from './authApi';

// Under Jest there is no app manifest for expo-linking to read the scheme from.
jest.mock('expo-linking', () => ({ createURL: (path: string) => `trip://${path}` }));
const mockProfileUpdate = jest.fn();
const mockProfileRow = jest.fn();
jest.mock('@/services/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      update: (values: unknown) => ({
        eq: (column: string, id: string) => {
          mockProfileUpdate(table, values, column, id);
          return { select: () => ({ single: () => mockProfileRow() }) };
        },
      }),
    }),
    auth: {
      getSession: async () => ({ data: { session: { user: { id: 'u1' } } }, error: null }),
      updateUser: jest.fn(),
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      resetPasswordForEmail: jest.fn(),
      signOut: jest.fn(),
    },
  },
}));

const auth = supabase.auth as unknown as Record<string, jest.Mock>;

beforeEach(() => {
  jest.clearAllMocks();
  mockProfileRow.mockResolvedValue({
    data: { id: 'u1', display_name: 'Matthew', venmo: null, cashapp: null, zelle: null },
    error: null,
  });
});

describe('auth api', () => {
  const session = { access_token: 't', user: { id: 'u1' } };

  it('signs up with a normalised email and saves the name to the profile', async () => {
    auth.signUp.mockResolvedValue({ data: { session }, error: null });
    await expect(signUpWithEmail(' Matthew ', ' New@Example.com ', 'longenough')).resolves.toEqual({
      error: null,
    });
    expect(auth.signUp).toHaveBeenCalledWith({
      email: 'new@example.com',
      password: 'longenough',
      options: { data: { name_prompt: 'saved' } },
    });
    expect(mockProfileUpdate).toHaveBeenCalledWith(
      'profiles',
      { display_name: 'Matthew', venmo: null, cashapp: null, zelle: null },
      'id',
      'u1',
    );
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it('lets the name sheet ask later when saving the name fails', async () => {
    auth.signUp.mockResolvedValue({ data: { session }, error: null });
    // No row came back: the name wasn't written.
    mockProfileRow.mockResolvedValue({ data: null, error: { message: 'no rows' } });
    await expect(signUpWithEmail('Matthew', 'new@example.com', 'longenough')).resolves.toEqual({
      error: null,
    });
    expect(auth.updateUser).toHaveBeenCalledWith({ data: { name_prompt: null } });
  });

  it('asks to confirm the email if sign-up returns no session', async () => {
    auth.signUp.mockResolvedValue({ data: { user: {}, session: null }, error: null });
    await expect(signUpWithEmail('Matthew', 'new@example.com', 'longenough')).resolves.toEqual({
      error: 'Check your email to confirm your account, then sign in.',
    });
  });

  it('turns a wrong password into plain words', async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: {},
      error: new AuthApiError('Invalid login credentials', 400, 'invalid_credentials'),
    });
    await expect(signInWithEmail('me@example.com', 'nope')).resolves.toEqual({
      error: "That password doesn't match this email.",
    });
  });

  it('never throws, even when the call itself rejects', async () => {
    auth.signInWithPassword.mockRejectedValue(new AuthRetryableFetchError('Failed to fetch', 0));
    await expect(signInWithEmail('me@example.com', 'secret')).resolves.toEqual({
      error: "You're offline. Check your connection and try again.",
    });
  });

  it('sends the reset email with the app deep link', async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    await expect(sendPasswordReset('Me@Example.com')).resolves.toEqual({ error: null });
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('me@example.com', {
      redirectTo: passwordResetRedirect(),
    });
    expect(passwordResetRedirect()).toBe('trip://auth/reset');
  });

  it('signs out locally', async () => {
    auth.signOut.mockResolvedValue({ error: null });
    await expect(signOut()).resolves.toEqual({ error: null });
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });
});
