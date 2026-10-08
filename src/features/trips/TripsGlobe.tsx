import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView from 'react-native-maps';

import { latLng } from '@/features/map';
import { GlobeDot, startCenter, useGlobeSpin } from '@/features/map/globe';
import type { Trip } from '@/services/data';
import { mapColors } from '@/theme';
import { useReduceMotion } from '@/ui';

export const GLOBE_HEIGHT = 200;
/** Camera height in metres: high enough that the whole Earth fits the 200 pt band. */
const ALTITUDE = 24_000_000;

type PlacedTrip = Trip & { lat: number; lng: number };

interface TripsGlobeProps {
  /** The trips the list below shows, soonest first; the globe opens on the first one. */
  trips: readonly Trip[];
  onOpen: (trip: Trip) => void;
}

/**
 * The globe at the top of Trips (TR-16): Apple's satellite flyover globe (ADR 0002) with an orange
 * dot and city label per trip. It turns slowly on its own (not with Reduce Motion on, and only
 * while Trips is on screen), stops under a finger and can be dragged round. Tapping a dot opens
 * that trip's plan.
 */
export function TripsGlobe({ trips, onOpen }: TripsGlobeProps) {
  const map = useRef<MapView>(null);
  const placed = useMemo(
    () => trips.filter((t): t is PlacedTrip => t.lat !== null && t.lng !== null),
    [trips],
  );
  // The first frame only: later filter changes keep the globe where the user left it.
  const [start] = useState(() => startCenter(placed[0]));
  const [ready, setReady] = useState(false);
  const [focused, setFocused] = useState(false);
  const reduceMotion = useReduceMotion();

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  const spinning = ready && focused && reduceMotion === false;
  const { touchHandlers } = useGlobeSpin(map, start, spinning);

  return (
    <View
      style={styles.band}
      testID="trips-globe"
      accessibilityLabel="Globe of your trips"
      {...touchHandlers}
    >
      <MapView
        ref={map}
        testID="trips-globe-map"
        style={StyleSheet.absoluteFill}
        mapType="hybridFlyover"
        userInterfaceStyle="dark"
        showsPointsOfInterests={false}
        showsCompass={false}
        showsScale={false}
        pitchEnabled={false}
        rotateEnabled={false}
        toolbarEnabled={false}
        initialCamera={{
          center: latLng(start),
          pitch: 0,
          heading: 0,
          altitude: ALTITUDE,
        }}
        onMapReady={() => setReady(true)}
      >
        {placed.map((trip) => (
          <TripDot key={trip.id} trip={trip} onOpen={onOpen} />
        ))}
      </MapView>
    </View>
  );
}

function TripDot({ trip, onOpen }: { trip: PlacedTrip; onOpen: (trip: Trip) => void }) {
  return (
    <GlobeDot
      identifier={trip.id}
      testID={`globe-trip-${trip.id}`}
      coordinate={trip}
      label={trip.city}
      onPress={() => onOpen(trip)}
      accessibilityLabel={`${trip.city}, open the plan`}
    />
  );
}

const styles = StyleSheet.create({
  band: { height: GLOBE_HEIGHT, backgroundColor: mapColors.globeSpace },
});
