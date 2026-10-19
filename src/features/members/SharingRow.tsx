import type { SFSymbol } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';
import { Button, ListRow, Surface } from '@/ui';

export interface SharingRowProps {
  /** Whether the trip's members see it. */
  shared: boolean;
  /** What "shared" means here: "Shared with the group" (a booking), "Shared with this trip". */
  sharedTitle: string;
  /** The owner's name when it's someone else's ("Added by Blake"); null when it's yours. */
  addedBy: string | null;
  /** The owner's flip: "Make private", "Share with group"; absent for someone else's. */
  actionLabel?: string;
  onAction?: () => void;
  busy?: boolean;
  testID?: string;
}

/**
 * Who sees a wallet item on a group trip (TR-61): shared or only you, who added it, and, for the
 * owner only, the switch between the two.
 */
export function SharingRow({
  shared,
  sharedTitle,
  addedBy,
  actionLabel,
  onAction,
  busy = false,
  testID = 'sharing',
}: SharingRowProps) {
  const icon: SFSymbol = shared ? 'person.2' : 'lock';
  const subtitle = addedBy
    ? `Added by ${addedBy}`
    : shared
      ? 'Everyone on the trip can see it'
      : "Others on the trip can't see it";
  return (
    <View style={styles.section}>
      <Surface padding="none" testID={testID}>
        <ListRow
          icon={icon}
          title={shared ? sharedTitle : 'Only you'}
          subtitle={subtitle}
          testID={`${testID}-status`}
        />
      </Surface>
      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          variant="secondary"
          icon={shared ? 'lock' : 'person.2'}
          onPress={onAction}
          disabled={busy}
          testID={`${testID}-toggle`}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
});
