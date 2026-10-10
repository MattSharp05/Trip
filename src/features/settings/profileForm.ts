import { FALLBACK_NAME } from '@/core/members';
import { emailError, normalizeEmail } from '@/features/auth/validation';
import type { Profile, ProfileInput } from '@/services/data';

export { NAME_MAX_LENGTH, nameError } from '@/features/auth/validation';

/**
 * True while a name is still the one the database made up at sign-up (TR-50): the email's local
 * part, or the fallback when that was empty.
 */
export function isPlaceholderName(name: string, email: string | null | undefined): boolean {
  const value = name.trim();
  if (!value || value === FALLBACK_NAME) return true;
  const local = (email ?? '').split('@')[0].trim();
  return local !== '' && value === local;
}

/**
 * The one-time "What should friends call you?" sheet. What the traveller did with it is kept in
 * their auth `user_metadata.name_prompt`, next to their preferences.
 */
export type NamePromptState = 'saved' | 'dismissed';

export const parseNamePromptState = (value: unknown): NamePromptState | null =>
  value === 'saved' || value === 'dismissed' ? value : null;

/**
 * Whether to show the name sheet. On opening the app: only to a placeholder name that hasn't seen
 * it. On opening a group feature (members sheet, invite): again after a dismissal, never after a
 * save.
 */
export function shouldAskForName(
  name: string,
  email: string | null | undefined,
  state: NamePromptState | null,
  reason: 'open' | 'group',
): boolean {
  if (state === 'saved' || !isPlaceholderName(name, email)) return false;
  return reason === 'group' || state === null;
}

/** What the Payment info fields hold, as typed. */
export interface PaymentFields {
  venmo: string;
  cashapp: string;
  zelle: string;
}

export type PaymentErrors = Partial<Record<keyof PaymentFields, string>>;

/** What gets saved: each handle cleaned up, or null when the field is empty. */
export interface PaymentValues {
  venmo: string | null;
  cashapp: string | null;
  zelle: string | null;
}

const VENMO = /^[A-Za-z0-9_-]{1,30}$/;
const CASHTAG = /^(?=.*[A-Za-z])[A-Za-z0-9_-]{1,20}$/;

/** A US number: 10 digits, optionally after +1 or 1, with the usual punctuation. */
function usPhone(value: string): string | null {
  if (!/^\+?[\d\s().-]+$/.test(value)) return null;
  let digits = value.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  if (!/^[2-9]\d{9}$/.test(digits)) return null;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/** A field's cleaned value or its error. Empty is fine: every handle is optional. */
function parseField(
  key: keyof PaymentFields,
  raw: string,
): { value: string | null; error?: string } {
  const value = raw.trim();
  if (!value) return { value: null };
  switch (key) {
    case 'venmo': {
      const username = value.replace(/^@/, '');
      return VENMO.test(username)
        ? { value: username }
        : { value: null, error: 'Use letters, numbers, - and _ only.' };
    }
    case 'cashapp': {
      const cashtag = value.replace(/^\$/, '');
      return CASHTAG.test(cashtag)
        ? { value: cashtag }
        : { value: null, error: 'Use up to 20 letters or numbers, with at least one letter.' };
    }
    case 'zelle': {
      if (value.includes('@')) {
        return emailError(value) === null
          ? { value: normalizeEmail(value) }
          : { value: null, error: 'Enter an email like name@example.com.' };
      }
      const phone = usPhone(value);
      return phone
        ? { value: phone }
        : { value: null, error: 'Enter an email or a US phone number.' };
    }
  }
}

/** Checks and cleans the Payment info fields: the values to save, or the errors to show. */
export function parsePaymentFields(
  fields: PaymentFields,
): { ok: true; values: PaymentValues } | { ok: false; errors: PaymentErrors } {
  const venmo = parseField('venmo', fields.venmo);
  const cashapp = parseField('cashapp', fields.cashapp);
  const zelle = parseField('zelle', fields.zelle);
  const errors: PaymentErrors = {
    ...(venmo.error ? { venmo: venmo.error } : {}),
    ...(cashapp.error ? { cashapp: cashapp.error } : {}),
    ...(zelle.error ? { zelle: zelle.error } : {}),
  };
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, values: { venmo: venmo.value, cashapp: cashapp.value, zelle: zelle.value } };
}

/** The fields as the screen first shows them. A stored cashtag is shown without its $. */
export const paymentFieldsOf = (profile: Profile): PaymentFields => ({
  venmo: profile.venmo ?? '',
  cashapp: (profile.cashapp ?? '').replace(/^\$/, ''),
  zelle: profile.zelle ?? '',
});

/** "Venmo, Zelle", or "Not set": the Payment info row's value in Settings. */
export function paymentSummary(profile: Profile): string {
  const set = [
    profile.venmo ? 'Venmo' : null,
    profile.cashapp ? 'Cash App' : null,
    profile.zelle ? 'Zelle' : null,
  ].filter((s): s is string => s !== null);
  return set.length > 0 ? set.join(', ') : 'Not set';
}

/** The profile to save with new handles (a null handle is saved as not set). */
export function withPayment(profile: Profile, values: PaymentValues): ProfileInput {
  return {
    displayName: profile.displayName,
    ...(values.venmo ? { venmo: values.venmo } : {}),
    ...(values.cashapp ? { cashapp: values.cashapp } : {}),
    ...(values.zelle ? { zelle: values.zelle } : {}),
  };
}

/** The profile to save with a new name, keeping the handles. */
export function withName(profile: Profile, name: string): ProfileInput {
  const { id: _id, ...rest } = profile;
  return { ...rest, displayName: name.trim() };
}
