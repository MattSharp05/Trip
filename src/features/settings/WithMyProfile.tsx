import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { type Profile, useMyProfile } from '@/services/data';
import { spacing } from '@/theme';
import { LoadError, Skeleton } from '@/ui';

import { SettingsScroll } from './SettingsList';

/**
 * Loads your profile for Settings → Name and Payment info: skeleton rows while it loads, a retry
 * if it fails, then the form (keyed by profile id, so a new account starts from its own values).
 */
export function WithMyProfile({
  rows,
  testID,
  children,
}: {
  /** How many rows the skeleton shows. */
  rows: number;
  testID: string;
  children: (profile: Profile) => ReactNode;
}) {
  const profile = useMyProfile();
  if (profile.data) return <>{children(profile.data)}</>;
  return (
    <SettingsScroll testID={testID}>
      {profile.isError ? (
        <LoadError
          message="Couldn't load your profile."
          onRetry={() => void profile.refetch()}
          testID={`${testID}-error`}
        />
      ) : (
        <View style={styles.skeleton} testID={`${testID}-loading`}>
          {Array.from({ length: rows }, (_, i) => (
            <Skeleton key={i} height={52} radius="card" />
          ))}
        </View>
      )}
    </SettingsScroll>
  );
}

const styles = StyleSheet.create({ skeleton: { gap: spacing.xs, paddingTop: spacing.xxl } });
