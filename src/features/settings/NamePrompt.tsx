import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { create } from 'zustand';

import { useAuth } from '@/features/auth';
import { SheetField } from '@/features/budget/SheetField';
import { useScenarioActive } from '@/scenarios';
import { useMyProfile, useSaveMyProfile } from '@/services/data';
import { supabase } from '@/services/supabase';
import { spacing } from '@/theme';
import { Button, Sheet, Text } from '@/ui';

import {
  NAME_MAX_LENGTH,
  nameError,
  parseNamePromptState,
  shouldAskForName,
  withName,
  type NamePromptState,
} from './profileForm';
import { SAVE_FAILED } from './usePreferences';

const useNamePromptStore = create<{ fromGroup: boolean }>()(() => ({ fromGroup: false }));

/**
 * Call when a group feature opens (members sheet, invite): a traveller who dismissed the name
 * sheet sees it again there. Does nothing once they have a name.
 */
export function askForName(): void {
  useNamePromptStore.setState({ fromGroup: true });
}

/** Remembers on the account what the traveller did with the sheet. Best effort. */
async function remember(state: NamePromptState) {
  try {
    await supabase.auth.updateUser({ data: { name_prompt: state } });
  } catch {
    // Offline: the sheet stays away for this session and may ask once more next time.
  }
}

/**
 * "What should friends call you?" (TR-55): a one-time sheet for accounts whose name is still the
 * one made up from their email. Mounted once at the root; never shown in demo sessions.
 */
export function NamePrompt() {
  const auth = useAuth();
  const scenarioActive = useScenarioActive();
  if (auth.status !== 'signedIn' || scenarioActive) return null;
  const { user } = auth.session;
  return (
    <AskForName
      key={user.id}
      email={user.email}
      stored={parseNamePromptState(user.user_metadata?.name_prompt)}
    />
  );
}

function AskForName({ email, stored }: { email?: string; stored: NamePromptState | null }) {
  const profile = useMyProfile().data;
  const save = useSaveMyProfile();
  const fromGroup = useNamePromptStore((s) => s.fromGroup);
  // What happened in this session, ahead of the account's metadata catching up.
  const [handled, setHandled] = useState<NamePromptState | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const state = handled === 'saved' || stored === 'saved' ? 'saved' : (handled ?? stored);
  const open =
    !!profile && shouldAskForName(profile.displayName, email, state, fromGroup ? 'group' : 'open');

  // Mounted from the first time it opens, so it can animate away; never before (most accounts).
  const [mounted, setMounted] = useState(false);
  if (open && !mounted) setMounted(true);

  const finish = useCallback((result: NamePromptState) => {
    setHandled(result);
    useNamePromptStore.setState({ fromGroup: false });
    void remember(result);
  }, []);
  const dismiss = useCallback(() => finish('dismissed'), [finish]);

  const submit = async () => {
    const problem = nameError(name);
    setError(problem);
    if (problem || !profile || save.isPending) return;
    try {
      await save.mutateAsync(withName(profile, name));
      finish('saved');
    } catch {
      setError(SAVE_FAILED);
    }
  };

  if (!mounted && !open) return null;
  return (
    <Sheet open={open} onClose={dismiss} title="What should friends call you?" testID="name-prompt">
      <View style={styles.body}>
        <Text variant="body" tone="secondary">
          Friends on your trips see this name.
        </Text>
        <SheetField
          label="Your name"
          value={name}
          onChangeText={(value) => {
            setName(value);
            setError(null);
          }}
          error={error}
          maxLength={NAME_MAX_LENGTH}
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          returnKeyType="done"
          onSubmitEditing={() => void submit()}
          testID="name-prompt-input"
        />
        <Button
          label={save.isPending ? 'Saving…' : 'Save'}
          disabled={save.isPending}
          onPress={() => void submit()}
          testID="name-prompt-save"
        />
        <Button label="Not now" variant="secondary" onPress={dismiss} testID="name-prompt-skip" />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({ body: { gap: spacing.md } });
