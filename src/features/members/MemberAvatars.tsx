import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { avatarRow, memberLabel } from '@/core/members';
import { useTripMembers, type Member } from '@/services/data';
import { colors, radii, spacing } from '@/theme';
import { Text } from '@/ui';

import { MembersSheet } from './MembersSheet';

/** The header's circles (TDD → v2 → App: 24 pt). */
const SMALL = 24;
/** Each circle tucks this far under the one before it. */
const OVERLAP = spacing.sm;

export interface MemberAvatarProps {
  member: Pick<Member, 'initial' | 'isMe'>;
  size?: number;
  /** On a raised surface (a sheet): a lighter grey fill, so the circle still shows. */
  onRaised?: boolean;
  testID?: string;
}

/**
 * A member's initial in a circle (no photos, design.md): Raised surface fill, hairline border, white
 * initial. "You" get the orange ring.
 */
export function MemberAvatar({
  member,
  size = SMALL,
  onRaised = false,
  testID,
}: MemberAvatarProps) {
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size },
        onRaised && styles.onRaised,
        member.isMe && styles.me,
      ]}
      testID={testID}
    >
      <Text variant={size > SMALL ? 'body' : 'caption'} style={styles.initial}>
        {member.initial}
      </Text>
    </View>
  );
}

export interface MemberAvatarsProps {
  tripId: string;
  testID?: string;
}

/**
 * Who is on the trip (TR-56), next to the trip title on Plan, Organize and Discover: up to four
 * overlapping initials, you last with the orange ring, then "+n". Hidden while you're alone on the
 * trip (and while the members load: there's nothing to hold room for). Tapping opens the members
 * sheet.
 */
export function MemberAvatars({ tripId, testID = 'member-avatars' }: MemberAvatarsProps) {
  const { data: members } = useTripMembers(tripId);
  const [open, setOpen] = useState(false);
  // The sheet mounts on the first tap and stays, so closing it still animates.
  const [used, setUsed] = useState(false);
  const { shown, more } = avatarRow(members ?? []);
  const names = (members ?? []).map(memberLabel).join(', ');

  return (
    <>
      {/* The row hides once you're alone (the last member removed), but an open sheet stays. */}
      {shown.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Trip members: ${names}`}
          accessibilityHint="Shows who is on the trip"
          hitSlop={spacing.sm}
          onPress={() => {
            setUsed(true);
            setOpen(true);
          }}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          testID={testID}
        >
          {shown.map((member, i) => (
            <View key={member.id} style={i > 0 && styles.tucked}>
              <MemberAvatar member={member} testID={`${testID}-${member.id}`} />
            </View>
          ))}
          {more > 0 ? (
            <Text variant="caption" tone="secondary" style={styles.more} testID={`${testID}-more`}>
              {`+${more}`}
            </Text>
          ) : null}
        </Pressable>
      ) : null}
      {used ? (
        <MembersSheet
          open={open}
          onClose={() => setOpen(false)}
          tripId={tripId}
          testID={`${testID}-sheet`}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  avatar: {
    borderRadius: radii.pill,
    backgroundColor: colors.raised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onRaised: { backgroundColor: colors.fill },
  me: { borderWidth: 1.5, borderColor: colors.accent },
  initial: { fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center' },
  tucked: { marginLeft: -OVERLAP },
  more: { marginLeft: spacing.xs },
  pressed: { opacity: 0.6 },
});
