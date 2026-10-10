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
import { Button, ListRow, Surface, Text, type ListRowProps } from '@/ui';

const PUSH_TAG = 'trip-push-test';

type Token =
  | { status: 'idle' | 'loading' }
  | { status: 'ok'; token: string }
  | { status: 'error'; message: string };

type Send = { to: string; background: boolean };

const clock = (date: Date) =>
  date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' });

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

function tokenRow(token: Token): Pick<ListRowProps, 'subtitle' | 'value' | 'valueTone'> {
  switch (token.status) {
    case 'ok':
      return { subtitle: token.token, value: 'Ready', valueTone: 'ok' };
    case 'error':
      return { subtitle: token.message, value: 'Failed', valueTone: 'accent' };
    case 'loading':
      return { subtitle: 'Getting the token…' };
    case 'idle':
      return { subtitle: 'Allow notifications first.' };
  }
}

/**
 * Push spike (TR-52, ADR 0032): can Trip get an Expo push token in Expo Go on iOS and receive a
 * push sent through the Expo Push API with the app in the background? Every step shows its result
 * or its exact error, so the QA check on Matthew's iPhone answers the question.
 *
 * "Send when I lock" waits for Trip to leave the foreground and sends the push at that moment:
 * iOS suspends a backgrounded app's JavaScript within seconds, so a timer started before locking
 * could fire only after unlocking. The request itself finishes in the app's short grace period.
 */
export default function PushTestScreen() {
  return scenariosEnabled() ? <PushTest /> : <Redirect href="/trips" />;
}

function PushTest() {
  const insets = useSafeAreaInsets();
  const [permission, setPermission] = useState<string>('checking');
  const [token, setToken] = useState<Token>({ status: 'idle' });
  const [armed, setArmed] = useState(false);
  const [arrived, setArrived] = useState<Date | null>(null);
  const opened = Notifications.useLastNotificationResponse();

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
    // Show the push as a banner while this screen is open too, so "Send now" is seen.
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
      mutationFn: async ({ to, background }: Send) => {
        const run = String(Date.now());
        const ticket = await sendExpoPush({
          to,
          title: 'Trip push test',
          body: 'This push came through Expo. Tap it to open Trip.',
          data: { tag: PUSH_TAG, run },
        });
        return { ticket, run, at: new Date(), background };
      },
    },
    queryClient,
  );
  const { mutate } = send;

  useEffect(() => {
    if (!armed || token.status !== 'ok') return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') return;
      setArmed(false);
      mutate({ to: token.token, background: true });
    });
    return () => sub.remove();
  }, [armed, token, mutate]);

  const openedRun = opened?.notification.request.content.data;
  const openedTest =
    openedRun?.tag === PUSH_TAG && send.data !== undefined && openedRun.run === send.data.run;

  const sendStatus = armed
    ? 'Now lock your phone. The push is sent as Trip goes to the background.'
    : send.isPending
      ? 'Sending…'
      : send.isError
        ? errorText(send.error)
        : send.data
          ? `Sent at ${clock(send.data.at)} with the app ${send.data.background ? 'in the background' : 'open'} (ticket ${send.data.ticket}).`
          : 'Tap "Send when I lock", then lock your phone. The push should appear on the lock screen.';

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
        <ListRow title="Push token" {...tokenRow(token)} testID="push-token" />
      </Surface>

      {permission === 'undetermined' ? (
        <Button label="Allow notifications" onPress={() => void ask()} testID="push-allow" />
      ) : null}
      {permission === 'denied' ? (
        <Text variant="caption" tone="secondary" testID="push-denied">
          Notifications are off for Expo Go. Turn them on in the iPhone Settings app → Expo Go →
          Notifications, then come back.
        </Text>
      ) : null}
      {token.status === 'error' ? (
        <Button label="Try again" variant="secondary" onPress={() => void fetchToken()} />
      ) : null}
      {token.status === 'ok' ? (
        <>
          <Button
            label={armed ? 'Waiting for you to lock…' : 'Send when I lock'}
            icon="lock"
            disabled={armed || send.isPending}
            onPress={() => setArmed(true)}
            testID="push-arm"
          />
          <Button
            label="Send now"
            variant="secondary"
            disabled={armed || send.isPending}
            onPress={() => mutate({ to: token.token, background: false })}
            testID="push-send-now"
          />
        </>
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
