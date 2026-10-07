import { Pressable, StyleSheet, View } from 'react-native';

import { colors, continuous, radii, spacing } from '@/theme';
import { Icon, IconButton, Text } from '@/ui';

export interface LinkBannerProps {
  /** Reads the clipboard and finds the places in the link. */
  onAdd: () => void;
  onDismiss: () => void;
}

/**
 * "Add this TikTok?": shown on Plan when the app opens with a link on the clipboard. The clipboard
 * is only read once it's tapped.
 */
export function LinkBanner({ onAdd, onDismiss }: LinkBannerProps) {
  return (
    <View style={styles.banner} testID="link-banner">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add this TikTok?"
        accessibilityHint="Pastes the link you copied and finds its places"
        onPress={onAdd}
        style={({ pressed }) => [styles.main, pressed && styles.pressed]}
        testID="link-banner-add"
      >
        <View style={styles.tile}>
          <Icon name="play.rectangle" size="md" tone="accent" />
        </View>
        <View style={styles.text}>
          <Text variant="body" style={styles.title}>
            Add this TikTok?
          </Text>
          <Text variant="subhead" tone="secondary" numberOfLines={1}>
            Find the places in the link you copied
          </Text>
        </View>
      </Pressable>
      <IconButton
        icon="xmark"
        label="Not now"
        variant="plain"
        onPress={onDismiss}
        testID="link-banner-dismiss"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingRight: spacing.sm,
    borderRadius: radii.card,
    ...continuous,
    backgroundColor: colors.raised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.card,
    ...continuous,
  },
  pressed: { backgroundColor: colors.fill },
  tile: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    ...continuous,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: spacing.xxs },
  title: { fontWeight: '600' },
});
