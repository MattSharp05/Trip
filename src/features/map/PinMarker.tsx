import { Image } from 'expo-image';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';

import { mapColors, spacing } from '@/theme';
import { Icon, Text } from '@/ui';

import { latLng } from './bounds';
import { labelledDotLayout } from './markerAnchor';
import { MarkerBox } from './MarkerBox';
import { pinStyle, pinSymbol } from './pins';
import type { MapPin } from './types';

const PIN = 40;
const SELECTED = 52;
const DOT = 10;
const RING = 3;
/** The selected pin's label sits under the photo inside a fixed box, so the offset is known. */
const LABEL_WIDTH = 160;
const LABEL_HEIGHT = 22;

/** Each look's box, and the offset that keeps the circle's (or dot's) centre on the place. */
const centred = (side: number) => ({
  size: { width: side, height: side },
  centerOffset: { x: 0, y: 0 },
});
const DOT_LAYOUT = centred(DOT);
const PIN_LAYOUT = centred(PIN);
const SELECTED_LAYOUT = labelledDotLayout({
  width: LABEL_WIDTH,
  dot: SELECTED,
  gap: spacing.xs,
  labelHeight: LABEL_HEIGHT,
});

interface PinMarkerProps {
  pin: MapPin;
  selected: boolean;
  dimmed: boolean;
  onPress?: (id: string) => void;
}

/**
 * One place: a round photo with a white ring, or the kind's symbol on orange; larger with an
 * orange ring and its label when selected; a small grey dot for other days' places; an orange
 * outline with the symbol in orange for a Bucket List place.
 */
export const PinMarker = memo(function PinMarker({
  pin,
  selected,
  dimmed,
  onPress,
}: PinMarkerProps) {
  const style = pinStyle(pin, dimmed && !selected);
  const size = selected ? SELECTED : PIN;
  const layout = style === 'dot' ? DOT_LAYOUT : selected ? SELECTED_LAYOUT : PIN_LAYOUT;

  return (
    <Marker
      identifier={pin.id}
      testID={`pin-${pin.id}`}
      coordinate={latLng(pin.coordinate)}
      centerOffset={layout.centerOffset}
      zIndex={selected ? 3 : style === 'dot' ? 1 : 2}
      onPress={() => onPress?.(pin.id)}
      accessibilityLabel={pin.label}
    >
      {style === 'dot' ? (
        <MarkerBox {...layout.size}>
          <View style={styles.dot} testID="pin-dot" />
        </MarkerBox>
      ) : (
        <MarkerBox {...layout.size} style={styles.box}>
          <View
            testID={`pin-${style}`}
            style={[
              styles.circle,
              { width: size, height: size, borderRadius: size / 2 },
              style === 'symbol' && styles.symbol,
              style === 'outline' && styles.outline,
              selected && styles.selected,
            ]}
          >
            {style === 'photo' && pin.photo ? (
              <Image source={{ uri: pin.photo }} style={styles.photo} recyclingKey={pin.id} />
            ) : (
              <Icon
                name={pinSymbol(pin.kind)}
                size={selected ? 'lg' : 'md'}
                tone={style === 'outline' ? 'accent' : 'onAccent'}
              />
            )}
          </View>
          {selected ? (
            <Text variant="caption" numberOfLines={1} style={styles.label}>
              {pin.label}
            </Text>
          ) : null}
        </MarkerBox>
      )}
    </Marker>
  );
});

const styles = StyleSheet.create({
  circle: {
    borderWidth: RING,
    borderColor: mapColors.pinRing,
    backgroundColor: mapColors.pinFallback,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbol: { backgroundColor: mapColors.pinSymbolFill },
  outline: { backgroundColor: mapColors.pinOutlineFill, borderColor: mapColors.pinOutlineRing },
  selected: { borderColor: mapColors.pinRingSelected },
  box: { alignItems: 'center', gap: spacing.xs },
  photo: { width: '100%', height: '100%' },
  label: { height: LABEL_HEIGHT, maxWidth: LABEL_WIDTH, textAlign: 'center', fontWeight: '600' },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: mapColors.pinDot,
    borderWidth: 1.5,
    borderColor: mapColors.pinDotRing,
  },
});
