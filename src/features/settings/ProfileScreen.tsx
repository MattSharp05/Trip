import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { type Profile, useSaveMyProfile } from '@/services/data';
import { Button, Toast } from '@/ui';

import { WithMyProfile } from './WithMyProfile';
import { nameError, withName } from './profileForm';
import { SAVE_FAILED } from './usePreferences';
import { FieldRow, SettingsGroup, SettingsScroll } from './SettingsList';

/** Settings → Name: what friends on your trips see on your avatar and next to what you add. */
export function ProfileScreen() {
  return (
    <WithMyProfile rows={1} testID="profile-name">
      {(profile) => <NameForm key={profile.id} profile={profile} />}
    </WithMyProfile>
  );
}

function NameForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const save = useSaveMyProfile();
  const [name, setName] = useState(profile.displayName);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const hideMessage = useCallback(() => setMessage(null), []);

  const submit = async () => {
    const problem = nameError(name);
    setError(problem);
    if (problem || save.isPending) return;
    try {
      await save.mutateAsync(withName(profile, name));
      router.back();
    } catch {
      setMessage(SAVE_FAILED);
    }
  };

  return (
    <View style={styles.screen}>
      <SettingsScroll testID="profile-name">
        <SettingsGroup footer="Friends on your trips see this name.">
          <FieldRow
            label="Name"
            value={name}
            onChangeText={(value) => {
              setName(value);
              setError(null);
            }}
            error={error}
            placeholder="Your name"
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            returnKeyType="done"
            onSubmitEditing={() => void submit()}
            testID="profile-name-input"
          />
        </SettingsGroup>
        <Button
          label={save.isPending ? 'Saving…' : 'Save'}
          disabled={save.isPending}
          onPress={() => void submit()}
          testID="profile-name-save"
        />
      </SettingsScroll>
      <Toast
        visible={message !== null}
        message={message ?? ''}
        onDismiss={hideMessage}
        placement="screen"
      />
    </View>
  );
}

const styles = StyleSheet.create({ screen: { flex: 1 } });
