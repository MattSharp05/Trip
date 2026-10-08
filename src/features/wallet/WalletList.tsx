import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { screenPadding, spacing } from '@/theme';
import { Button, Chip, LoadError, Skeleton, Text, useTabBarInset } from '@/ui';

import { walletDetailHref, WalletEntryCard } from './cards/registry';
import { useWallet } from './useWallet';
import { EMPTY_COPY, filterWallet, WALLET_FILTERS, type WalletFilter } from './walletItems';

/** Organize → Wallet: filter chips over the trip's booking cards and the account's documents. */
export function WalletList() {
  const router = useRouter();
  const tabBarInset = useTabBarInset();
  const [filter, setFilter] = useState<WalletFilter>('all');
  const { entries, places, isLoading, noTrip, loadError, retry } = useWallet();
  const shown = filterWallet(entries, filter);
  const empty =
    noTrip && filter !== 'document'
      ? { title: 'No trip selected', body: 'Pick a trip on the Trips tab to see its bookings.' }
      : EMPTY_COPY[filter];

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipRow}
        contentContainerStyle={styles.chips}
        testID="wallet-filters"
      >
        {WALLET_FILTERS.map((f) => (
          <Chip
            key={f.value}
            label={f.label}
            selected={f.value === filter}
            onPress={() => setFilter(f.value)}
            testID={`wallet-filter-${f.value}`}
          />
        ))}
      </ScrollView>
      <ScrollView
        contentContainerStyle={[styles.list, { paddingBottom: tabBarInset + spacing.lg }]}
        testID="wallet-list"
      >
        {loadError ? (
          <LoadError
            message="Couldn't load your wallet. Check your connection."
            onRetry={retry}
            testID="wallet-error"
          />
        ) : isLoading ? (
          [0, 1, 2, 3].map((i) => <Skeleton key={i} height={66} radius="card" />)
        ) : shown.length === 0 ? (
          <View style={styles.empty} testID="wallet-empty">
            <Text variant="headline">{empty.title}</Text>
            <Text variant="subhead" tone="secondary" style={styles.emptyBody}>
              {empty.body}
            </Text>
          </View>
        ) : (
          shown.map((entry) => (
            <WalletEntryCard
              key={entry.id}
              entry={entry}
              places={places}
              onPress={() => router.push(walletDetailHref(entry))}
            />
          ))
        )}
        {filter === 'document' && !isLoading ? (
          <Button
            label="Add passport or visa"
            variant="secondary"
            icon="plus"
            onPress={() => router.push('/organize/document/new')}
            testID="wallet-add-document"
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: spacing.md },
  // A horizontal ScrollView grows by default; keep the chip row its own height.
  chipRow: { flexGrow: 0 },
  chips: { gap: spacing.sm, paddingHorizontal: screenPadding },
  list: { gap: spacing.sm, paddingHorizontal: screenPadding },
  empty: { alignItems: 'center', gap: spacing.xs, paddingTop: spacing.xxxl },
  emptyBody: { textAlign: 'center' },
});
