import { StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';

import { mapColors, radii, spacing } from '@/theme';
import { Text } from '@/ui';

import { latLng } from '../bounds';
import { labelledDotLayout } from '../markerAnchor';
import { MarkerBox } from '../MarkerBox';
import type { LngLat } from '../types';

const DOT = 12;
const LABEL_WIDTH = 120;
const LABEL_HEIGHT = 20;

/** The globe dot's box and the offset that puts the dot's centre on its place. */
export const GLOBE_DOT = labelledDotLayout({
  width: LABEL_WIDTH,
  dot: DOT,
  gap: spacing.xs,
  labelHeight: LABEL_HEIGHT,
});

interface GlobeDotProps {
  coordinate: LngLat;
  label: string;
  identifier?: string;
  testID?: string;
  accessibilityLabel?: string;
  onPress?: () => void;
}

/**
 * An orange dot with a dark city-label pill under it, on a globe: a flight's airports (TR-23) and
 * the Trips globe's trips (TR-16). The dot's centre is the place, at every zoom.
 */
export function GlobeDot({
  coordinate,
  label,
  identifier,
  testID,
  accessibilityLabel,
  onPress,
}: GlobeDotProps) {
  return (
    <Marker
      identifier={identifier}
      testID={testID}
      coordinate={latLng(coordinate)}
      centerOffset={GLOBE_DOT.centerOffset}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <MarkerBox {...GLOBE_DOT.size} style={styles.box}>
        <View style={styles.dot} />
        <Text variant="caption" numberOfLines={1} style={styles.label}>
          {label}
        </Text>
      </MarkerBox>
    </Marker>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', gap: spacing.xs },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: mapColors.route,
    borderWidth: 2,
    borderColor: mapColors.pinRing,
  },
  label: {
    height: LABEL_HEIGHT,
    maxWidth: LABEL_WIDTH,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    overflow: 'hidden',
    backgroundColor: mapColors.globeLabelFill,
    fontWeight: '600',
    lineHeight: LABEL_HEIGHT,
  },
});
