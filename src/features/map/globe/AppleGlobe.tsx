import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

import { planeProgress, routeCamera, type FlightEnd } from '@/core/flights';
import { mapColors, radii, spacing } from '@/theme';
import { Icon, Text, useReduceMotion } from '@/ui';

import { latLng } from '../bounds';
import type { LngLat } from '../types';
import { along, greatCircle } from './geo';
import { flight } from './sample';

/** A flight's two airports, drawn as an arc on the globe. */
export interface GlobeRoute {
  from: FlightEnd;
  to: FlightEnd;
}

export interface AppleGlobeProps {
  /** The flight to draw; the TR-5 spike's sample (TPA → LAS) when left out. */
  route?: GlobeRoute;
  onReady?: () => void;
  testID?: string;
}

const DOT = 12;
const LABEL_WIDTH = 120;
const LABEL_HEIGHT = 20;
/** Plane updates per second while it flies. */
const PLANE_FPS = 30;

/**
 * Apple Maps' own globe (satellite flyover zoomed out, ADR 0002) with a flight's orange
 * great-circle arc, a dot and city label at each airport, and a white plane flying the arc
 * (still at the midpoint with Reduce Motion on). Drag to turn it; the camera opens framed on the
 * route. The Plan tab's flight globe (TR-23); the Trips globe (TR-16) is `TripsGlobe`.
 */
export function AppleGlobe({ route = flight, onReady, testID = 'apple-globe' }: AppleGlobeProps) {
  const { from, to } = route;
  const arc = useMemo(() => greatCircle(from, to), [from, to]);
  const coords = useMemo(() => arc.map(latLng), [arc]);
  const camera = useMemo(() => routeCamera(from, to), [from, to]);

  return (
    <MapView
      testID={testID}
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
        center: latLng(camera.center),
        pitch: 0,
        heading: 0,
        altitude: camera.altitude,
      }}
      onMapReady={onReady}
    >
      <Polyline
        testID="globe-arc"
        coordinates={coords}
        strokeColor={mapColors.route}
        strokeWidth={3}
      />
      {[from, to].map((end) => (
        <Marker
          key={end.code}
          testID={`globe-end-${end.code}`}
          coordinate={latLng(end)}
          // Apple Maps centres the view on the coordinate: shift it so the dot, not the box, sits there.
          centerOffset={{ x: 0, y: (LABEL_HEIGHT + spacing.xs) / 2 }}
          accessibilityLabel={`${end.city} (${end.code})`}
        >
          <View style={styles.box}>
            <View style={styles.dot} />
            <Text variant="caption" numberOfLines={1} style={styles.label}>
              {end.city}
            </Text>
          </View>
        </Marker>
      ))}
      <Plane arc={arc} />
    </MapView>
  );
}

/** The plane, moved from JS. Its own component so only it re-renders while it flies. */
function Plane({ arc }: { arc: LngLat[] }) {
  const reduceMotion = useReduceMotion();
  // Until the setting has been read, and with Reduce Motion on, the plane waits at the midpoint.
  const still = reduceMotion !== false;
  const [flying, setFlying] = useState(0);
  useEffect(() => {
    if (still) return;
    const start = Date.now();
    const id = setInterval(
      () => setFlying(planeProgress(Date.now() - start, false)),
      1000 / PLANE_FPS,
    );
    return () => clearInterval(id);
  }, [still]);

  const t = still ? planeProgress(0, true) : flying;
  const { at, heading } = along(arc, t);
  return (
    <Marker testID="globe-plane" coordinate={latLng(at)} anchor={{ x: 0.5, y: 0.5 }} flat>
      {/* SF Symbols draw the airplane pointing east, so turn it by heading − 90°. */}
      <View style={{ transform: [{ rotate: `${heading - 90}deg` }] }}>
        <Icon name="airplane" size="lg" />
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  box: { width: LABEL_WIDTH, alignItems: 'center', gap: spacing.xs },
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
