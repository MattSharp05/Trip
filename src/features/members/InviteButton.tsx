import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { inviteLink, inviteMessage } from '@/core/inviteLink';
import { useInviteToken } from '@/services/data';
import { spacing } from '@/theme';
import { Button, Text, type ConfirmRequest } from '@/ui';

export interface InviteButtonProps {
  tripId: string;
  city: string;
  /** Asks in the sheet (`SheetConfirm`): a native Alert would open behind it on iOS (TR-56). */
  confirm: (request: ConfirmRequest) => void;
  /** Opens the share sheet with the message, once the sheet is gone: it would open behind it too. */
  share: (message: string) => void;
  testID?: string;
}

/**
 * The members sheet's top action (TR-57, ADR 0029): **Invite friends** opens the iOS share sheet
 * with "Join my Las Vegas trip on Trip: <link>"; the small **Reset link** under it (confirmed)
 * makes a new link, and the old one stops working.
 */
export function InviteButton({
  tripId,
  city,
  confirm,
  share,
  testID = 'invite',
}: InviteButtonProps) {
  const { mutateAsync: getToken, isPending } = useInviteToken();
  const [note, setNote] = useState<string | null>(null);

  const invite = async () => {
    setNote(null);
    let message: string;
    try {
      message = inviteMessage(city, inviteLink(await getToken({ tripId })));
    } catch {
      setNote("Couldn't make the invite link. Check your connection and try again.");
      return;
    }
    share(message);
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
    confirm({
      title: 'Reset the invite link?',
      message: 'The old link stops working. Friends already on the trip stay on it.',
      confirmLabel: 'Reset',
      onConfirm: () => void reset(),
      testID: `${testID}-reset-confirm`,
    });

  return (
    <View style={styles.box} testID={testID}>
      <Button
        label="Invite friends"
        icon="person.badge.plus"
        onPress={() => void invite()}
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
