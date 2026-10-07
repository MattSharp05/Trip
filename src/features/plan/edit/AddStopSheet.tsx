import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { dayLabel, timeAsDate, timeOfDate } from '@/core/dates';
import { SpotSearch } from '@/features/bucket';
import { pinSymbol, type LngLat } from '@/features/map';
import type { SpotResult } from '@/services/places';
import { colors, continuous, radii, spacing } from '@/theme';
import { Button, ListRow } from '@/ui';

import { MINUTE_STEP, SheetError } from './TimeSheet';

export interface AddStopProps {
  day: string;
  near: LngLat | null;
  /** Where the time wheel starts (after the day's last stop). */
  suggestedTime: string;
  error: string | null;
  saving: boolean;
  onAdd: (spot: SpotResult, time: string) => void;
}

/** "Add a stop": search for a place near the trip, then choose when. */
export function AddStop({ day, near, suggestedTime, error, saving, onAdd }: AddStopProps) {
  const [spot, setSpot] = useState<SpotResult | null>(null);
  const [time, setTime] = useState(suggestedTime);

  if (!spot) return <SpotSearch near={near} saving={saving} onPick={setSpot} />;

  return (
    <View style={styles.wrap}>
      <View style={styles.group}>
        <ListRow
          icon={pinSymbol(spot.kind ?? 'bucket')}
          title={spot.name}
          subtitle={spot.area ?? undefined}
          value="Change"
          valueTone="accent"
          onPress={() => setSpot(null)}
          testID="add-stop-place"
        />
      </View>
      <DateTimePicker
        value={timeAsDate(time)}
        mode="time"
        display="spinner"
        minuteInterval={MINUTE_STEP}
        themeVariant="dark"
        textColor={colors.textPrimary}
        accentColor={colors.accent}
        onChange={(_event, date) => {
          if (date) setTime(timeOfDate(date));
        }}
        accessibilityLabel="Start time"
        testID="add-stop-time"
      />
      <SheetError message={error} />
      <Button
        label={`Add to ${dayLabel(day)}`}
        onPress={() => onAdd(spot, time)}
        disabled={saving}
        testID="add-stop-save"
      />
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
});
