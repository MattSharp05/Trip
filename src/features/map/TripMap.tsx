import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Polyline } from 'react-native-maps';

import { mapColors, spacing } from '@/theme';

import { latLng, regionFor } from './bounds';
import { MapControls } from './MapControls';
import { PinMarker } from './PinMarker';
import type { TripMapProps } from './types';

/** How long flyTo takes (the ticket asks for about half a second). */
export const FLY_MS = 500;
const TILT = 60;
/** Camera height after flyTo, in metres: a few blocks around the pin. */
const FLY_ALTITUDE = 1500;
const FLY_ALTITUDE_3D = 900;
/** Room around framed pins: pin radius and label, plus the controls column on the right. */
const EDGE = { top: 56, right: 64, bottom: 48, left: 40 };

/**
 * The trip map (ADR 0002): Apple Maps in its dark appearance with photo pins, the day's route as a
 * dashed orange line, other days' places as grey dots, and the 3D and fit-the-day buttons.
 */
export function TripMap({
  pins,
  routeIds,
  selectedId,
  dimmedIds,
  fitIds,
  onPinPress,
  ref,
  testID = 'trip-map',
}: TripMapProps) {
  const map = useRef<MapView>(null);
  const tilted = useRef(false);
  const [is3D, setIs3D] = useState(false);

  const pinById = useMemo(() => new Map(pins.map((p) => [p.id, p])), [pins]);
  const dimmed = useMemo(() => new Set(dimmedIds), [dimmedIds]);
  const route = useMemo(
    () => routeIds.flatMap((id) => pinById.get(id)?.coordinate ?? []).map(latLng),
    [routeIds, pinById],
  );
  const frameIds = useMemo(
    () => fitIds ?? (routeIds.length ? routeIds : pins.map((p) => p.id)),
    [fitIds, routeIds, pins],
  );

  const flyTo = useCallback(
    (id: string) => {
      const pin = pinById.get(id);
      if (!pin) return;
      map.current?.animateCamera(
        {
          center: latLng(pin.coordinate),
          pitch: tilted.current ? TILT : 0,
          altitude: tilted.current ? FLY_ALTITUDE_3D : FLY_ALTITUDE,
        },
        { duration: FLY_MS },
      );
    },
    [pinById],
  );

  const fitTo = useCallback(
    (ids: string[]) => {
      const known = [...new Set(ids)].filter((id) => pinById.has(id));
      if (known.length === 0) return;
      if (known.length === 1) return flyTo(known[0]);
      map.current?.fitToCoordinates(
        known.map((id) => latLng(pinById.get(id)!.coordinate)),
        { edgePadding: EDGE, animated: true },
      );
    },
    [pinById, flyTo],
  );

  useImperativeHandle(ref, () => ({ fitTo, flyTo }), [fitTo, flyTo]);

  // The first frame comes from initialRegion; afterwards a new day (or new pins) re-frames.
  const [initialRegion] = useState(
    () => regionFor(frameIds.flatMap((id) => pinById.get(id)?.coordinate ?? [])) ?? undefined,
  );
  const frameKey = frameIds.join();
  const framed = useRef(frameKey);
  useEffect(() => {
    if (framed.current === frameKey) return;
    framed.current = frameKey;
    fitTo(frameIds);
  }, [frameKey, frameIds, fitTo]);

  const toggle3D = () => {
    tilted.current = !tilted.current;
    setIs3D(tilted.current);
    map.current?.animateCamera({ pitch: tilted.current ? TILT : 0 }, { duration: FLY_MS });
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={map}
        testID={testID}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        userInterfaceStyle="dark"
        mapType="mutedStandard"
        showsPointsOfInterests={false}
        showsBuildings
        showsCompass={false}
        pitchEnabled
        rotateEnabled
        toolbarEnabled={false}
      >
        {route.length > 1 ? (
          <Polyline
            testID="day-route"
            coordinates={route}
            strokeColor={mapColors.route}
            strokeWidth={3}
            lineDashPattern={[6, 6]}
          />
        ) : null}
        {pins.map((pin) => (
          <PinMarker
            key={pin.id}
            pin={pin}
            selected={pin.id === selectedId}
            dimmed={dimmed.has(pin.id)}
            onPress={onPinPress}
          />
        ))}
      </MapView>
      <MapControls
        top={spacing.md}
        is3D={is3D}
        onToggle3D={toggle3D}
        onFitDay={() => fitTo(frameIds)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
});
