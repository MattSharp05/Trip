import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { spacing } from '@/theme';

import { Button } from './Button';
import { Text } from './Text';

export interface LoadErrorProps {
  /** What couldn't load, e.g. "Couldn't load this trip." */
  message: string;
  onRetry: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** A failed load (offline, server error): plain copy and "Try again" (TR-35). */
export function LoadError({ message, onRetry, style, testID }: LoadErrorProps) {
  return (
    <View style={[styles.container, style]} testID={testID}>
      <Text variant="body" tone="secondary" style={styles.center}>
        {message}
      </Text>
      <Button label="Try again" variant="secondary" onPress={onRetry} testID="load-error-retry" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: spacing.md, padding: spacing.xl },
  center: { textAlign: 'center' },
});
