import {
  isPlaceholderName,
  nameError,
  parsePaymentFields,
  paymentFieldsOf,
  paymentSummary,
  shouldAskForName,
  withName,
  withPayment,
} from './profileForm';

const empty = { venmo: '', cashapp: '', zelle: '' };

describe('nameError', () => {
  it('needs a name of at most 30 characters', () => {
    expect(nameError('  ')).toBe('Enter your name.');
    expect(nameError(' Matthew ')).toBeNull();
    expect(nameError('a'.repeat(30))).toBeNull();
    expect(nameError('a'.repeat(31))).toBe('Use 30 characters or fewer.');
  });
});

describe('isPlaceholderName', () => {
  it('spots the name the database made up from the email', () => {
    expect(isPlaceholderName('matthew.sharp', 'matthew.sharp@example.com')).toBe(true);
    expect(isPlaceholderName('Traveller', 'a@example.com')).toBe(true);
    expect(isPlaceholderName('', 'a@example.com')).toBe(true);
    expect(isPlaceholderName('Matthew', 'matthew.sharp@example.com')).toBe(false);
    expect(isPlaceholderName('Matthew', null)).toBe(false);
  });
});

describe('shouldAskForName', () => {
  const email = 'blake@example.com';

  it('asks a placeholder name once when the app opens', () => {
    expect(shouldAskForName('blake', email, null, 'open')).toBe(true);
    expect(shouldAskForName('blake', email, 'dismissed', 'open')).toBe(false);
    expect(shouldAskForName('Blake', email, null, 'open')).toBe(false);
  });

  it('asks again from a group feature after a dismissal, never after a save', () => {
    expect(shouldAskForName('blake', email, 'dismissed', 'group')).toBe(true);
    expect(shouldAskForName('blake', email, 'saved', 'group')).toBe(false);
    expect(shouldAskForName('blake', email, 'saved', 'open')).toBe(false);
  });
});

describe('parsePaymentFields', () => {
  it('saves empty fields as null', () => {
    expect(parsePaymentFields({ venmo: ' ', cashapp: '', zelle: '' })).toEqual({
      ok: true,
      values: { venmo: null, cashapp: null, zelle: null },
    });
  });

  it('cleans up each handle', () => {
    expect(
      parsePaymentFields({ venmo: '@Matt-Sharp_5', cashapp: ' $mattsharp ', zelle: 'Me@Mail.com' }),
    ).toEqual({
      ok: true,
      values: { venmo: 'Matt-Sharp_5', cashapp: 'mattsharp', zelle: 'me@mail.com' },
    });
  });

  it('accepts a US phone for Zelle in common formats', () => {
    for (const phone of ['212 555 0142', '(212) 555-0142', '+1 212.555.0142', '12125550142']) {
      expect(parsePaymentFields({ ...empty, zelle: phone })).toEqual({
        ok: true,
        values: { venmo: null, cashapp: null, zelle: '(212) 555-0142' },
      });
    }
  });

  it('reports every field that is off', () => {
    expect(
      parsePaymentFields({ venmo: 'matt sharp', cashapp: '$12345', zelle: '555-0142' }),
    ).toEqual({
      ok: false,
      errors: {
        venmo: 'Use letters, numbers, - and _ only.',
        cashapp: 'Use up to 20 letters or numbers, with at least one letter.',
        zelle: 'Enter an email or a US phone number.',
      },
    });
    expect(parsePaymentFields({ ...empty, zelle: 'me@mail' })).toEqual({
      ok: false,
      errors: { zelle: 'Enter an email like name@example.com.' },
    });
  });
});

describe('profile helpers', () => {
  const profile = { id: 'me', displayName: 'Matthew', cashapp: '$matt', zelle: 'm@x.com' };

  it('shows the fields and the summary', () => {
    expect(paymentFieldsOf(profile)).toEqual({ venmo: '', cashapp: 'matt', zelle: 'm@x.com' });
    expect(paymentSummary(profile)).toBe('Cash App, Zelle');
    expect(paymentSummary({ id: 'me', displayName: 'Matthew' })).toBe('Not set');
  });

  it('builds what to save', () => {
    expect(withName(profile, ' Matt ')).toEqual({
      displayName: 'Matt',
      cashapp: '$matt',
      zelle: 'm@x.com',
    });
    expect(withPayment(profile, { venmo: 'matt', cashapp: null, zelle: null })).toEqual({
      displayName: 'Matthew',
      venmo: 'matt',
    });
  });
});
