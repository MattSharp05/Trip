import { Pressable, StyleSheet, View } from 'react-native';

import { colors, continuous, radii, spacing } from '@/theme';

import { Text } from './Text';

export interface SegmentedProps<T extends string> {
  segments: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  testID?: string;
}

/** A segmented control (Upcoming / Past / All). The selected segment is a lighter grey. */
export function Segmented<T extends string>({
  segments,
  value,
  onChange,
  testID,
}: SegmentedProps<T>) {
  return (
    // Not an accessibility element itself: on iOS a grouped track (or a "tablist" role) hides its
    // segments from VoiceOver and Maestro (TR-42). Each segment is its own tab.
    <View accessible={false} style={styles.track} testID={testID}>
      {segments.map((segment) => {
        const selected = segment.value === value;
        return (
          <Pressable
            key={segment.value}
            accessible
            accessibilityRole="tab"
            accessibilityLabel={segment.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(segment.value)}
            style={[styles.segment, selected && styles.selected]}
          >
            <Text
              variant="subhead"
              tone={selected ? 'primary' : 'secondary'}
              style={selected && styles.selectedLabel}
            >
              {segment.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    padding: spacing.xxs,
    borderRadius: radii.sm + spacing.xxs,
    ...continuous,
    backgroundColor: colors.raised,
  },
  segment: {
    flex: 1,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
    ...continuous,
  },
  selected: { backgroundColor: colors.fill },
  selectedLabel: { fontWeight: '600' },
});
