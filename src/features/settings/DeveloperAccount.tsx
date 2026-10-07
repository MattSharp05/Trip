import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { useAuth } from '@/features/auth';
import { addSampleData, removeSampleData, sampleVegasTripId } from '@/scenarios/seedAccount';
import { useDataSource } from '@/services/data';
import { queryClient } from '@/services/data/hooks';
import { useTripStore } from '@/stores/trip';
import { spacing } from '@/theme';
import { ListRow, Surface, Text } from '@/ui';

type Busy = 'adding' | 'removing' | null;

/**
 * Settings → Developer, signed in (TR-35): put the sample Las Vegas trip (and the rest of the
 * sample account) into your own account for a demo, or take it out again. Hidden in a scenario's
 * demo session, which already has it.
 */
export function DeveloperAccount() {
  const auth = useAuth();
  const source = useDataSource();
  const router = useRouter();
  const [busy, setBusy] = useState<Busy>(null);
  const [status, setStatus] = useState<string | null>(null);
  if (auth.status !== 'signedIn' || source.kind !== 'supabase') return null;
  const userId = auth.session.user.id;

  const run = async (kind: Exclude<Busy, null>) => {
    if (busy) return;
    setBusy(kind);
    setStatus(null);
    try {
      if (kind === 'adding') {
        await addSampleData(source, userId);
        useTripStore.getState().selectTrip(sampleVegasTripId(userId));
      } else {
        await removeSampleData(source, userId);
        useTripStore.getState().selectTrip(null);
      }
      await queryClient.invalidateQueries();
      if (kind === 'adding') router.navigate('/plan');
      else setStatus('Sample data removed.');
    } catch {
      setStatus(
        kind === 'adding'
          ? "Couldn't add the sample trip. Check your connection and try again."
          : "Couldn't remove the sample data. Check your connection and try again.",
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Text variant="subhead" tone="secondary" style={styles.sectionTitle}>
        YOUR ACCOUNT
      </Text>
      <Surface padding="none" style={styles.card}>
        <ListRow
          icon="plus.circle"
          title={busy === 'adding' ? 'Adding the sample trip…' : 'Add the sample Las Vegas trip'}
          subtitle="Copies the sample trips into your account. Adding again changes nothing."
          onPress={() => void run('adding')}
          separator
          testID="dev-add-sample"
        />
        <ListRow
          icon="trash"
          title={busy === 'removing' ? 'Removing sample data…' : 'Remove sample data'}
          subtitle="Deletes the sample trips, places and passport. Your own trips stay."
          onPress={() => void run('removing')}
          testID="dev-remove-sample"
        />
      </Surface>
      {status ? (
        <Text variant="caption" tone="secondary" testID="dev-sample-status">
          {status}
        </Text>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { marginTop: spacing.lg },
  card: { overflow: 'hidden' },
});
