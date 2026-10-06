import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

import { mapColors } from '@/theme';
import { Icon } from '@/ui';

import { along, greatCircle } from './geo';
import { flight } from './vegasDay';

/**
 * Apple Maps' own globe (satellite flyover zoomed out) with the same arc and a plane moved from JS,
 * for comparison with the MapLibre globe.
 */
export function AppleGlobe({ onReady }: { onReady: () => void }) {
  const arc = useMemo(() => greatCircle(flight.from, flight.to), []);
  const coords = useMemo(() => arc.map((p) => ({ latitude: p.lat, longitude: p.lng })), [arc]);
  const [t, setT] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => setT(((Date.now() - start) % 8000) / 7000), 33);
    return () => clearInterval(id);
  }, []);

  const { at, heading } = along(arc, Math.min(t, 1));
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
          coordinate={{ latitude: end.lat, longitude: end.lng }}
          anchor={{ x: 0.5, y: 0.5 }}
          title={end.city}
        >
          <View style={styles.dot} />
        </Marker>
      ))}
      <Marker coordinate={{ latitude: at.lat, longitude: at.lng }} anchor={{ x: 0.5, y: 0.5 }} flat>
        <View style={{ transform: [{ rotate: `${heading - 90}deg` }] }}>
          {/* SF Symbols draw the airplane pointing east, so turn it by heading − 90°. */}
          <Icon name="airplane" size="lg" />
        </View>
      </Marker>
    </MapView>
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
