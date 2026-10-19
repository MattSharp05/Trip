import { Pressable, StyleSheet, View } from 'react-native';

import { mapColors, radii, spacing } from '@/theme';
import { Icon, Text } from '@/ui';

import { AppleGlobe, type GlobeRoute, type TravelerArc } from './AppleGlobe';

const PILL_HEIGHT = 36;

export interface FlightGlobeProps {
  /** Your flight that day; null when only others fly (TR-63). */
  route: GlobeRoute | null;
  /** Who flies `route`. */
  routeTraveler?: string;
  /** The other travellers' legs into and out of the trip's city that day (TR-63). */
  others?: readonly TravelerArc[];
  /** The traveller whose arc is highlighted. */
  focus?: string | null;
  /** The "Map" pill: back to the day's city map. */
  onShowMap: () => void;
}

/**
 * The Plan tab's map area on a travel day (TR-23): the flight on the globe, with a "Map" pill
 * where the map's controls sit to switch back. On a group trip, everyone's legs that day (TR-63).
 */
export function FlightGlobe({ route, routeTraveler, others, focus, onShowMap }: FlightGlobeProps) {
  const label = route
    ? `Flight from ${route.from.city} to ${route.to.city} on the globe`
    : 'Flights on the globe';
  return (
    <View
      style={styles.container}
      testID="flight-globe"
      accessibilityLabel={others?.length ? `${label}, with ${others.length} more` : label}
    >
      <AppleGlobe
        route={route}
        routeTraveler={routeTraveler}
        others={others}
        focus={focus}
        testID="flight-globe-map"
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Map"
        hitSlop={4}
        onPress={onShowMap}
        style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
      >
        <Icon name="map" size="sm" />
        <Text variant="subhead" style={styles.text}>
          Map
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden', backgroundColor: mapColors.globeSpace },
  pill: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    height: PILL_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: mapColors.control,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mapColors.controlBorder,
  },
  pressed: { opacity: 0.6 },
  text: { fontWeight: '600' },
});
