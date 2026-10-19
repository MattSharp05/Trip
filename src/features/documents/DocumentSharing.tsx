import { useState } from 'react';
import { Alert } from 'react-native';

import { FALLBACK_NAME } from '@/core/members';
import { SharingRow } from '@/features/members/SharingRow';
import { useMyProfile, useSetDocumentShared, useTripMembers } from '@/services/data';
import type { TravelDocument } from '@/services/data/types';
import { useTripStore } from '@/stores/trip';

/**
 * A passport or visa on a group trip (TR-61): private by default; its owner can share it with the
 * selected trip (its members can then read it and its photos) or stop sharing. Someone else's
 * shows who shared it.
 */
export function DocumentSharing({ document }: { document: TravelDocument }) {
  const tripId = useTripStore((s) => s.selectedTripId);
  const members = useTripMembers(tripId);
  const profile = useMyProfile();
  const setShared = useSetDocumentShared();
  const [busy, setBusy] = useState(false);
  const memberList = members.data ?? [];
  const me = memberList.find((m) => m.isMe)?.id ?? profile.data?.id;
  if (!tripId || !me || memberList.length < 2) return null;

  const owner = document.addedBy ?? me;
  const shared = (document.sharedTripIds ?? []).includes(tripId);
  const flip = async () => {
    setBusy(true);
    try {
      await setShared.mutateAsync({ id: document.id, tripId, shared: !shared });
    } catch {
      Alert.alert(
        shared ? "Couldn't stop sharing it" : "Couldn't share it",
        'Check your connection and try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <SharingRow
      shared={shared}
      sharedTitle="Shared with this trip"
      addedBy={
        owner === me ? null : (memberList.find((m) => m.id === owner)?.name ?? FALLBACK_NAME)
      }
      {...(owner === me
        ? { actionLabel: shared ? 'Stop sharing' : 'Share with this trip', onAction: flip }
        : {})}
      busy={busy}
      testID="document-sharing"
    />
  );
}
