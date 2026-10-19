import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

import {
  convergingCamera,
  planeProgress,
  type FlightEnd,
  type GeoPoint,
  type TravelerLeg,
} from '@/core/flights';
import { mapColors } from '@/theme';
import { Icon, Text, useReduceMotion } from '@/ui';

import { latLng } from '../bounds';
import { MarkerBox } from '../MarkerBox';
import type { LngLat } from '../types';
import { along, greatCircle } from './geo';
import { GlobeDot } from './GlobeDot';
import { flight } from './sample';

/** A flight's two airports, drawn as an arc on the globe. */
export interface GlobeRoute {
  from: FlightEnd;
  to: FlightEnd;
}

/** Another traveller's leg into or out of the trip's city, labelled with their initial (TR-63). */
export interface TravelerArc extends TravelerLeg {
  name: string;
  initial: string;
}

export interface AppleGlobeProps {
  /**
   * Your flight, drawn full weight with the plane; the TR-5 spike's sample (TPA → LAS) when left
   * out, none when null.
   */
  route?: GlobeRoute | null;
  /** Who flies `route`, so highlighting them highlights it. */
  routeTraveler?: string;
  /** The other travellers' legs that day: thinner arcs ending at the destination. */
  others?: readonly TravelerArc[];
  /** A traveller to highlight: their arc stays, the others dim, the camera frames it. */
  focus?: string | null;
  onReady?: () => void;
  testID?: string;
}

/** Plane updates per second while it flies. */
const PLANE_FPS = 30;
/** The plane's box: centred on its point on the arc, so no offset is needed. */
const PLANE = 32;

/** How long the camera takes to frame a highlighted arc. */
const FOCUS_MS = 800;
/** The initial's circle at a traveller's home end. */
const INITIAL = 22;

const NONE: readonly TravelerArc[] = [];

const ends = (legs: readonly { from: GeoPoint; to: GeoPoint }[]) =>
  legs.flatMap((l) => [l.from, l.to]);

/**
 * Apple Maps' own globe (satellite flyover zoomed out, ADR 0002) with a flight's orange
 * great-circle arc, a dot and city label at each airport, and a white plane flying the arc
 * (still at the midpoint with Reduce Motion on). Drag to turn it; the camera opens framed on the
 * route. The Plan tab's flight globe (TR-23); the Trips globe (TR-16) is `TripsGlobe`.
 *
 * On a group trip (TR-63) the other travellers' legs that day converge on the destination too:
 * thinner, lighter orange arcs with each traveller's initial at their home end. The camera frames
 * every airport; a focused traveller's arc stays bright while the rest dim, and the camera flies
 * to it.
 */
export function AppleGlobe({
  route = flight,
  routeTraveler,
  others = NONE,
  focus = null,
  onReady,
  testID = 'apple-globe',
}: AppleGlobeProps) {
  // Every airport; with a focus, just that traveller's arcs (everyone's when they have none).
  const camera = useMemo(() => {
    const mine = route && (focus === null || focus === routeTraveler) ? [route] : [];
    const theirs = others.filter((o) => focus === null || o.travelerId === focus);
    const legs =
      mine.length + theirs.length > 0 ? [...mine, ...theirs] : route ? [route, ...others] : others;
    return convergingCamera(ends(legs));
  }, [route, routeTraveler, others, focus]);
  const destinations = useMemo(() => {
    // Your flight's two airports, else the other legs' end in the trip's city.
    const list = route
      ? [route.from, route.to]
      : others.map((o) => (o.direction === 'arrival' ? o.to : o.from));
    return list.filter((e, i) => list.findIndex((x) => x.code === e.code) === i);
  }, [route, others]);

  // The globe opens framed on `camera`; a new focus (or none) flies there.
  const map = useRef<MapView>(null);
  const framed = useRef(camera);
  useEffect(() => {
    if (framed.current === camera) return;
    framed.current = camera;
    map.current?.animateCamera(
      { center: latLng(camera.center), altitude: camera.altitude, pitch: 0, heading: 0 },
      { duration: FOCUS_MS },
    );
  }, [camera]);

  const lit = (travelerId: string | undefined) => focus === null || focus === travelerId;

  return (
    <MapView
      ref={map}
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
      {others.map((leg) => (
        <OtherArc
          key={leg.bookingId}
          leg={leg}
          focused={focus === leg.travelerId}
          lit={lit(leg.travelerId)}
        />
      ))}
      {route ? <OwnArc route={route} lit={lit(routeTraveler)} /> : null}
      {destinations.map((end) => (
        <GlobeDot
          key={end.code}
          testID={`globe-end-${end.code}`}
          coordinate={end}
          label={end.city}
          accessibilityLabel={`${end.city} (${end.code})`}
        />
      ))}
    </MapView>
  );
}

/** Your flight: the full-weight orange arc and the plane flying it. */
function OwnArc({ route, lit }: { route: GlobeRoute; lit: boolean }) {
  const { from, to } = route;
  const arc = useMemo(() => greatCircle(from, to), [from, to]);
  const coords = useMemo(() => arc.map(latLng), [arc]);
  return (
    <>
      <Polyline
        testID="globe-arc"
        coordinates={coords}
        strokeColor={lit ? mapColors.route : mapColors.routeDim}
        strokeWidth={3}
      />
      <Plane arc={arc} />
    </>
  );
}

/** Another traveller's leg: a thinner, lighter arc and their initial at their home end. */
function OtherArc({ leg, focused, lit }: { leg: TravelerArc; focused: boolean; lit: boolean }) {
  const { from, to, travelerId } = leg;
  const coords = useMemo(() => greatCircle(from, to).map(latLng), [from, to]);
  const home = leg.direction === 'arrival' ? from : to;
  return (
    <>
      <Polyline
        testID={`globe-arc-${travelerId}`}
        coordinates={coords}
        strokeColor={focused ? mapColors.route : lit ? mapColors.routeOther : mapColors.routeDim}
        strokeWidth={focused ? 3 : 2}
      />
      <Marker
        testID={`globe-initial-${travelerId}`}
        coordinate={latLng(home)}
        anchor={{ x: 0.5, y: 0.5 }}
        accessibilityLabel={`${leg.name}, ${leg.direction === 'arrival' ? 'from' : 'to'} ${home.city}`}
      >
        <MarkerBox
          width={INITIAL}
          height={INITIAL}
          style={lit ? styles.initial : { ...styles.initial, ...styles.dim }}
        >
          <Text variant="caption" style={styles.initialText}>
            {leg.initial}
          </Text>
        </MarkerBox>
      </Marker>
    </>
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
      <MarkerBox width={PLANE} height={PLANE} style={styles.plane}>
        <View style={{ transform: [{ rotate: `${heading - 90}deg` }] }}>
          <Icon name="airplane" size="lg" />
        </View>
      </MarkerBox>
    </Marker>
  );
}

const styles = StyleSheet.create({
  plane: { alignItems: 'center', justifyContent: 'center' },
  initial: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: INITIAL / 2,
    backgroundColor: mapColors.globeLabelFill,
    borderWidth: 1.5,
    borderColor: mapColors.routeOther,
  },
  dim: { opacity: 0.4 },
  initialText: { fontWeight: '700' },
});
