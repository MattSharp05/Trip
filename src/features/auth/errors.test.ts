import {
  AuthApiError,
  AuthRetryableFetchError,
  AuthWeakPasswordError,
} from '@supabase/supabase-js';

import { authErrorMessage, authMessages } from './errors';

const api = (code: string, status = 400) => new AuthApiError('server message', status, code);

describe('authErrorMessage', () => {
  it('names a wrong password on sign-in', () => {
    expect(authErrorMessage(api('invalid_credentials'), 'sign-in')).toBe(
      "That password doesn't match this email.",
    );
  });

  it('says the email is taken on sign-up', () => {
    expect(authErrorMessage(api('user_already_exists', 422), 'sign-up')).toBe(
      authMessages.emailInUse,
    );
    expect(authErrorMessage(api('email_exists', 422), 'sign-up')).toBe(authMessages.emailInUse);
  });

  it('shows a retry message when offline', () => {
    const offline = new AuthRetryableFetchError('Failed to fetch', 0);
    expect(authErrorMessage(offline, 'sign-in')).toBe(
      "You're offline. Check your connection and try again.",
    );
    expect(authErrorMessage(new TypeError('Network request failed'), 'reset')).toBe(
      authMessages.offline,
    );
  });

  it('covers weak passwords, bad emails and rate limits', () => {
    expect(authErrorMessage(new AuthWeakPasswordError('weak', 422, ['length']), 'sign-up')).toBe(
      authMessages.weakPassword,
    );
    expect(authErrorMessage(api('email_address_invalid'), 'sign-up')).toBe(
      authMessages.invalidEmail,
    );
    expect(authErrorMessage(api('over_email_send_rate_limit', 429), 'reset')).toBe(
      authMessages.tooManyEmails,
    );
    expect(authErrorMessage(api('over_request_rate_limit', 429), 'sign-in')).toBe(
      authMessages.tooManyTries,
    );
    expect(authErrorMessage(api('something_new', 429), 'sign-in')).toBe(authMessages.tooManyTries);
  });

  it('falls back to a generic message, never the raw server text', () => {
    expect(authErrorMessage(api('unexpected_failure', 500), 'sign-in')).toBe(authMessages.generic);
    expect(authErrorMessage(new Error('boom'), 'sign-up')).toBe(authMessages.generic);
    expect(authErrorMessage('weird', 'sign-up')).toBe(authMessages.generic);
  });
});
