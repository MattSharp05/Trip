import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, continuous, radii, screenPadding, spacing } from '@/theme';

import { useTabBarInset } from './tabBar';
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
  /**
   * `tabBar` (default): floats just above the native tab bar, for every screen inside the tabs.
   * `screen`: just above the home indicator, for screens without a tab bar (Settings).
   */
  placement?: 'tabBar' | 'screen';
  testID?: string;
}

/**
 * A short confirmation floating at the bottom of the screen, optionally with one action (Undo).
 * It positions itself (absolutely, over the screen's content), so render it as a direct child of
 * the screen's full-height root view.
 */
export function Toast({
  visible,
  message,
  actionLabel,
  onAction,
  onDismiss,
  duration = 4000,
  placement = 'tabBar',
  testID,
}: ToastProps) {
  const tabBarInset = useTabBarInset();
  const insets = useSafeAreaInsets();
  const bottom = placement === 'tabBar' ? tabBarInset : insets.bottom + spacing.lg;

  // Latest callback without restarting the timer on every parent render.
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  });

  // A new message gets the full duration.
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => onDismissRef.current(), duration);
    return () => clearTimeout(timer);
  }, [visible, message, duration]);

  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(150)}
      exiting={FadeOut.duration(150)}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={[styles.toast, { bottom }]}
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
    position: 'absolute',
    left: screenPadding,
    right: screenPadding,
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
