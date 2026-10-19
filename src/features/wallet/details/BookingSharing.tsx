import { useState } from 'react';
import { Alert } from 'react-native';

import { hideWarning } from '@/core/members';
import { SharingRow } from '@/features/members/SharingRow';
import { useSetBookingVisibility, useTripMembers } from '@/services/data';
import { bookingVisibility } from '@/services/data/bookings/visibility';
import type { Booking, BookingVisibility } from '@/services/data/types';

import { useWallet } from '../useWallet';

/**
 * Mine / Shared on a booking's detail (TR-61), on a group trip only: who sees it and who added it.
 * Its owner can flip it; making a shared booking private asks first, naming who loses it.
 */
export function BookingSharing({ booking }: { booking: Booking }) {
  const { me, isGroup, nameOf } = useWallet();
  const members = useTripMembers(booking.tripId);
  const setVisibility = useSetBookingVisibility();
  const [busy, setBusy] = useState(false);
  if (!isGroup || me === null) return null;

  const shared = bookingVisibility(booking) === 'shared';
  // v1 rows carry no owner: they are yours.
  const owner = booking.addedBy ?? me;
  const mine = owner === me;

  const flip = async (visibility: BookingVisibility) => {
    setBusy(true);
    try {
      await setVisibility.mutateAsync({ id: booking.id, visibility });
    } catch {
      Alert.alert(
        visibility === 'private' ? "Couldn't make it private" : "Couldn't share it",
        'Check your connection and try again.',
      );
    } finally {
      setBusy(false);
    }
  };
  const onAction = () => {
    if (!shared) {
      void flip('shared');
      return;
    }
    const others = (members.data ?? []).filter((m) => !m.isMe).map((m) => m.name);
    Alert.alert('Make this private?', hideWarning(others), [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Make private', style: 'destructive', onPress: () => void flip('private') },
    ]);
  };

  return (
    <SharingRow
      shared={shared}
      sharedTitle="Shared with the group"
      addedBy={mine ? null : nameOf(owner)}
      {...(mine ? { actionLabel: shared ? 'Make private' : 'Share with group', onAction } : {})}
      busy={busy}
      testID="booking-sharing"
    />
  );
}
