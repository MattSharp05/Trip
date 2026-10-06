import { Pressable, StyleSheet, View } from 'react-native';

import { mapColors, spacing } from '@/theme';
import { Icon, Text } from '@/ui';

const SIZE = 36;

interface MapControlsProps {
  is3D: boolean;
  onToggle3D: () => void;
  onFitDay: () => void;
  top: number;
}

/** The round buttons at the map's top right, as in the reference mockup: 3D and fit the day. */
export function MapControls({ is3D, onToggle3D, onFitDay, top }: MapControlsProps) {
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
