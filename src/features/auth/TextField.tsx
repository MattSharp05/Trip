import type { Ref } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { colors, continuous, radii, spacing, typography } from '@/theme';
import { Text } from '@/ui';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  /** Shown under the field in place of `hint`. */
  error?: string | null;
  hint?: string;
  ref?: Ref<TextInput>;
}

/** A labelled single-line input on a raised surface, with an inline error underneath. */
export function TextField({ label, error, hint, ref, testID, ...input }: TextFieldProps) {
  const note = error ?? hint;
  return (
    <View style={styles.field}>
      <Text variant="subhead" tone="secondary">
        {label}
      </Text>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        placeholderTextColor={colors.textSecondary}
        selectionColor={colors.accent}
        keyboardAppearance="dark"
        testID={testID}
        {...input}
        style={[styles.input, error ? styles.inputError : null]}
      />
      {note ? (
        <Text
          variant="subhead"
          tone={error ? 'primary' : 'secondary'}
          accessibilityLiveRegion={error ? 'polite' : undefined}
          testID={testID && error ? `${testID}-error` : undefined}
        >
          {note}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  input: {
    ...typography.body,
    // Keep the line height off: iOS clips the caret with a fixed line height in a TextInput.
    lineHeight: undefined,
    height: 50,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.card,
    ...continuous,
    backgroundColor: colors.raised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    color: colors.textPrimary,
  },
  // No red (design.md: orange is the only accent): an error gets a brighter border instead.
  inputError: { borderColor: colors.textSecondary, borderWidth: 1 },
});
