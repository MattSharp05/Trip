import { useImperativeHandle, useRef } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

import { mapColors, spacing } from '@/theme';

import type { SpikeMapProps } from './SpikeMap.types';
import { latLng } from './geo';
import type { SpikePin } from './types';
import { vegasCenter, vegasRoute } from './vegasDay';

const PIN = 40;
const TILT = 60;

/** Option A: Apple Maps through react-native-maps, dark, POIs hidden, photo pins, dashed route. */
export function AppleSpikeMap({ pins, selectedId, onSelect, onReady, ref }: SpikeMapProps) {
  const map = useRef<MapView>(null);
  const pitch = useRef(0);

  useImperativeHandle(ref, () => ({
    flyTo(id) {
      const pin = pins.find((p) => p.id === id);
      if (!pin) return;
      map.current?.animateCamera(
        {
          center: latLng(pin),
          pitch: pitch.current,
          heading: 0,
          altitude: pitch.current ? 900 : 1400,
        },
        { duration: 1200 },
      );
    },
    tilt(on) {
      pitch.current = on ? TILT : 0;
      map.current?.animateCamera(
        { pitch: pitch.current, heading: on ? -20 : 0, altitude: on ? 1800 : 6000 },
        { duration: 800 },
      );
    },
  }));

  return (
    <MapView
      ref={map}
      testID="apple-map"
      style={StyleSheet.absoluteFill}
      userInterfaceStyle="dark"
      mapType="mutedStandard"
      showsPointsOfInterests={false}
      showsBuildings
      showsCompass={false}
      pitchEnabled
      rotateEnabled
      initialCamera={{ center: latLng(vegasCenter), pitch: 0, heading: 0, altitude: 6000 }}
      onMapReady={onReady}
    >
      <Polyline
        coordinates={vegasRoute.map(latLng)}
        strokeColor={mapColors.route}
        strokeWidth={3}
        lineDashPattern={[6, 6]}
      />
      {pins.map((pin) => (
        <PhotoMarker
          key={pin.id}
          pin={pin}
          selected={pin.id === selectedId}
          onPress={() => onSelect(pin.id)}
        />
      ))}
    </MapView>
  );
}

function PhotoMarker({
  pin,
  selected,
  onPress,
}: {
  pin: SpikePin;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Marker
      identifier={pin.id}
      coordinate={{ latitude: pin.lat, longitude: pin.lng }}
      anchor={{ x: 0.5, y: 0.5 }}
      zIndex={selected ? 2 : 1}
      onPress={onPress}
      accessibilityLabel={pin.title}
    >
      <View style={[styles.pin, selected && styles.selected]}>
        <Image source={{ uri: pin.photo }} style={styles.photo} />
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  pin: {
    width: PIN,
    height: PIN,
    borderRadius: PIN / 2,
    borderWidth: 3,
    borderColor: mapColors.pinRing,
    backgroundColor: mapColors.pinFallback,
    overflow: 'hidden',
    margin: spacing.xs,
  },
  selected: { borderColor: mapColors.pinRingSelected, transform: [{ scale: 1.18 }] },
  photo: { width: '100%', height: '100%' },
});
