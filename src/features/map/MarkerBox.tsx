import type { ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';

import type { MarkerSize } from './markerAnchor';

interface MarkerBoxProps extends MarkerSize {
  children: ReactNode;
  style?: ViewStyle;
  testID?: string;
}

/**
 * The one child of every `Marker` that draws its own view. On iOS, react-native-maps sizes the
 * native marker from its first subview, and React Native's new architecture removes ("flattens")
 * a plain layout-only View. Without this box the marker shrank to its first visible child (a
 * 12 pt dot), the label hung outside it, and `centerOffset` moved the wrong box: dots landed about
 * half a label to the right of their place (TR-23 QA round 2). `collapsable={false}` keeps the box
 * as a real view of exactly `width` × `height`, which `centerOffsetFor` assumes.
 */
export function MarkerBox({ width, height, children, style, testID }: MarkerBoxProps) {
  return (
    <View collapsable={false} testID={testID} style={[{ width, height }, style]}>
      {children}
    </View>
  );
}
