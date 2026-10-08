import { Stack } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { colors, screenPadding, spacing } from '@/theme';
import { LoadError, Skeleton, Text, Toast, useTabBarInset } from '@/ui';

import { useWallet } from '../useWallet';

/**
 * The frame every booking detail shares: navigation bar title, a skeleton while the trip loads,
 * a plain message once the booking is gone, and one toast for failed actions.
 */
export function BookingDetailScreen({
  title,
  isLoading,
  missing,
  toast,
  onDismissToast,
  children,
}: {
  title: string;
  isLoading: boolean;
  /** Shown when the booking isn't in the wallet; null while there is one. */
  missing: string | null;
  toast: string | null;
  onDismissToast: () => void;
  children: ReactNode;
}) {
  const { loadError, retry } = useWallet();
  const tabBarInset = useTabBarInset();
  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: tabBarInset + spacing.lg }]}
      >
        <Stack.Screen options={{ headerShown: true, title, headerBackTitle: 'Organize' }} />
        {isLoading ? (
          <>
            <Skeleton height={180} radius="photo" />
            <Skeleton height={56} radius="card" />
            <Skeleton height={120} radius="card" />
          </>
        ) : missing && loadError ? (
          <LoadError message="Couldn't load this booking. Check your connection." onRetry={retry} />
        ) : missing ? (
          <View style={styles.missing}>
            <Text variant="headline">{missing}</Text>
          </View>
        ) : (
          children
        )}
      </ScrollView>
      <Toast visible={toast !== null} message={toast ?? ''} onDismiss={onDismissToast} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { gap: spacing.xl, padding: screenPadding },
  missing: { alignItems: 'center', paddingTop: spacing.xxxl },
});
