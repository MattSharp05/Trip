import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import MapView from 'react-native-maps';

import { globeAltitude } from '@/core/globe';
import { latLng } from '@/features/map';
import { GlobeDot, startCenter, useGlobeSpin } from '@/features/map/globe';
import type { Trip } from '@/services/data';
import { mapColors } from '@/theme';
import { useReduceMotion } from '@/ui';

/** The globe's height before the screen has measured it. */
export const GLOBE_HEIGHT = 200;

type PlacedTrip = Trip & { lat: number; lng: number };

interface TripsGlobeProps {
  /** The trips the list below shows, soonest first; the globe opens on the first one. */
  trips: readonly Trip[];
  onOpen: (trip: Trip) => void;
  /** The globe's height: the room the trip list's sheet leaves (TR-46). */
  height?: number;
}

/**
 * The globe at the top of Trips (TR-16): Apple's satellite flyover globe (ADR 0002) with an orange
 * dot and city label per trip. It turns slowly on its own (not with Reduce Motion on, and only
 * while Trips is on screen), stops under a finger and can be dragged round. Tapping a dot opens
 * that trip's plan.
 */
export function TripsGlobe({ trips, onOpen, height = GLOBE_HEIGHT }: TripsGlobeProps) {
  const map = useRef<MapView>(null);
  const { width } = useWindowDimensions();
  // The whole Earth fits whatever height the sheet leaves; a new height moves the camera.
  const altitude = globeAltitude({ width, height });
  const [initialAltitude] = useState(altitude);
  const shownAltitude = useRef(altitude);
  useEffect(() => {
    if (shownAltitude.current === altitude) return;
    shownAltitude.current = altitude;
    map.current?.setCamera({ altitude });
  }, [altitude]);
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
      style={[styles.band, { height }]}
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
          altitude: initialAltitude,
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
  band: { backgroundColor: mapColors.globeSpace },
});
