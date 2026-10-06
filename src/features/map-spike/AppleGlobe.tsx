import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

import { mapColors } from '@/theme';
import { Icon } from '@/ui';

import { along, greatCircle, latLng } from './geo';
import type { LngLat } from './types';
import { flight, planeTiming } from './vegasDay';

/**
 * Apple Maps' own globe (satellite flyover zoomed out) with the same arc and a plane moved from JS,
 * for comparison with the MapLibre globe.
 */
export function AppleGlobe({ onReady }: { onReady: () => void }) {
  const arc = useMemo(() => greatCircle(flight.from, flight.to), []);
  const coords = useMemo(() => arc.map(latLng), [arc]);
  const mid = arc[Math.floor(arc.length / 2)];

  return (
    <MapView
      testID="apple-globe"
      style={StyleSheet.absoluteFill}
      mapType="hybridFlyover"
      userInterfaceStyle="dark"
      showsPointsOfInterests={false}
      showsCompass={false}
      initialCamera={{
        center: { latitude: mid.lat - 4, longitude: mid.lng },
        pitch: 0,
        heading: 0,
        altitude: 14_000_000,
      }}
      onMapReady={onReady}
    >
      <Polyline coordinates={coords} strokeColor={mapColors.route} strokeWidth={3} />
      {[flight.from, flight.to].map((end) => (
        <Marker
          key={end.code}
          coordinate={latLng(end)}
          anchor={{ x: 0.5, y: 0.5 }}
          title={end.city}
        >
          <View style={styles.dot} />
        </Marker>
      ))}
      <Plane arc={arc} />
    </MapView>
  );
}

/** The plane, moved from JS about 30 times a second. Its own component so only it re-renders. */
function Plane({ arc }: { arc: LngLat[] }) {
  const [t, setT] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const id = setInterval(
      () => setT(((Date.now() - start) % planeTiming.loopMs) / planeTiming.flightMs),
      33,
    );
    return () => clearInterval(id);
  }, []);

  const { at, heading } = along(arc, t);
  return (
    <Marker coordinate={latLng(at)} anchor={{ x: 0.5, y: 0.5 }} flat>
      {/* SF Symbols draw the airplane pointing east, so turn it by heading − 90°. */}
      <View style={{ transform: [{ rotate: `${heading - 90}deg` }] }}>
        <Icon name="airplane" size="lg" />
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: mapColors.route,
    borderWidth: 2,
    borderColor: mapColors.pinRing,
  },
});
