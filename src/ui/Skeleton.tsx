import { useEffect, useState } from 'react';
import { Animated, StyleSheet, type DimensionValue } from 'react-native';

import { colors, continuous, radii, type RadiusToken } from '@/theme';

import { useReduceMotion } from './useReduceMotion';

export interface SkeletonProps {
  width?: DimensionValue;
  height: number;
  radius?: RadiusToken;
  testID?: string;
}

/** A loading placeholder that gently pulses; it holds still when Reduce Motion is on. */
export function Skeleton({ width = '100%', height, radius = 'sm', testID }: SkeletonProps) {
  const reduceMotion = useReduceMotion();
  const [opacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (reduceMotion !== false) {
      opacity.setValue(1);
      return;
    }
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.45, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [reduceMotion, opacity]);

  return (
    <Animated.View
      accessibilityLabel="Loading"
      testID={testID}
      style={[
        styles.base,
        {
          width,
          height,
          borderRadius: radii[radius],
          opacity: reduceMotion === false ? opacity : 1,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: colors.raised, ...continuous },
});
