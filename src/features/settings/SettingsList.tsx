import type { ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, screenPadding, spacing, typography } from '@/theme';
import { Surface, Text } from '@/ui';

/** A grouped list under the native large-title header, like iOS Settings. */
export function SettingsScroll({ children, testID }: { children: ReactNode; testID?: string }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.screen}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxxl }]}
      testID={testID}
    >
      {children}
    </ScrollView>
  );
}

/** A titled card of rows, with an optional note under it. */
export function SettingsGroup({
  title,
  footer,
  children,
}: {
  title?: string;
  footer?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.group}>
      {title ? (
        <Text variant="caption" tone="secondary" style={styles.groupTitle}>
          {title.toUpperCase()}
        </Text>
      ) : null}
      <Surface padding="none" style={styles.card}>
        {children}
      </Surface>
      {footer ? (
        <Text variant="caption" tone="secondary" style={styles.footer}>
          {footer}
        </Text>
      ) : null}
    </View>
  );
}

/** A row with a label and a control on the right (a segmented control). */
export function SettingRow({
  title,
  separator = false,
  children,
}: {
  title: string;
  separator?: boolean;
  children: ReactNode;
}) {
  return (
    <View style={[styles.row, separator && styles.separator]}>
      <Text variant="body" style={styles.title}>
        {title}
      </Text>
      <View style={styles.control}>{children}</View>
    </View>
  );
}

/** A row that is one action, in the accent colour (Sign out). */
export function ActionRow({
  title,
  onPress,
  testID,
}: {
  title: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Text variant="body" tone="accent" style={styles.title}>
        {title}
      </Text>
    </Pressable>
  );
}

/** A labelled text field as one row of a group (Name, Venmo…), with its error under it. */
export function FieldRow({
  label,
  error,
  separator = false,
  testID,
  ...input
}: Omit<TextInputProps, 'style'> & { label: string; error?: string | null; separator?: boolean }) {
  return (
    <View style={[styles.field, separator && styles.separator]}>
      <View style={styles.fieldRow}>
        <Text variant="body" style={styles.fieldLabel}>
          {label}
        </Text>
        <TextInput
          accessibilityLabel={label}
          accessibilityHint={error ?? undefined}
          placeholderTextColor={colors.textSecondary}
          selectionColor={colors.accent}
          keyboardAppearance="dark"
          autoCorrect={false}
          testID={testID}
          {...input}
          style={styles.input}
        />
      </View>
      {error ? (
        <Text
          variant="subhead"
          tone="secondary"
          accessibilityLiveRegion="polite"
          testID={testID ? `${testID}-error` : undefined}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: screenPadding, paddingTop: spacing.sm, gap: spacing.xxl },
  group: { gap: spacing.sm },
  groupTitle: { paddingHorizontal: spacing.md },
  footer: { paddingHorizontal: spacing.md },
  card: { overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 52,
  },
  separator: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline },
  pressed: { backgroundColor: colors.fill },
  title: { flex: 1, fontWeight: '500' },
  control: { width: 148 },
  field: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.xs },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 36 },
  fieldLabel: { width: 96, fontWeight: '500' },
  // No fixed line height: iOS clips the caret with one in a TextInput.
  input: { ...typography.body, lineHeight: undefined, flex: 1, color: colors.textPrimary },
});
