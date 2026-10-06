/**
 * Jest stand-in for react-native-maps (native maps don't render under Jest). Jest uses it
 * automatically for every test. Camera calls are recorded in `mapCalls`; markers are touchable
 * views carrying their props, so tests can press pins and read what was drawn.
 */
import { useImperativeHandle, type ReactNode, type Ref } from 'react';
import { View } from 'react-native';

export const mapCalls: { method: string; args: unknown[] }[] = [];

/** What `getCamera()` resolves to; tests set it to stand in for where the user dragged the map. */
export const mapCamera = {
  center: { latitude: 0, longitude: 0 },
  pitch: 0,
  heading: 0,
  altitude: 0,
};

const record =
  (method: string) =>
  (...args: unknown[]) =>
    mapCalls.push({ method, args });

function MapView({
  children,
  testID,
  ref,
  ...props
}: {
  children?: ReactNode;
  testID?: string;
  ref?: Ref<unknown>;
  [prop: string]: unknown;
}) {
  useImperativeHandle(ref, () => ({
    animateCamera: record('animateCamera'),
    animateToRegion: record('animateToRegion'),
    fitToCoordinates: record('fitToCoordinates'),
    setCamera: record('setCamera'),
    getCamera: async () => {
      record('getCamera')();
      return mapCamera;
    },
  }));
  return (
    <View testID={testID} {...props}>
      {children}
    </View>
  );
}

function Marker({
  children,
  onPress,
  ...props
}: {
  children?: ReactNode;
  onPress?: () => void;
  [prop: string]: unknown;
}) {
  return (
    <View accessible onTouchEnd={onPress} {...props}>
      {children}
    </View>
  );
}

function Polyline(props: { testID?: string; [prop: string]: unknown }) {
  return <View {...props} />;
}

export default MapView;
export { Marker, Polyline };
