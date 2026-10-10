export const MIN_PASSWORD_LENGTH = 8;

// Deliberately loose: one @, something before it, a dot in the domain, no spaces. Supabase does the
// real check and its error is shown if this lets something odd through.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Trims and lower-cases what the user typed, so " Me@Mail.com " signs in to the same account. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** The inline error for the email field, or null when it looks fine. */
export function emailError(email: string): string | null {
  const value = normalizeEmail(email);
  if (!value) return 'Enter your email.';
  if (!EMAIL.test(value)) return 'Enter an email like name@example.com.';
  return null;
}

/**
 * The inline error for the password field, or null when it looks fine. Sign-up enforces the length
 * rule; sign-in only needs something typed (older or Google-linked accounts may differ).
 */
export function passwordError(password: string, mode: 'sign-up' | 'sign-in'): string | null {
  if (!password) return 'Enter your password.';
  if (mode === 'sign-up' && password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
}

/** Names show on avatars and in lists, so they stay short (TR-55). */
export const NAME_MAX_LENGTH = 30;

/** The inline error for a traveller's name, or null when it's fine. */
export function nameError(name: string): string | null {
  const value = name.trim();
  if (!value) return 'Enter your name.';
  if (Array.from(value).length > NAME_MAX_LENGTH) {
    return `Use ${NAME_MAX_LENGTH} characters or fewer.`;
  }
  return null;
}
