import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { TemperatureUnit } from '@/core/weather';
import { signOut, useAuth } from '@/features/auth';
import { scenariosEnabled } from '@/scenarios';
import { queryClient } from '@/services/data/hooks';
import { useScenarioStore } from '@/stores/scenario';
import { useTripStore } from '@/stores/trip';
import { spacing } from '@/theme';
import { Button, ListRow, Segmented, Sheet, Text, Toast } from '@/ui';

import type { DistanceUnit } from './preferences';
import { ActionRow, SettingRow, SettingsGroup, SettingsScroll } from './SettingsList';
import { clearPreferenceCache, usePreferences } from './usePreferences';

const TEMPERATURE: readonly { value: TemperatureUnit; label: string }[] = [
  { value: 'fahrenheit', label: '°F' },
  { value: 'celsius', label: '°C' },
];

const DISTANCE: readonly { value: DistanceUnit; label: string }[] = [
  { value: 'miles', label: 'Miles' },
  { value: 'km', label: 'Km' },
];

/** Signs out and drops everything cached for the account; the auth gate then shows Welcome. */
async function signOutAndForget(): Promise<string | null> {
  const { error } = await signOut();
  if (error) return error;
  queryClient.clear();
  useTripStore.getState().selectTrip(null);
  clearPreferenceCache();
  return null;
}

/** Settings (TR-11): account, units, home currency, Terms, Privacy, Developer, version. */
export function SettingsScreen() {
  const router = useRouter();
  const auth = useAuth();
  const scenario = useScenarioStore((s) => s.active);
  const { preferences, setPreference } = usePreferences();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const hideMessage = useCallback(() => setMessage(null), []);
  const closeConfirm = useCallback(() => setConfirmOpen(false), []);

  const save = async <K extends keyof typeof preferences>(
    key: K,
    value: (typeof preferences)[K],
  ) => {
    const { error } = await setPreference(key, value);
    if (error) setMessage(error);
  };

  const confirmSignOut = async () => {
    setSigningOut(true);
    const error = await signOutAndForget();
    setSigningOut(false);
    setConfirmOpen(false);
    if (error) setMessage(error);
  };

  const email = auth.status === 'signedIn' ? (auth.session.user.email ?? 'Signed in') : null;
  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <View style={styles.screen}>
      <SettingsScroll testID="settings">
        <SettingsGroup title="Account">
          {scenario ? (
            <ListRow
              icon="person.crop.circle"
              title="Demo data"
              subtitle={`Scenario ${scenario}. Nothing is saved.`}
              testID="settings-demo"
            />
          ) : (
            <>
              <ListRow icon="person.crop.circle" title={email ?? 'Not signed in'} separator />
              <ActionRow
                title="Sign out"
                onPress={() => setConfirmOpen(true)}
                testID="settings-sign-out"
              />
            </>
          )}
        </SettingsGroup>

        <SettingsGroup title="Units">
          <SettingRow title="Temperature" separator>
            <Segmented
              segments={TEMPERATURE}
              value={preferences.temperatureUnit}
              onChange={(v) => void save('temperatureUnit', v)}
              testID="settings-temperature"
            />
          </SettingRow>
          <SettingRow title="Distance">
            <Segmented
              segments={DISTANCE}
              value={preferences.distanceUnit}
              onChange={(v) => void save('distanceUnit', v)}
              testID="settings-distance"
            />
          </SettingRow>
        </SettingsGroup>

        <SettingsGroup title="Budget" footer="Trip budgets add up in this currency.">
          <ListRow
            title="Home currency"
            value={preferences.homeCurrency}
            onPress={() => router.push('/settings/currency')}
            testID="settings-currency"
          />
        </SettingsGroup>

        <SettingsGroup title="About">
          <ListRow title="Terms of Use" onPress={() => router.push('/settings/terms')} separator />
          <ListRow
            title="Privacy"
            onPress={() => router.push('/settings/privacy')}
            separator={scenariosEnabled()}
          />
          {scenariosEnabled() ? (
            <ListRow title="Developer" onPress={() => router.push('/dev')} testID="settings-dev" />
          ) : null}
        </SettingsGroup>

        <Text variant="caption" tone="secondary" style={styles.version}>
          {`Trip ${version}`}
        </Text>
      </SettingsScroll>

      <Sheet open={confirmOpen} onClose={closeConfirm} title="Sign out?" testID="sign-out-sheet">
        <View style={styles.sheet}>
          <Text variant="body" tone="secondary">
            Your trips stay in your account. Sign in again to see them.
          </Text>
          <Button
            label={signingOut ? 'Signing out…' : 'Sign out'}
            disabled={signingOut}
            onPress={() => void confirmSignOut()}
            testID="sign-out-confirm"
          />
          <Button label="Cancel" variant="secondary" onPress={closeConfirm} />
        </View>
      </Sheet>

      <Toast visible={message !== null} message={message ?? ''} onDismiss={hideMessage} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  version: { textAlign: 'center' },
  sheet: { gap: spacing.md },
});
