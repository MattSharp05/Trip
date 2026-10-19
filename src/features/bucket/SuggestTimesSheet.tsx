import { StyleSheet, View } from 'react-native';

import type { Suggestion } from '@/core/smartAdd';
import { screenPadding, spacing } from '@/theme';
import { Button, Chip, Sheet, Text } from '@/ui';

import type { SuggestionRow } from './suggest';

export interface SuggestTimesSheetProps {
  open: boolean;
  /** The liked items, most likes first, with their suggested times (`bucketSuggestions`). */
  rows: SuggestionRow[];
  onAccept: (accepted: Suggestion[]) => void;
  onSkip: (bucketId: string) => void;
  onClose: () => void;
}

/**
 * Suggest times for liked items (TR-64): one row per liked Bucket List item with where it fits
 * ("Fri 13, 5:15 PM · 2 likes"), Accept or Skip each, or Accept all. Nothing is saved until you
 * accept.
 */
export function SuggestTimesSheet({
  open,
  rows,
  onAccept,
  onSkip,
  onClose,
}: SuggestTimesSheetProps) {
  const fitting = rows.flatMap((row) => (row.suggestion ? [row.suggestion] : []));
  return (
    <Sheet open={open} onClose={onClose} title="Suggested times" testID="suggest-sheet">
      <View style={styles.body}>
        {rows.map((row) => (
          <View key={row.bucketId} style={styles.row} testID={`suggest-row-${row.bucketId}`}>
            <View style={styles.text}>
              <Text variant="body" style={styles.title} numberOfLines={1}>
                {row.title}
              </Text>
              <Text variant="subhead" tone="secondary" numberOfLines={1}>
                {row.subtitle}
              </Text>
            </View>
            {row.suggestion ? (
              <View style={styles.actions}>
                <Chip
                  label="Skip"
                  onPress={() => onSkip(row.bucketId)}
                  testID={`suggest-skip-${row.bucketId}`}
                />
                <Chip
                  label="Accept"
                  onPress={() => onAccept([row.suggestion!])}
                  testID={`suggest-accept-${row.bucketId}`}
                />
              </View>
            ) : null}
          </View>
        ))}
        {fitting.length > 1 ? (
          <View style={styles.all}>
            <Button
              label="Accept all"
              onPress={() => onAccept(fitting)}
              testID="suggest-accept-all"
            />
          </View>
        ) : null}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: screenPadding, paddingBottom: spacing.md },
  row: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  text: { flex: 1, gap: spacing.xxs },
  title: { fontWeight: '600' },
  actions: { flexDirection: 'row', gap: spacing.sm },
  all: { paddingTop: spacing.md },
});
