import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { StyleSheet, View, type TextInputProps } from 'react-native';

import { colors, continuous, radii, spacing, typography } from '@/theme';
import { Text } from '@/ui';

export interface SheetFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string | null;
}

/**
 * A labelled input inside a bottom sheet. It uses the sheet's own text input, so the sheet moves
 * up with the keyboard instead of being covered by it.
 */
export function SheetField({ label, error, testID, ...input }: SheetFieldProps) {
  return (
    <View style={styles.field}>
      <Text variant="subhead" tone="secondary">
        {label}
      </Text>
      <BottomSheetTextInput
        accessibilityLabel={label}
        accessibilityHint={error ?? undefined}
        placeholderTextColor={colors.textSecondary}
        selectionColor={colors.accent}
        keyboardAppearance="dark"
        testID={testID}
        {...input}
        style={[styles.input, error ? styles.inputError : null]}
      />
      {error ? (
        <Text
          variant="subhead"
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
  field: { gap: spacing.xs },
  input: {
    ...typography.body,
    // No fixed line height: iOS clips the caret with one in a TextInput.
    lineHeight: undefined,
    height: 50,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.card,
    ...continuous,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    color: colors.textPrimary,
  },
  // No red (design.md): an error gets a brighter border.
  inputError: { borderColor: colors.textSecondary, borderWidth: 1 },
});
