import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';

import { Button } from './Button';
import { Text } from './Text';

/** A question asked inside a sheet: what `SheetConfirm` shows. */
export interface ConfirmRequest {
  title: string;
  message?: string;
  /** The action's button, e.g. "Remove". */
  confirmLabel: string;
  onConfirm: () => void;
  testID?: string;
}

export interface SheetConfirmProps extends ConfirmRequest {
  onCancel: () => void;
}

/**
 * A menu or confirm drawn in a sheet's own content, in place of `Alert` or `ActionSheetIOS`. On iOS
 * a Sheet draws in react-native-screens' full-window overlay, and native dialogs presented from
 * inside it open behind it, out of reach (TR-56: the members sheet's Remove menu). The sheet that
 * owns it swaps its content for this, and back on Cancel.
 */
export function SheetConfirm({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  testID = 'sheet-confirm',
}: SheetConfirmProps) {
  return (
    <View style={styles.box} testID={testID}>
      <View style={styles.text}>
        <Text variant="headline" accessibilityRole="header">
          {title}
        </Text>
        {message ? (
          <Text variant="subhead" tone="secondary">
            {message}
          </Text>
        ) : null}
      </View>
      <Button label={confirmLabel} onPress={onConfirm} testID={`${testID}-confirm`} />
      <Button label="Cancel" variant="secondary" onPress={onCancel} testID={`${testID}-cancel`} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.md },
  text: { gap: spacing.xs },
});
