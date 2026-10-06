import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { colors, continuous, radii, spacing } from '@/theme';

import { Text } from './Text';

export interface ToastProps {
  visible: boolean;
  message: string;
  /** e.g. "Undo". The toast closes after the action runs. */
  actionLabel?: string;
  onAction?: () => void;
  /** Called when the toast should go away (after `duration`, or after the action). */
  onDismiss: () => void;
  /** Milliseconds before it closes on its own. */
  duration?: number;
  testID?: string;
}

/** A short confirmation at the bottom of the screen, optionally with one action (Undo). */
export function Toast({
  visible,
  message,
  actionLabel,
  onAction,
  onDismiss,
  duration = 4000,
  testID,
}: ToastProps) {
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [visible, duration, onDismiss]);

  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(150)}
      exiting={FadeOut.duration(150)}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={styles.toast}
      testID={testID}
    >
      <Text variant="body" style={styles.message} numberOfLines={2}>
        {message}
      </Text>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          hitSlop={spacing.md}
          onPress={() => {
            onAction();
            onDismiss();
          }}
        >
          <Text variant="headline" tone="accent">
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.card,
    ...continuous,
    backgroundColor: colors.raised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  message: { flex: 1 },
});
