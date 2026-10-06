import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import type { TextInput } from 'react-native';

import { Button, Text } from '@/ui';

import { signInWithEmail, signUpWithEmail } from './authApi';
import { AuthLayout } from './AuthLayout';
import { FormMessage } from './FormMessage';
import { TextField } from './TextField';
import { TextLink } from './TextLink';
import { emailError, MIN_PASSWORD_LENGTH, passwordError } from './validation';

type Mode = 'sign-up' | 'sign-in';

const copy = {
  'sign-up': {
    title: 'Create your account',
    subtitle: 'Your trips sync to every device you sign in on.',
    submit: 'Create account',
    busy: 'Creating account…',
    footerText: 'Already have an account?',
    footerLink: 'Sign in',
  },
  'sign-in': {
    title: 'Sign in',
    subtitle: 'Welcome back.',
    submit: 'Sign in',
    busy: 'Signing in…',
    footerText: 'New to Trip?',
    footerLink: 'Create an account',
  },
} as const;

/**
 * Sign up or sign in with email and password. On success the auth gate in app/_layout.tsx sees the
 * new session and moves the user to Trips; this screen only reports errors.
 */
export function EmailPasswordScreen({ mode }: { mode: Mode }) {
  const router = useRouter();
  const text = copy[mode];
  const passwordRef = useRef<TextInput>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string | null; password?: string | null }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    const next = { email: emailError(email), password: passwordError(password, mode) };
    setErrors(next);
    setFormError(null);
    if (next.email || next.password) return;

    setBusy(true);
    const { error } = await (mode === 'sign-up' ? signUpWithEmail : signInWithEmail)(
      email,
      password,
    );
    // On success the auth gate swaps this screen for Trips.
    setFormError(error);
    setBusy(false);
  }

  return (
    <AuthLayout
      title={text.title}
      subtitle={text.subtitle}
      footer={
        <>
          <Text tone="secondary">{text.footerText}</Text>
          <TextLink
            label={text.footerLink}
            testID="auth-switch"
            onPress={() => router.replace(mode === 'sign-up' ? '/auth/sign-in' : '/auth/sign-up')}
          />
        </>
      }
    >
      <TextField
        label="Email"
        value={email}
        onChangeText={(value) => {
          setEmail(value);
          setErrors((prev) => ({ ...prev, email: null }));
        }}
        error={errors.email}
        placeholder="name@example.com"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        keyboardType="email-address"
        textContentType={mode === 'sign-up' ? 'emailAddress' : 'username'}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => passwordRef.current?.focus()}
        editable={!busy}
        testID="auth-email"
      />
      <TextField
        ref={passwordRef}
        label="Password"
        value={password}
        onChangeText={(value) => {
          setPassword(value);
          setErrors((prev) => ({ ...prev, password: null }));
        }}
        error={errors.password}
        hint={mode === 'sign-up' ? `At least ${MIN_PASSWORD_LENGTH} characters.` : undefined}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
        textContentType={mode === 'sign-up' ? 'newPassword' : 'password'}
        returnKeyType="go"
        onSubmitEditing={submit}
        editable={!busy}
        testID="auth-password"
      />
      {mode === 'sign-in' ? (
        <TextLink
          label="Forgot password?"
          testID="auth-forgot"
          onPress={() => router.push('/auth/forgot-password')}
        />
      ) : null}
      {formError ? <FormMessage message={formError} testID="auth-form-error" /> : null}
      <Button
        label={busy ? text.busy : text.submit}
        onPress={submit}
        disabled={busy}
        testID="auth-submit"
      />
    </AuthLayout>
  );
}
