import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { rememberInvite, useAuth } from '@/features/auth';
import { InvitePreview } from '@/features/members';
import { useScenarioActive } from '@/scenarios';

/**
 * An invite link (TR-57, ADR 0029): `exp://u.expo.dev/<project>/--/invite/<token>?…` in Expo Go, or
 * `trip://invite/<token>`. Outside the auth gate, so it works signed out too: the token is kept,
 * Welcome takes over, and once signed in the root layout brings the traveller back here. Works for
 * real accounts (not only scenarios); the `group-invite` scenario opens it in a demo session.
 */
export default function InviteRoute() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { status } = useAuth();
  const scenarioActive = useScenarioActive();
  const signedOut = status !== 'signedIn' && !scenarioActive;

  useEffect(() => {
    if (signedOut && token) rememberInvite(token);
  }, [signedOut, token]);

  if (signedOut) return <Redirect href="/auth" />;
  return <InvitePreview token={token ?? ''} />;
}
