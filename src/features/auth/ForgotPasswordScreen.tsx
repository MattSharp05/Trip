import { useRouter } from 'expo-router';
import { useState } from 'react';

import { Button } from '@/ui';

import { sendPasswordReset } from './authApi';
import { AuthLayout } from './AuthLayout';
import { FormMessage } from './FormMessage';
import { TextField } from './TextField';
import { emailError, normalizeEmail } from './validation';

/**
 * Sends Supabase's reset email and confirms it. Setting the new password in the app is a follow-up
 * ticket; for now the link in the email is the whole flow.
 */
export function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function submit() {
    if (busy) return;
    const invalid = emailError(email);
    setFieldError(invalid);
    setFormError(null);
    if (invalid) return;

    setBusy(true);
    const { error } = await sendPasswordReset(email);
    setBusy(false);
    if (error) setFormError(error);
    else setSentTo(normalizeEmail(email));
  }

  if (sentTo) {
    return (
      <AuthLayout
        title="Check your email"
        subtitle={`If there is an account for ${sentTo}, we sent it a link to reset the password.`}
      >
        <Button label="Back to sign in" onPress={() => router.back()} testID="auth-reset-done" />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Reset password"
      subtitle="Enter the email you signed up with and we'll send you a reset link."
    >
      <TextField
        label="Email"
        value={email}
        onChangeText={(value) => {
          setEmail(value);
          setFieldError(null);
        }}
        error={fieldError}
        placeholder="name@example.com"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="send"
        onSubmitEditing={submit}
        editable={!busy}
        autoFocus
        testID="auth-email"
      />
      {formError ? <FormMessage message={formError} testID="auth-form-error" /> : null}
      <Button
        label={busy ? 'Sending…' : 'Send reset link'}
        onPress={submit}
        disabled={busy}
        testID="auth-submit"
      />
    </AuthLayout>
  );
}
