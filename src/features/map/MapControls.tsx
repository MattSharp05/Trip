import { Pressable, StyleSheet, View } from 'react-native';

import { mapColors, spacing } from '@/theme';
import { Icon, Text } from '@/ui';

const SIZE = 36;

interface MapControlsProps {
  is3D: boolean;
  onToggle3D: () => void;
  onFitDay: () => void;
  /** On a travel day: the plane button, which shows the flight on the globe (TR-23). */
  onShowFlight?: () => void;
  top: number;
}

/**
 * The round buttons at the map's top right, as in the reference mockup: 3D, fit the day and, on a
 * travel day, the flight on the globe.
 */
export function MapControls({ is3D, onToggle3D, onFitDay, onShowFlight, top }: MapControlsProps) {
  return (
    <View style={[styles.column, { top }]} pointerEvents="box-none">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="3D"
        accessibilityState={{ selected: is3D }}
        hitSlop={4}
        onPress={onToggle3D}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Text variant="subhead" tone={is3D ? 'accent' : 'primary'} style={styles.text}>
          3D
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Fit the day"
        hitSlop={4}
        onPress={onFitDay}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Icon name="location.viewfinder" />
      </Pressable>
      {onShowFlight ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Show the flight"
          hitSlop={4}
          onPress={onShowFlight}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <Icon name="airplane" />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  column: { position: 'absolute', right: spacing.md, gap: spacing.sm },
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: mapColors.control,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mapColors.controlBorder,
  },
  pressed: { opacity: 0.6 },
  text: { fontWeight: '600' },
});
