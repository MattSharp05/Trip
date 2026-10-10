import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { shortRangeLabel } from '@/core/dates';
import { isInviteInactive, isInviteToken } from '@/core/inviteLink';
import { inviteCompanyLine } from '@/core/members';
import { forgetInvite } from '@/features/auth';
import { askForName } from '@/features/settings';
import { useOpenTrip } from '@/features/trips/selectedTrip';
import { useAcceptInvite, useInvitePreview, useTrips } from '@/services/data';
import { colors, screenPadding, spacing } from '@/theme';
import { Button, LoadError, PhotoCard, Skeleton, Text } from '@/ui';

const CARD_HEIGHT = 220;

export const INACTIVE_MESSAGE = 'This invite link is no longer active. Ask for a new one.';

export interface InvitePreviewProps {
  token: string;
  testID?: string;
}

/**
 * An invite link opened by a signed-in traveller (TR-57, ADR 0029): the trip's cover, "Join Las
 * Vegas", its dates and who is on it, then **Join**, which adds them and opens the trip on Plan
 * with the map. Someone already on the trip goes straight to it. Accounts still on the name made
 * up from their email are asked for one first (TR-55).
 */
export function InvitePreview({ token, testID = 'invite-preview' }: InvitePreviewProps) {
  const router = useRouter();
  const valid = isInviteToken(token);
  const preview = useInvitePreview(token, valid);
  const { mutateAsync: accept, isPending: joining } = useAcceptInvite();
  const { data: trips } = useTrips();
  const openTrip = useOpenTrip();
  const [joinedTripId, setJoinedTripId] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<unknown>(null);

  useEffect(() => {
    // Back at the invite after signing in: it's done its job.
    forgetInvite();
    askForName();
  }, []);

  // Open the trip once it is in the trips list (after Join's refresh), so Plan has it to show.
  const target = joinedTripId ?? (preview.data?.alreadyMember ? preview.data.tripId : null);
  const trip = target ? trips?.find((t) => t.id === target) : undefined;
  useEffect(() => {
    if (trip) openTrip(trip, { leave: true });
  }, [trip, openTrip]);

  const join = async () => {
    setJoinError(null);
    try {
      setJoinedTripId(await accept(token));
    } catch (error) {
      setJoinError(error);
    }
  };

  const goToTrips = () => router.dismissTo('/trips');

  let body;
  if (!valid || isInviteInactive(preview.error) || isInviteInactive(joinError)) {
    body = (
      <View style={styles.message} testID={`${testID}-inactive`}>
        <Text variant="headline" style={styles.center}>
          {INACTIVE_MESSAGE}
        </Text>
        <Button label="Go to my trips" variant="secondary" onPress={goToTrips} />
      </View>
    );
  } else if (preview.isError) {
    body = (
      <LoadError
        message="Couldn't load this invite. Check your connection."
        onRetry={() => void preview.refetch()}
        testID={`${testID}-error`}
      />
    );
  } else if (!preview.data || target) {
    // Loading, or on the way to the trip.
    body = (
      <View style={styles.body} testID={`${testID}-loading`}>
        <Skeleton height={CARD_HEIGHT} radius="photo" />
        <Skeleton height={50} radius="card" />
      </View>
    );
  } else {
    const { city, startDate, endDate, coverPhotoUrl, inviterName, memberCount } = preview.data;
    body = (
      <View style={styles.body}>
        <PhotoCard
          source={coverPhotoUrl ? { uri: coverPhotoUrl } : null}
          title={`Join ${city}`}
          subtitle={`${shortRangeLabel(startDate, endDate)} · ${inviteCompanyLine(inviterName, memberCount)}`}
          height={CARD_HEIGHT}
          testID={`${testID}-card`}
        />
        <Text variant="body" tone="secondary">
          {`${inviterName} invited you to plan this trip together. Everyone on it sees and edits the plan.`}
        </Text>
        <Button
          label={joining ? 'Joining…' : 'Join'}
          onPress={() => void join()}
          disabled={joining}
          testID={`${testID}-join`}
        />
        <Button label="Not now" variant="secondary" onPress={goToTrips} />
        {joinError ? (
          <Text variant="subhead" tone="secondary" style={styles.center}>
            {"Couldn't join the trip. Check your connection and try again."}
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} testID={testID}>
      <ScrollView contentContainerStyle={styles.content}>{body}</ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: screenPadding,
    paddingVertical: spacing.xxl,
  },
  body: { gap: spacing.lg },
  message: { alignItems: 'center', gap: spacing.lg },
  center: { textAlign: 'center' },
});
