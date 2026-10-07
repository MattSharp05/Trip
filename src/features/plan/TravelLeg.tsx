import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import type { DistanceUnit } from '@/core/travel';
import { colors, screenPadding, spacing } from '@/theme';
import { Icon, Text } from '@/ui';

import { legCaption, type ItineraryLeg } from './itinerary';
import { RAIL_WIDTH, TIME_WIDTH } from './ItineraryRow';

/** Height of the line between two rows, so the list can still compute every row's offset. */
export const LEG_HEIGHT = 24;

export interface TravelLegProps {
  leg: ItineraryLeg;
  unit: DistanceUnit;
  testID?: string;
}

/**
 * The estimated trip between two stops, on the timeline's rail: a walk or car symbol and a grey
 * caption, in orange when the trip takes longer than the time between the stops.
 */
export const TravelLeg = memo(function TravelLeg({ leg, unit, testID }: TravelLegProps) {
  const tone = leg.tight ? 'accent' : 'secondary';
  return (
    <View style={styles.leg} testID={testID}>
      <View style={styles.rail}>
        <View style={styles.line} />
      </View>
      <View style={styles.content}>
        <Icon
          name={leg.estimate.mode === 'walk' ? 'figure.walk' : 'car'}
          size="sm"
          tone={tone}
          testID={testID && `${testID}-${leg.estimate.mode}`}
        />
        <Text variant="caption" tone={tone} numberOfLines={1} style={styles.caption}>
          {legCaption(leg, unit)}
        </Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  leg: {
    height: LEG_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: screenPadding + TIME_WIDTH,
    paddingRight: screenPadding,
  },
  rail: { width: RAIL_WIDTH, height: LEG_HEIGHT, alignItems: 'center' },
  line: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth * 2,
    backgroundColor: colors.accent,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingLeft: spacing.sm,
  },
  caption: { flexShrink: 1 },
});
