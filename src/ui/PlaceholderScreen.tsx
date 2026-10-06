import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme';

import { Text } from './Text';

interface PlaceholderScreenProps {
  title: string;
  children?: ReactNode;
}

/** Temporary screen body until a tab's feature ticket lands. */
export function PlaceholderScreen({ title, children }: PlaceholderScreenProps) {
  return (
    <View style={styles.container}>
      <Text variant="largeTitle" accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxl,
    backgroundColor: colors.background,
  },
});
