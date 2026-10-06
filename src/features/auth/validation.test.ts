import { emailError, MIN_PASSWORD_LENGTH, normalizeEmail, passwordError } from './validation';

describe('normalizeEmail', () => {
  it('trims and lower-cases', () => {
    expect(normalizeEmail('  Me@Mail.COM ')).toBe('me@mail.com');
  });
});

describe('emailError', () => {
  it('accepts ordinary addresses, with stray spaces', () => {
    expect(emailError('matt@example.com')).toBeNull();
    expect(emailError(' first.last+trip@sub.example.co.uk ')).toBeNull();
  });

  it('asks for an email when empty', () => {
    expect(emailError('')).toBe('Enter your email.');
    expect(emailError('   ')).toBe('Enter your email.');
  });

  it('rejects things that are not emails', () => {
    for (const bad of ['matt', 'matt@', '@example.com', 'matt@example', 'ma tt@example.com']) {
      expect(emailError(bad)).toBe('Enter an email like name@example.com.');
    }
  });
});

describe('passwordError', () => {
  it('asks for a password when empty', () => {
    expect(passwordError('', 'sign-up')).toBe('Enter your password.');
    expect(passwordError('', 'sign-in')).toBe('Enter your password.');
  });

  it('needs at least 8 characters to sign up', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8);
    expect(passwordError('1234567', 'sign-up')).toBe('Use at least 8 characters.');
    expect(passwordError('12345678', 'sign-up')).toBeNull();
  });

  it('does not apply the length rule to sign-in', () => {
    expect(passwordError('short', 'sign-in')).toBeNull();
  });
});
