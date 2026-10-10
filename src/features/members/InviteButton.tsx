import { useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, View } from 'react-native';

import { inviteLink, inviteMessage } from '@/core/inviteLink';
import { useInviteToken } from '@/services/data';
import { spacing } from '@/theme';
import { Button, Text } from '@/ui';

export interface InviteButtonProps {
  tripId: string;
  city: string;
  testID?: string;
}

/**
 * The members sheet's top action (TR-57, ADR 0029): **Invite friends** opens the iOS share sheet
 * with "Join my Las Vegas trip on Trip: <link>"; the small **Reset link** under it (confirmed)
 * makes a new link, and the old one stops working.
 */
export function InviteButton({ tripId, city, testID = 'invite' }: InviteButtonProps) {
  const { mutateAsync: getToken, isPending } = useInviteToken();
  const [note, setNote] = useState<string | null>(null);

  const share = async () => {
    setNote(null);
    let token: string;
    try {
      token = await getToken({ tripId });
    } catch {
      setNote("Couldn't make the invite link. Check your connection and try again.");
      return;
    }
    // Closing the share sheet without sending is fine; nothing to report.
    await Share.share({ message: inviteMessage(city, inviteLink(token)) }).catch(() => {});
  };

  const reset = async () => {
    setNote(null);
    try {
      await getToken({ tripId, reset: true });
      setNote('Link reset. The old link no longer works.');
    } catch {
      setNote("Couldn't reset the link. Check your connection and try again.");
    }
  };

  const confirmReset = () =>
    Alert.alert(
      'Reset the invite link?',
      'The old link stops working. Friends already on the trip stay on it.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: () => void reset() },
      ],
    );

  return (
    <View style={styles.box} testID={testID}>
      <Button
        label="Invite friends"
        icon="person.badge.plus"
        onPress={() => void share()}
        disabled={isPending}
        testID={`${testID}-share`}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityHint="Makes a new invite link; the old one stops working"
        onPress={confirmReset}
        disabled={isPending}
        hitSlop={spacing.sm}
        style={({ pressed }) => [styles.reset, pressed && styles.pressed]}
        testID={`${testID}-reset`}
      >
        <Text variant="subhead" tone="secondary">
          Reset link
        </Text>
      </Pressable>
      {note ? (
        <Text variant="subhead" tone="secondary" style={styles.note} testID={`${testID}-note`}>
          {note}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.sm },
  reset: { alignSelf: 'center', paddingVertical: spacing.xs },
  note: { textAlign: 'center' },
  pressed: { opacity: 0.6 },
});
