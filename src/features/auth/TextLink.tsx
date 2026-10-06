import { Pressable, StyleSheet } from 'react-native';

import { Text } from '@/ui';

/** An inline text button in the accent colour, iOS-style ("Sign in", "Forgot password?"). */
export function TextLink({
  label,
  onPress,
  testID,
}: {
  label: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={8}
      testID={testID}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <Text variant="body" tone="accent">
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({ pressed: { opacity: 0.6 } });
