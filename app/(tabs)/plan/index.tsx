import { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tripDays } from '@/core/dates';
import { tabTitle } from '@/core/tabs';
import { temperatureUnitForLocale } from '@/core/weather';
import { TripDayMap, type TripMapHandle } from '@/features/map';
import { DatePills, DayHeader, PlanHeader } from '@/features/plan';
import { useTripData } from '@/services/data';
import { useTripForecast } from '@/services/weather';
import { useTripSelection } from '@/stores/selection';
import { useTripStore } from '@/stores/trip';
import { colors, screenPadding, spacing } from '@/theme';
import { PlaceholderScreen, Skeleton } from '@/ui';

/** Share of the screen the map takes, under the date pills (PRD → Plan). */
const MAP_SHARE = 0.45;

/** Until Settings has a units preference, temperatures follow the phone's region. */
const UNIT = temperatureUnitForLocale(Intl.DateTimeFormat().resolvedOptions().locale);

export default function PlanScreen() {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const tripId = useTripStore((s) => s.selectedTripId);
  const trip = useTripData(tripId);
  const info = trip.data?.trip;
  const { selectedDay, selectDay } = useTripSelection(info);
  const forecast = useTripForecast(info);
  const days = useMemo(() => (info ? tripDays(info.startDate, info.endDate) : []), [info]);
  const map = useRef<TripMapHandle>(null);
  // The selected pin belongs to the day it was picked on.
  const [pin, setPin] = useState<{ day: string | null; id: string } | null>(null);
  const selectedPin = pin && pin.day === selectedDay ? pin.id : null;
  // Stable, so pins that didn't change skip re-rendering.
  const select = useCallback(
    (id: string) => {
      setPin({ day: selectedDay, id });
      map.current?.flyTo(id);
    },
    [selectedDay],
  );

  if (!tripId) return <PlaceholderScreen title={tabTitle('plan')} />;

  const weather = forecast.data ?? {};

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {info ? (
        <PlanHeader trip={info} />
      ) : (
        <View style={styles.headerLoading}>
          <Skeleton width={160} height={36} testID="plan-header-loading" />
        </View>
      )}
      <View style={styles.pills}>
        {info ? (
          <DatePills
            days={days}
            selectedDay={selectedDay}
            forecast={weather}
            unit={UNIT}
            onSelect={selectDay}
          />
        ) : (
          <View style={styles.pillsLoading}>
            <Skeleton height={58} radius="card" testID="pills-loading" />
          </View>
        )}
      </View>
      <View style={{ height: height * MAP_SHARE }}>
        {trip.data && selectedDay ? (
          <TripDayMap
            ref={map}
            data={trip.data}
            focusDay={selectedDay}
            selectedId={selectedPin}
            onPinPress={select}
          />
        ) : (
          <Skeleton height={height * MAP_SHARE} radius="sm" testID="map-loading" />
        )}
      </View>
      {selectedDay ? (
        <DayHeader day={selectedDay} weather={weather[selectedDay]} unit={UNIT} />
      ) : null}
      {/* TR-17: the itinerary sheet for the selected day goes here. */}
      <View style={styles.itinerary} testID="itinerary-slot" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  headerLoading: { alignItems: 'center', paddingVertical: spacing.xs },
  pills: { paddingBottom: spacing.md },
  pillsLoading: { paddingHorizontal: screenPadding },
  itinerary: { flex: 1 },
});
