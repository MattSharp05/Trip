import { useRef, useState } from 'react';
import { Alert, Share, StyleSheet, View } from 'react-native';

import { now } from '@/core/clock';
import { memberRoleLine } from '@/core/members';
import { defaultTrip } from '@/core/trips';
import { useSwitchTrip } from '@/features/trips/selectedTrip';
import {
  useLeaveTrip,
  useRemoveMember,
  useTripMembers,
  useTrips,
  type Member,
} from '@/services/data';
import { colors, spacing } from '@/theme';
import {
  Button,
  IconButton,
  LoadError,
  Sheet,
  SheetConfirm,
  Skeleton,
  Text,
  type ConfirmRequest,
} from '@/ui';

import { InviteButton } from './InviteButton';
import { MemberAvatar } from './MemberAvatars';

/** The sheet's avatars: a size up from the header's. */
const ROW_AVATAR = 36;

export interface MembersSheetProps {
  open: boolean;
  onClose: () => void;
  tripId: string;
  testID?: string;
}

/**
 * Who is on the trip (TR-56; PRD v2 decision 2): everyone with "Organizer" under the creator and
 * "You" under yourself. The creator removes members from a row's menu (confirmed); anyone else can
 * leave the trip from the bottom (confirmed), after which the next trip is selected.
 *
 * The menu and the confirms are asked in the sheet (`SheetConfirm`), not with ActionSheetIOS or
 * Alert: on iOS those open behind the sheet's full-window overlay, out of reach (TR-56).
 */
export function MembersSheet({
  open,
  onClose,
  tripId,
  testID = 'members-sheet',
}: MembersSheetProps) {
  const { data: members, isPending, isError, refetch } = useTripMembers(tripId);
  const { data: trips, isPending: tripsPending } = useTrips();
  const { mutateAsync: remove } = useRemoveMember();
  const { mutateAsync: leave, isPending: leaving } = useLeaveTrip();
  const switchTrip = useSwitchTrip();
  const [error, setError] = useState<string | null>(null);
  // The question the sheet shows in place of the list; each opening starts on the list.
  const [prompt, setPrompt] = useState<ConfirmRequest | null>(null);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setPrompt(null);
  }

  const me = members?.find((m) => m.isMe);
  const iAmOrganizer = me?.role === 'owner';
  const trip = trips?.find((t) => t.id === tripId);
  const city = trip?.city ?? 'this trip';

  const confirmRemove = (member: Member) =>
    setPrompt({
      title: `Remove ${member.name} from the trip?`,
      message: 'What they added stays on the trip.',
      confirmLabel: 'Remove',
      onConfirm: () => {
        setError(null);
        remove({ tripId, userId: member.id }).catch(() =>
          setError("Couldn't remove them. Check your connection and try again."),
        );
      },
      testID: `${testID}-remove-confirm`,
    });

  // A plain menu, not a swipe (v1: custom gestures green in Jest failed on the phone).
  const openMenu = (member: Member) =>
    setPrompt({
      title: member.name,
      confirmLabel: 'Remove from trip',
      onConfirm: () => confirmRemove(member),
      testID: `${testID}-member-menu`,
    });

  const leaveTrip = async () => {
    // Move to the next trip first (as the Trips tab would pick it), so nothing refetches or shows
    // the trip being left once you're off it; come back to it if leaving fails.
    const here = trips?.find((t) => t.id === tripId) ?? null;
    onClose();
    switchTrip(defaultTrip(trips?.filter((t) => t.id !== tripId) ?? [], now()));
    try {
      await leave(tripId);
    } catch {
      switchTrip(here);
      Alert.alert("Couldn't leave the trip", 'Check your connection and try again.');
    }
  };

  // The share sheet opens once this sheet is gone (behind it, it would be out of reach).
  const shareLater = useRef<string | null>(null);
  const openShare = (message: string) =>
    // Closing the share sheet without sending is fine; nothing to report.
    void Share.share({ message }).catch(() => {});
  const share = (message: string) => {
    if (!open) return openShare(message);
    shareLater.current = message;
    onClose();
  };
  const handleClosed = () => {
    const message = shareLater.current;
    shareLater.current = null;
    if (message) openShare(message);
  };

  const confirmLeave = () =>
    setPrompt({
      title: `Leave ${city}?`,
      message: 'The trip disappears from your trips. What you added stays.',
      confirmLabel: 'Leave',
      onConfirm: () => void leaveTrip(),
      testID: `${testID}-leave-confirm`,
    });

  return (
    <Sheet
      open={open}
      onClose={onClose}
      onClosed={handleClosed}
      title={prompt ? undefined : 'Trip members'}
    >
      {prompt ? (
        <SheetConfirm
          {...prompt}
          onConfirm={() => {
            // Back to the list first: a menu's choice asks its own question next.
            setPrompt(null);
            prompt.onConfirm();
          }}
          onCancel={() => setPrompt(null)}
        />
      ) : null}
      {/* Hidden, not unmounted, under a question: the invite button keeps its note. */}
      <View style={[styles.body, prompt && styles.hidden]} testID={testID}>
        {trip ? (
          <InviteButton
            tripId={tripId}
            city={trip.city}
            confirm={setPrompt}
            share={share}
            testID={`${testID}-invite`}
          />
        ) : null}
        {isPending ? (
          <View style={styles.list}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={52} radius="card" />
            ))}
          </View>
        ) : isError && !members ? (
          <LoadError
            message="Couldn't load the trip members. Check your connection."
            onRetry={() => void refetch()}
          />
        ) : (
          <View>
            {(members ?? []).map((member, i) => (
              <MemberRow
                key={member.id}
                member={member}
                separator={i < (members?.length ?? 0) - 1}
                onMenu={iAmOrganizer && member.role !== 'owner' ? openMenu : undefined}
                testID={`${testID}-${member.id}`}
              />
            ))}
          </View>
        )}
        {error ? (
          <Text variant="subhead" tone="secondary" testID={`${testID}-error`}>
            {error}
          </Text>
        ) : null}
        {me && !iAmOrganizer ? (
          <Button
            label="Leave trip"
            variant="secondary"
            icon="rectangle.portrait.and.arrow.right"
            onPress={confirmLeave}
            disabled={leaving || tripsPending}
            testID={`${testID}-leave`}
          />
        ) : null}
      </View>
    </Sheet>
  );
}

interface MemberRowProps {
  member: Member;
  separator: boolean;
  /** The organizer's menu for this row; none for yourself, the organizer, or a non-organizer. */
  onMenu?: (member: Member) => void;
  testID: string;
}

function MemberRow({ member, separator, onMenu, testID }: MemberRowProps) {
  const role = memberRoleLine(member);
  return (
    <View
      style={[styles.row, separator && styles.separator]}
      accessible={!onMenu}
      accessibilityLabel={role ? `${member.name}, ${role}` : member.name}
      testID={testID}
    >
      <MemberAvatar member={member} size={ROW_AVATAR} onRaised />
      <View style={styles.text}>
        <Text variant="body" style={styles.name} numberOfLines={1}>
          {member.name}
        </Text>
        {role ? (
          <Text variant="subhead" tone="secondary" numberOfLines={1}>
            {role}
          </Text>
        ) : null}
      </View>
      {onMenu ? (
        <IconButton
          icon="ellipsis"
          label={`Options for ${member.name}`}
          variant="plain"
          onPress={() => onMenu(member)}
          testID={`${testID}-menu`}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.md },
  hidden: { display: 'none' },
  list: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    paddingVertical: spacing.sm,
  },
  separator: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline },
  text: { flex: 1, gap: spacing.xxs },
  name: { fontWeight: '600' },
});
