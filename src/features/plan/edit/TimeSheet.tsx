import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { dayLabel, timeAsDate, timeOfDate } from '@/core/dates';
import { colors, continuous, radii, spacing } from '@/theme';
import { Button, Icon, ListRow, Text } from '@/ui';

/** Times move in five-minute steps. */
export const MINUTE_STEP = 5;

export interface TimePickProps {
  /** The current start, `HH:MM`; null for an item without a time. */
  time: string | null;
  /** Why the last save was refused (e.g. it overlaps a fixed item). */
  error: string | null;
  onSave: (time: string) => void;
}

/** The time picker sheet's content: a wheel and Save. */
export function TimePick({ time, error, onSave }: TimePickProps) {
  const [value, setValue] = useState(time ?? '12:00');
  return (
    <View style={styles.wrap}>
      <DateTimePicker
        value={timeAsDate(value)}
        mode="time"
        display="spinner"
        minuteInterval={MINUTE_STEP}
        themeVariant="dark"
        textColor={colors.textPrimary}
        accentColor={colors.accent}
        onChange={(_event, date) => {
          if (date) setValue(timeOfDate(date));
        }}
        accessibilityLabel="Start time"
        testID="time-picker"
      />
      <SheetError message={error} />
      <Button label="Save" onPress={() => onSave(value)} testID="time-save" />
    </View>
  );
}

export interface DayPickProps {
  days: string[];
  current: string;
  onPick: (day: string) => void;
  error: string | null;
}

/** The "Move to another day" sheet's content: the trip's days, the current one ticked. */
export function DayPick({ days, current, onPick, error }: DayPickProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.group}>
        {days.map((day, i) => (
          <ListRow
            key={day}
            icon={day === current ? 'checkmark.circle.fill' : 'circle'}
            title={dayLabel(day)}
            onPress={day === current ? undefined : () => onPick(day)}
            separator={i < days.length - 1}
            testID={`move-day-${day}`}
          />
        ))}
      </View>
      <SheetError message={error} />
    </View>
  );
}

/** A refused save, said inside the sheet (a toast would sit under it). */
export function SheetError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View style={styles.error} accessibilityLiveRegion="polite" testID="sheet-error">
      <Icon name="exclamationmark.circle" size="sm" tone="accent" />
      <Text variant="subhead" style={styles.errorText}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  group: {
    borderRadius: radii.card,
    ...continuous,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  error: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  errorText: { flex: 1 },
});
