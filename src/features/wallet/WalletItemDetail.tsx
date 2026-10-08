import { Stack } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { colors, screenPadding, spacing } from '@/theme';
import { ListRow, LoadError, Skeleton, Surface, Text, useTabBarInset } from '@/ui';

import { walletLabel, WalletEntryCard } from './cards/registry';
import { formatMonthYear } from './format';
import { useWallet } from './useWallet';
import type { WalletEntry } from './walletItems';

function facts(entry: WalletEntry): { title: string; value: string }[] {
  if (entry.type === 'document') {
    const { expiresOn } = entry.document;
    return expiresOn ? [{ title: 'Expires', value: formatMonthYear(expiresOn) }] : [];
  }
  return [{ title: 'Confirmation', value: entry.booking.data.confirmation }];
}

/**
 * The fallback detail screen for wallet types that have no screen of their own yet: the card and
 * its confirmation number.
 */
export function WalletItemDetail({ id }: { id: string }) {
  const { entries, places, isLoading, loadError, retry } = useWallet();
  const tabBarInset = useTabBarInset();
  const entry = entries.find((e) => e.id === id);
  const title = entry ? walletLabel(entry) : '';
  const rows = entry ? facts(entry) : [];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: tabBarInset + spacing.lg }]}
    >
      <Stack.Screen options={{ headerShown: true, title, headerBackTitle: 'Organize' }} />
      {isLoading ? (
        <Skeleton height={66} radius="card" />
      ) : entry ? (
        <>
          <WalletEntryCard entry={entry} places={places} />
          {rows.length > 0 ? (
            <Surface padding="none">
              {rows.map((fact) => (
                <ListRow key={fact.title} title={fact.title} value={fact.value} />
              ))}
            </Surface>
          ) : null}
        </>
      ) : loadError ? (
        <LoadError message="Couldn't load this item. Check your connection." onRetry={retry} />
      ) : (
        <View style={styles.missing}>
          <Text variant="headline">This item is no longer in your wallet</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { gap: spacing.md, padding: screenPadding },
  missing: { alignItems: 'center', paddingTop: spacing.xxxl },
});
