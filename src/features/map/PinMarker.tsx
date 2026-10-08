import { Image } from 'expo-image';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';

import { mapColors, spacing } from '@/theme';
import { Icon, Text } from '@/ui';

import { latLng } from './bounds';
import { centerOffsetFor, type MarkerPoint, type MarkerSize } from './markerAnchor';
import { MarkerBox } from './MarkerBox';
import { pinStyle, pinSymbol } from './pins';
import type { MapPin } from './types';

const PIN = 40;
const SELECTED = 52;
const DOT = 10;
const RING = 3;
/** The stop's number, on the circle's top-right edge (TR-47). */
const BADGE = 20;
/** Room around the circle for the badge, which sits half outside it. */
const PAD = 6;
/** The selected pin's label sits under the photo inside a fixed box, so the offset is known. */
const LABEL_WIDTH = 160;
const LABEL_HEIGHT = 22;

/** Where everything sits in a pin's box; the circle's centre is the place. */
export interface PinLayout {
  size: MarkerSize;
  /** The circle's (or dot's) centre. */
  anchor: MarkerPoint;
  centerOffset: MarkerPoint;
  /** The circle's diameter. */
  circle: number;
  /** The badge's top-left corner. */
  badge: MarkerPoint;
}

/** The badge's top-left for a circle of `diameter` centred on `anchor`: centred on its 45° edge. */
function badgeAt(anchor: MarkerPoint, diameter: number): MarkerPoint {
  const edge = (diameter / 2) * Math.SQRT1_2;
  return { x: anchor.x + edge - BADGE / 2, y: anchor.y - edge - BADGE / 2 };
}

function layoutFor(size: MarkerSize, anchor: MarkerPoint, circle: number): PinLayout {
  return {
    size,
    anchor,
    centerOffset: centerOffsetFor(size, anchor),
    circle,
    badge: badgeAt(anchor, circle),
  };
}

const side = PIN + 2 * PAD;
const PIN_LAYOUT = layoutFor({ width: side, height: side }, { x: side / 2, y: side / 2 }, PIN);
const SELECTED_LAYOUT = layoutFor(
  { width: LABEL_WIDTH, height: PAD + SELECTED + spacing.xs + LABEL_HEIGHT },
  { x: LABEL_WIDTH / 2, y: PAD + SELECTED / 2 },
  SELECTED,
);
const DOT_LAYOUT = layoutFor({ width: DOT, height: DOT }, { x: DOT / 2, y: DOT / 2 }, DOT);

/** The box, anchor and badge position for a pin, by how it is drawn. */
export function pinLayout(selected: boolean, dot: boolean): PinLayout {
  if (dot) return DOT_LAYOUT;
  return selected ? SELECTED_LAYOUT : PIN_LAYOUT;
}

interface PinMarkerProps {
  pin: MapPin;
  selected: boolean;
  dimmed: boolean;
  onPress?: (id: string) => void;
}

/**
 * One place: a round photo with a white ring, or the kind's symbol on orange, with the stop's
 * number on its edge (TR-47); larger with an orange ring and its time and label when selected; a
 * small grey dot for other days' places; an orange outline with the symbol in orange for a Bucket
 * List place.
 */
export const PinMarker = memo(function PinMarker({
  pin,
  selected,
  dimmed,
  onPress,
}: PinMarkerProps) {
  const style = pinStyle(pin, dimmed && !selected);
  const layout = pinLayout(selected, style === 'dot');
  const size = layout.circle;
  const spoken = [pin.order ? `Stop ${pin.order}` : null, pin.label, pin.time]
    .filter(Boolean)
    .join(', ');

  return (
    <Marker
      identifier={pin.id}
      testID={`pin-${pin.id}`}
      coordinate={latLng(pin.coordinate)}
      centerOffset={layout.centerOffset}
      zIndex={selected ? 3 : style === 'dot' ? 1 : 2}
      onPress={() => onPress?.(pin.id)}
      accessibilityLabel={spoken}
    >
      {style === 'dot' ? (
        <MarkerBox {...layout.size}>
          <View style={styles.dot} testID="pin-dot" />
        </MarkerBox>
      ) : (
        <MarkerBox {...layout.size}>
          <View
            testID={`pin-${style}`}
            style={[
              styles.circle,
              {
                left: layout.anchor.x - size / 2,
                top: layout.anchor.y - size / 2,
                width: size,
                height: size,
                borderRadius: size / 2,
              },
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
          {pin.order ? (
            <View
              testID="pin-order"
              style={[
                styles.badge,
                { left: layout.badge.x, top: layout.badge.y },
                selected && styles.badgeSelected,
              ]}
            >
              <Text variant="caption" style={styles.badgeText}>
                {pin.order}
              </Text>
            </View>
          ) : null}
          {selected ? (
            <View style={[styles.label, { top: PAD + SELECTED + spacing.xs }]}>
              {pin.time ? (
                <Text variant="caption" tone="accent" style={styles.time} testID="pin-time">
                  {pin.time}
                </Text>
              ) : null}
              <Text variant="caption" numberOfLines={1} style={styles.title}>
                {pin.label}
              </Text>
            </View>
          ) : null}
        </MarkerBox>
      )}
    </Marker>
  );
});

const styles = StyleSheet.create({
  circle: {
    position: 'absolute',
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
  photo: { width: '100%', height: '100%' },
  badge: {
    position: 'absolute',
    minWidth: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    paddingHorizontal: spacing.xxs,
    borderWidth: 1.5,
    borderColor: mapColors.pinRing,
    backgroundColor: mapColors.pinBadgeFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeSelected: { backgroundColor: mapColors.pinBadgeFillSelected },
  badgeText: { fontWeight: '700', lineHeight: BADGE - 3 },
  label: {
    position: 'absolute',
    left: 0,
    width: LABEL_WIDTH,
    height: LABEL_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  time: { fontWeight: '700' },
  title: { flexShrink: 1, fontWeight: '600' },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: mapColors.pinDot,
    borderWidth: 1.5,
    borderColor: mapColors.pinDotRing,
  },
});
