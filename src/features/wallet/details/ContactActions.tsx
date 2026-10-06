import type { SFSymbol } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';
import { IconButton, Text } from '@/ui';

export interface ContactAction {
  key: string;
  label: string;
  icon: SFSymbol;
  /** Where it goes; null hides the action (the booking has no phone, website…). */
  url: string | null;
}

/** The hotel's round action buttons: Directions, Call, Website, Email, only those it has. */
export function ContactActions({
  actions,
  onOpen,
}: {
  actions: readonly ContactAction[];
  onOpen: (url: string) => void;
}) {
  const shown = actions.flatMap((a) => (a.url ? [{ ...a, url: a.url }] : []));
  if (shown.length === 0) return null;
  return (
    <View style={styles.row} testID="contact-actions">
      {shown.map((action) => (
        <View key={action.key} style={styles.action}>
          <IconButton
            icon={action.icon}
            label={action.label}
            size="lg"
            onPress={() => onOpen(action.url)}
            testID={`action-${action.key}`}
          />
          <Text variant="caption" tone="secondary">
            {action.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-around' },
  action: { alignItems: 'center', gap: spacing.xs, minWidth: 64 },
});
