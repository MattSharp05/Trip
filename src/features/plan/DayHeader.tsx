import { StyleSheet, View } from 'react-native';

import { dayLabel } from '@/core/dates';
import {
  formatTemperature,
  weatherLabel,
  weatherSymbol,
  type DailyWeather,
  type TemperatureUnit,
} from '@/core/weather';
import { screenPadding, spacing } from '@/theme';
import { Icon, Text } from '@/ui';

export interface DayHeaderProps {
  day: string;
  weather: DailyWeather | undefined;
  unit: TemperatureUnit;
}

/** "Fri, Nov 13" over the itinerary, with the day's weather, high and low when there is a forecast. */
export function DayHeader({ day, weather, unit }: DayHeaderProps) {
  return (
    <View style={styles.row} testID="day-header">
      <Text variant="title" accessibilityRole="header" testID="day-header-title">
        {dayLabel(day)}
      </Text>
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
  weather: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
