import { Pressable, StyleSheet, View } from 'react-native';

import { dayLabel } from '@/core/dates';
import {
  formatTemperature,
  weatherLabel,
  weatherSymbol,
  type DailyWeather,
  type TemperatureUnit,
} from '@/core/weather';
import { screenPadding, spacing } from '@/theme';
import { Icon, IconButton, Text } from '@/ui';

export interface DayHeaderProps {
  day: string;
  weather: DailyWeather | undefined;
  unit: TemperatureUnit;
  /** Shows the Add button (a stop on this day). */
  onAdd?: () => void;
  /** Shows Edit / Done: Edit puts drag handles on the rows (reorder). */
  onToggleReorder?: () => void;
  reordering?: boolean;
}

/** "Fri, Nov 13" over the itinerary, with the day's weather, high and low when there is a forecast. */
export function DayHeader({
  day,
  weather,
  unit,
  onAdd,
  onToggleReorder,
  reordering = false,
}: DayHeaderProps) {
  return (
    <View style={styles.row} testID="day-header">
      <Text variant="title" accessibilityRole="header" testID="day-header-title">
        {dayLabel(day)}
      </Text>
      <View style={styles.trailing}>
        {weather ? (
          <View
            style={styles.weather}
            accessible
            accessibilityLabel={`${weatherLabel(weather.code)}, high ${formatTemperature(weather.highC, unit)}, low ${formatTemperature(weather.lowC, unit)}`}
            testID="day-header-weather"
          >
            <Icon name={weatherSymbol(weather.code)} size="md" />
            <Text variant="headline">{formatTemperature(weather.highC, unit)}</Text>
            <Text variant="headline" tone="secondary">
              {formatTemperature(weather.lowC, unit)}
            </Text>
          </View>
        ) : null}
        {onToggleReorder ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={reordering ? 'Done reordering' : 'Reorder stops'}
            hitSlop={spacing.sm}
            onPress={onToggleReorder}
            style={({ pressed }) => pressed && styles.pressed}
            testID="day-header-reorder"
          >
            <Text variant="headline" tone="accent">
              {reordering ? 'Done' : 'Edit'}
            </Text>
          </Pressable>
        ) : null}
        {onAdd ? (
          <IconButton
            icon="plus"
            label="Add a stop"
            variant="filled"
            size="sm"
            onPress={onAdd}
            testID="day-header-add"
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: screenPadding,
    paddingVertical: spacing.md,
  },
  trailing: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  weather: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  pressed: { opacity: 0.6 },
});
