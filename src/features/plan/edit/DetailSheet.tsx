import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { timeAsDate, timeOfDate } from '@/core/dates';
import { DEFAULT_DURATION_MIN } from '@/core/reflow';
import { durationLabel } from '@/core/travel';
import { SpotSearch } from '@/features/bucket';
import type { LngLat } from '@/features/map';
import { MemberAvatar } from '@/features/members';
import type { ItineraryItem } from '@/services/data';
import type { SpotResult } from '@/services/places';
import { colors, continuous, radii, spacing, typography } from '@/theme';
import { Button, IconButton, ListRow, Text } from '@/ui';

import type { GoingMember } from '../itinerary';
import { MINUTE_STEP, SheetError } from './TimeSheet';

/** The duration stepper moves in quarter hours, from 15 minutes to 12 hours. */
const DURATION_STEP = 15;
const DURATION_MAX = 12 * 60;

export interface ItemDetailsProps {
  item: ItineraryItem;
  /** The item's place as it is now, if any. */
  placeName: string | null;
  /** A booking sets its time and duration: they show but can't change here. */
  booked: boolean;
  /** The trip's city, for the place search. */
  near: LngLat | null;
  error: string | null;
  saving: boolean;
  /** `spot`: a newly picked place for the item. */
  onSave: (next: ItineraryItem, spot: SpotResult | null) => void;
  /** Group trips (TR-60): who added it ("Willem", "you"); null hides the line. */
  addedBy?: string | null;
  /** Group trips: each member and whether they're going; empty hides the Going section. */
  going?: GoingMember[];
  /** Your I'm going switch, saved as soon as it's flipped. */
  onGoingChange?: (going: boolean) => void;
}

/**
 * An item's detail sheet: title, place, time, duration and notes. On a group trip, also who added
 * it and who is going, with your own I'm going switch (TR-60).
 */
export function ItemDetails({
  item,
  placeName,
  booked,
  near,
  error,
  saving,
  onSave,
  addedBy = null,
  going = [],
  onGoingChange,
}: ItemDetailsProps) {
  const [title, setTitle] = useState(item.title ?? '');
  const [time, setTime] = useState(item.startTime);
  const [duration, setDuration] = useState(item.durationMinutes ?? DEFAULT_DURATION_MIN);
  const [notes, setNotes] = useState(item.notes ?? '');
  const [spot, setSpot] = useState<SpotResult | null>(null);
  const [searching, setSearching] = useState(false);

  if (searching) {
    return (
      <SpotSearch
        near={near}
        saving={saving}
        onPick={(picked) => {
          setSpot(picked);
          setSearching(false);
        }}
      />
    );
  }

  const save = () =>
    onSave(
      {
        ...item,
        title: title.trim() || undefined,
        startTime: time,
        durationMinutes: booked ? item.durationMinutes : duration,
        notes: notes.trim() || null,
      },
      spot,
    );
  const step = (by: number) =>
    setDuration((d) => Math.min(Math.max(d + by, DURATION_STEP), DURATION_MAX));
  const shownPlace = spot?.name ?? placeName;

  return (
    <View style={styles.wrap}>
      <Field label="Title">
        <BottomSheetTextInput
          value={title}
          onChangeText={setTitle}
          placeholder={shownPlace ?? 'Untitled stop'}
          placeholderTextColor={colors.textSecondary}
          selectionColor={colors.accent}
          keyboardAppearance="dark"
          returnKeyType="done"
          accessibilityLabel="Title"
          style={styles.input}
          testID="detail-title"
        />
        {addedBy ? (
          <Text variant="subhead" tone="secondary" testID="detail-added-by">
            {`Added by ${addedBy}`}
          </Text>
        ) : null}
      </Field>
      <View style={styles.group}>
        <ListRow
          icon="mappin"
          title={shownPlace ?? 'No place'}
          value="Change"
          valueTone="accent"
          onPress={() => setSearching(true)}
          separator
          testID="detail-place"
        />
        <View style={styles.line}>
          <Text variant="body">Time</Text>
          {booked ? (
            <Text variant="body" tone="secondary">
              From your booking
            </Text>
          ) : (
            <DateTimePicker
              value={timeAsDate(time ?? '12:00')}
              mode="time"
              display="compact"
              minuteInterval={MINUTE_STEP}
              themeVariant="dark"
              accentColor={colors.accent}
              onChange={(_event, date) => {
                if (date) setTime(timeOfDate(date));
              }}
              accessibilityLabel="Time"
              testID="detail-time"
            />
          )}
        </View>
        <View style={[styles.line, styles.separator]}>
          <Text variant="body">Duration</Text>
          {booked ? (
            <Text variant="body" tone="secondary">
              {item.durationMinutes ? durationLabel(item.durationMinutes) : 'From your booking'}
            </Text>
          ) : (
            <View style={styles.stepper}>
              <IconButton
                icon="minus"
                label="Shorter"
                size="sm"
                onPress={() => step(-DURATION_STEP)}
                testID="detail-shorter"
              />
              <Text variant="body" style={styles.duration} testID="detail-duration">
                {durationLabel(duration)}
              </Text>
              <IconButton
                icon="plus"
                label="Longer"
                size="sm"
                onPress={() => step(DURATION_STEP)}
                testID="detail-longer"
              />
            </View>
          )}
        </View>
      </View>
      {going.length > 0 ? (
        <Field label="Going">
          <View style={styles.group} testID="detail-going">
            {going.map((member, i) => (
              <GoingRow
                key={member.id}
                member={member}
                separator={i > 0}
                onChange={onGoingChange}
              />
            ))}
          </View>
        </Field>
      ) : null}
      <Field label="Notes">
        <BottomSheetTextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Reservation name, what to order…"
          placeholderTextColor={colors.textSecondary}
          selectionColor={colors.accent}
          keyboardAppearance="dark"
          multiline
          accessibilityLabel="Notes"
          style={[styles.input, styles.notes]}
          testID="detail-notes"
        />
      </Field>
      <SheetError message={error} />
      <Button label="Save" onPress={save} disabled={saving} testID="detail-save" />
    </View>
  );
}

/** A member and their status; your own row is the I'm going switch. */
function GoingRow({
  member,
  separator,
  onChange,
}: {
  member: GoingMember;
  separator: boolean;
  onChange?: (going: boolean) => void;
}) {
  return (
    <View
      style={[styles.line, styles.member, separator && styles.separator]}
      testID={`detail-going-row-${member.id}`}
    >
      <MemberAvatar member={member} size={28} onRaised />
      <Text variant="body" style={styles.memberName}>
        {member.isMe ? "I'm going" : member.name}
      </Text>
      {member.isMe ? (
        <Switch
          value={member.going}
          onValueChange={onChange}
          trackColor={{ true: colors.accent }}
          accessibilityLabel="I'm going"
          testID="detail-going-switch"
        />
      ) : (
        <Text variant="body" tone="secondary" testID={`detail-going-status-${member.id}`}>
          {member.going ? 'Going' : 'Out'}
        </Text>
      )}
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text variant="subhead" tone="secondary">
        {label}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  field: { gap: spacing.xs },
  input: {
    ...typography.body,
    // No fixed line height in a TextInput: iOS clips the caret.
    lineHeight: undefined,
    height: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radii.card,
    ...continuous,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    color: colors.textPrimary,
  },
  notes: { height: 88, paddingTop: spacing.md, textAlignVertical: 'top' },
  group: {
    borderRadius: radii.card,
    ...continuous,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  line: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  member: { justifyContent: 'flex-start', gap: spacing.md },
  memberName: { flex: 1 },
  separator: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  duration: { minWidth: 72, textAlign: 'center' },
});
