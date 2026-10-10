import { useMutation } from '@tanstack/react-query';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Redirect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { scenariosEnabled } from '@/scenarios';
import { queryClient } from '@/services/data/hooks';
import { sendExpoPush } from '@/services/expoPush';
import { colors, screenPadding, spacing } from '@/theme';
import { Button, ListRow, Surface, Text } from '@/ui';

/** Time to lock the phone between tapping "Send test push" and the push being sent. */
export const PUSH_DELAY_MS = 5000;
const PUSH_TAG = 'trip-push-test';

type Token =
  | { status: 'idle' | 'loading' }
  | { status: 'ok'; token: string }
  | { status: 'error'; message: string };

const clock = (date: Date) =>
  date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' });

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Push spike (TR-52, ADR 0032): can Trip get an Expo push token in Expo Go on iOS and receive a
 * push sent through the Expo Push API with the app in the background? Every step shows its result
 * or its exact error, so the QA check on Matthew's iPhone answers the question.
 */
export default function PushTestScreen() {
  return scenariosEnabled() ? <PushTest /> : <Redirect href="/trips" />;
}

function PushTest() {
  const insets = useSafeAreaInsets();
  const [permission, setPermission] = useState<string>('checking');
  const [token, setToken] = useState<Token>({ status: 'idle' });
  const [arrived, setArrived] = useState<Date | null>(null);
  const opened = Notifications.useLastNotificationResponse();
  const openedTest = opened?.notification.request.content.data?.tag === PUSH_TAG;

  const fetchToken = useCallback(async () => {
    setToken({ status: 'loading' });
    try {
      const projectId = (Constants.expoConfig?.extra?.eas?.projectId ??
        Constants.easConfig?.projectId) as string | undefined;
      const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
      setToken({ status: 'ok', token: data });
    } catch (error) {
      setToken({ status: 'error', message: errorText(error) });
    }
  }, []);

  useEffect(() => {
    // Show the push as a banner while this screen is open too, so a push that arrives before
    // the phone is locked is still seen.
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    const sub = Notifications.addNotificationReceivedListener(() => setArrived(new Date()));
    Notifications.getPermissionsAsync()
      .then(({ status }) => {
        setPermission(status);
        if (status === 'granted') void fetchToken();
      })
      .catch((error: unknown) => setPermission(`error: ${errorText(error)}`));
    return () => {
      sub.remove();
      Notifications.setNotificationHandler(null);
    };
  }, [fetchToken]);

  const ask = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      setPermission(status);
      if (status === 'granted') await fetchToken();
    } catch (error) {
      setPermission(`error: ${errorText(error)}`);
    }
  };

  const send = useMutation(
    {
      mutationFn: async (to: string) => {
        await new Promise((resolve) => setTimeout(resolve, PUSH_DELAY_MS));
        const background = AppState.currentState !== 'active';
        const ticket = await sendExpoPush({
          to,
          title: 'Trip push test',
          body: 'This push came through Expo. Tap it to open Trip.',
          data: { tag: PUSH_TAG },
        });
        return { ticket, at: new Date(), background };
      },
    },
    queryClient,
  );

  const sendStatus = send.isPending
    ? 'Lock your phone now. The push is sent in 5 seconds.'
    : send.isError
      ? errorText(send.error)
      : send.data
        ? `Sent at ${clock(send.data.at)} with the app ${send.data.background ? 'in the background' : 'open'} (ticket ${send.data.ticket}).`
        : 'Tap, then lock your phone within 5 seconds. The push should appear on the lock screen.';

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
      contentInsetAdjustmentBehavior="automatic"
    >
      <Text variant="subhead" tone="secondary">
        Checks whether Trip can get phone push reminders in Expo Go.
      </Text>

      <Surface padding="none" style={styles.card}>
        <ListRow title="Permission" value={permission} separator testID="push-permission" />
        <ListRow
          title="Push token"
          subtitle={
            token.status === 'ok'
              ? token.token
              : token.status === 'error'
                ? token.message
                : token.status === 'loading'
                  ? 'Getting the token…'
                  : 'Allow notifications first.'
          }
          value={token.status === 'ok' ? 'Ready' : token.status === 'error' ? 'Failed' : undefined}
          valueTone={
            token.status === 'ok' ? 'ok' : token.status === 'error' ? 'accent' : 'secondary'
          }
          testID="push-token"
        />
      </Surface>

      {permission !== 'granted' ? (
        <Button label="Allow notifications" onPress={() => void ask()} testID="push-allow" />
      ) : null}
      {token.status === 'error' ? (
        <Button label="Try again" variant="secondary" onPress={() => void fetchToken()} />
      ) : null}
      {token.status === 'ok' ? (
        <Button
          label={send.isPending ? 'Sending in 5 seconds…' : 'Send test push'}
          icon="bell"
          disabled={send.isPending}
          onPress={() => send.mutate(token.token)}
          testID="push-send"
        />
      ) : null}
      <Text variant="caption" tone="secondary" testID="push-send-status" selectable>
        {sendStatus}
      </Text>

      <Surface padding="none" style={styles.card}>
        <ListRow
          title="Arrived with the app open"
          value={arrived ? clock(arrived) : 'Not yet'}
          valueTone={arrived ? 'ok' : 'secondary'}
          separator
          testID="push-arrived"
        />
        <ListRow
          title="Opened from the push"
          value={openedTest ? 'Yes' : 'Not yet'}
          valueTone={openedTest ? 'ok' : 'secondary'}
          testID="push-opened"
        />
      </Surface>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: screenPadding, gap: spacing.md, paddingTop: spacing.lg },
  card: { overflow: 'hidden' },
});
