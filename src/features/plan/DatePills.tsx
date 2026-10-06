import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { dayLabelLong, dayOfMonth, weekdayShort } from '@/core/dates';
import {
  formatTemperature,
  weatherLabel,
  weatherSymbol,
  type DailyForecast,
  type TemperatureUnit,
} from '@/core/weather';
import { colors, continuous, radii, screenPadding, spacing } from '@/theme';
import { Icon, Text } from '@/ui';

/** Pill size and gap (reference mockup, Plan screens). */
export const PILL_WIDTH = 54;
const PILL_GAP = spacing.sm;

export interface DatePillsProps {
  /** The trip's days, `YYYY-MM-DD`, in order. */
  days: string[];
  selectedDay: string | null;
  forecast: DailyForecast;
  unit: TemperatureUnit;
  onSelect: (day: string) => void;
}

/** Scroll offset that centres pill `index` in a row `viewport` points wide (clamped at the start). */
export function pillOffset(index: number, viewport: number): number {
  const centre = screenPadding + index * (PILL_WIDTH + PILL_GAP) + PILL_WIDTH / 2;
  return Math.max(0, centre - viewport / 2);
}

/** The trip's days as a row of pills with each day's weather; the selected one is orange. */
export function DatePills({ days, selectedDay, forecast, unit, onSelect }: DatePillsProps) {
  const scroll = useRef<ScrollView>(null);
  const [viewport, setViewport] = useState(0);
  const scrolledOnce = useRef(false);
  const index = selectedDay ? days.indexOf(selectedDay) : -1;

  // Keep the selected day in view: jump there on first layout, glide on later changes.
  useEffect(() => {
    if (viewport === 0 || index < 0) return;
    scroll.current?.scrollTo({ x: pillOffset(index, viewport), animated: scrolledOnce.current });
    scrolledOnce.current = true;
  }, [index, viewport]);

  return (
    <ScrollView
      ref={scroll}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      onLayout={(e) => setViewport(e.nativeEvent.layout.width)}
      testID="date-pills"
    >
      {days.map((day) => (
        <DatePill
          key={day}
          day={day}
          selected={day === selectedDay}
          forecast={forecast}
          unit={unit}
          onSelect={onSelect}
        />
      ))}
    </ScrollView>
  );
}

interface DatePillProps {
  day: string;
  selected: boolean;
  forecast: DailyForecast;
  unit: TemperatureUnit;
  onSelect: (day: string) => void;
}

function DatePill({ day, selected, forecast, unit, onSelect }: DatePillProps) {
  const weather = forecast[day];
  const tone = selected ? 'onAccent' : 'primary';
  const spoken = weather
    ? `${dayLabelLong(day)}, ${weatherLabel(weather.code)}, high ${formatTemperature(weather.highC, unit)}`
    : dayLabelLong(day);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={spoken}
      accessibilityState={{ selected }}
      onPress={() => onSelect(day)}
      testID={`pill-${day}`}
      style={({ pressed }) => [styles.pill, selected && styles.selected, pressed && styles.pressed]}
    >
      <Text variant="caption" tone={selected ? 'onAccent' : 'secondary'}>
        {weekdayShort(day)}
      </Text>
      <Text variant="headline" tone={tone}>
        {dayOfMonth(day)}
      </Text>
      {weather ? (
        <View style={styles.weather} testID={`pill-weather-${day}`}>
          <Icon name={weatherSymbol(weather.code)} size="sm" tone={tone} />
          <Text variant="caption" tone={tone}>
            {formatTemperature(weather.highC, unit)}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: screenPadding, gap: PILL_GAP },
  pill: {
    width: PILL_WIDTH,
    minHeight: 58,
    paddingVertical: spacing.sm - 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.card,
    ...continuous,
    backgroundColor: colors.raised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  selected: { backgroundColor: colors.accent, borderColor: colors.accent },
  pressed: { opacity: 0.7 },
  weather: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs, marginTop: spacing.xxs },
});
