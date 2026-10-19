import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useScenarioStore } from '@/stores/scenario';
import { screenPadding, spacing } from '@/theme';
import { Button, Chip, LoadError, Segmented, Skeleton, Text, useTabBarInset } from '@/ui';

import { walletDetailHref, WalletEntryCard } from './cards/registry';
import { useWallet } from './useWallet';
import {
  EMPTY_COPY,
  filterWallet,
  scopeEmptyCopy,
  scopeWallet,
  WALLET_FILTERS,
  WALLET_SCOPES,
  walletTag,
  type WalletFilter,
  type WalletScope,
} from './walletItems';

/**
 * Organize → Wallet: filter chips over the trip's booking cards and the account's documents. On a
 * group trip, Mine / Shared above the chips (TR-61): your private things, or everyone's shared ones.
 */
export function WalletList() {
  const router = useRouter();
  const tabBarInset = useTabBarInset();
  const [filter, setFilter] = useState<WalletFilter>('all');
  // A scenario can open either side; read once, on mount.
  const [scope, setScope] = useState<WalletScope>(
    () => useScenarioStore.getState().view.walletScope ?? 'mine',
  );
  const { entries, places, isLoading, noTrip, loadError, retry, me, tripId, isGroup, nameOf } =
    useWallet();
  const scoped = isGroup && me !== null ? scopeWallet(entries, scope, me, tripId) : entries;
  const shown = filterWallet(scoped, filter);
  const empty =
    noTrip && filter !== 'document'
      ? { title: 'No trip selected', body: 'Pick a trip on the Trips tab to see its bookings.' }
      : isGroup
        ? scopeEmptyCopy(scope, filter)
        : EMPTY_COPY[filter];

  return (
    <View style={styles.container}>
      {isGroup ? (
        <View style={styles.scope}>
          <Segmented
            segments={WALLET_SCOPES}
            value={scope}
            onChange={setScope}
            testID="wallet-scope"
          />
        </View>
      ) : null}
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
              tag={isGroup && me !== null ? walletTag(entry, me, tripId, nameOf) : null}
              onPress={() => router.push(walletDetailHref(entry))}
            />
          ))
        )}
        {filter === 'document' && !isLoading && !(isGroup && scope === 'shared') ? (
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
  scope: { paddingHorizontal: screenPadding },
  // A horizontal ScrollView grows by default; keep the chip row its own height.
  chipRow: { flexGrow: 0 },
  chips: { gap: spacing.sm, paddingHorizontal: screenPadding },
  list: { gap: spacing.sm, paddingHorizontal: screenPadding },
  empty: { alignItems: 'center', gap: spacing.xs, paddingTop: spacing.xxxl },
  emptyBody: { textAlign: 'center' },
});
