import { isAuthError, isAuthRetryableFetchError } from '@supabase/supabase-js';

import { MIN_PASSWORD_LENGTH } from './validation';

export type AuthAction = 'sign-up' | 'sign-in' | 'reset';

export const authMessages = {
  wrongPassword: "That password doesn't match this email.",
  emailInUse: 'There is already an account with this email. Sign in instead.',
  offline: "You're offline. Check your connection and try again.",
  weakPassword: `Choose a stronger password with at least ${MIN_PASSWORD_LENGTH} characters.`,
  invalidEmail: 'Enter an email like name@example.com.',
  tooManyTries: 'Too many tries. Wait a minute and try again.',
  tooManyEmails: 'Too many emails sent. Try again in an hour.',
  confirmEmail: 'Check your email to confirm your account, then sign in.',
  generic: 'Something went wrong. Try again.',
} as const;

function isNetworkFailure(error: unknown): boolean {
  if (isAuthRetryableFetchError(error)) return true;
  // fetch itself rejects with a TypeError ("Network request failed") when there is no connection.
  return error instanceof TypeError && /network/i.test(error.message);
}

/** Plain-words copy for an error from Supabase Auth (or the network) during `action`. */
export function authErrorMessage(error: unknown, action: AuthAction): string {
  if (isNetworkFailure(error)) return authMessages.offline;
  if (!isAuthError(error)) return authMessages.generic;

  switch (error.code) {
    case 'invalid_credentials':
      return action === 'sign-in' ? authMessages.wrongPassword : authMessages.generic;
    case 'user_already_exists':
    case 'email_exists':
      return authMessages.emailInUse;
    case 'weak_password':
      return authMessages.weakPassword;
    case 'email_address_invalid':
      return authMessages.invalidEmail;
    case 'over_email_send_rate_limit':
      return authMessages.tooManyEmails;
    case 'over_request_rate_limit':
      return authMessages.tooManyTries;
  }
  if (error.status === 429) return authMessages.tooManyTries;
  return authMessages.generic;
}
