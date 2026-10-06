import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tripDays } from '@/core/dates';
import { tabTitle } from '@/core/tabs';
import { temperatureUnitForLocale } from '@/core/weather';
import { TripDayMap, type TripMapHandle } from '@/features/map';
import {
  BucketListSlot,
  DatePills,
  DayHeader,
  Itinerary,
  itemForPin,
  itineraryEntries,
  PlanHeader,
  PlanSheet,
} from '@/features/plan';
import { useTripData } from '@/services/data';
import { useTripForecast } from '@/services/weather';
import { useTripSelection } from '@/stores/selection';
import { useTripStore } from '@/stores/trip';
import { colors, radii, screenPadding, spacing } from '@/theme';
import { PlaceholderScreen, Skeleton } from '@/ui';

/** Share of the screen the map shows above the half-height sheet (reference mockup, Plan). */
const MAP_SHARE = 0.36;
/** The sheet's rounded top overlaps the map by its corner radius. */
const SHEET_OVERLAP = radii.photo;
/** Header and date pills, until the body under them has been measured. */
const TOP_ESTIMATE = 140;

/** Until Settings has a units preference, temperatures follow the phone's region. */
const UNIT = temperatureUnitForLocale(Intl.DateTimeFormat().resolvedOptions().locale);

export default function PlanScreen() {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const tripId = useTripStore((s) => s.selectedTripId);
  const trip = useTripData(tripId);
  const info = trip.data?.trip;
  const selection = useTripSelection(info);
  const { selectedDay, selectedItemId, selectedBy, picks, selectDay, selectItem } = selection;
  const forecast = useTripForecast(info);
  const days = useMemo(() => (info ? tripDays(info.startDate, info.endDate) : []), [info]);
  const map = useRef<TripMapHandle>(null);

  const entries = useMemo(
    () => (trip.data && selectedDay ? itineraryEntries(trip.data, selectedDay) : undefined),
    [trip.data, selectedDay],
  );
  const selectedPlace = entries?.find((e) => e.id === selectedItemId)?.placeId ?? null;

  // Every pick, from the list or the map, flies the map to the item's place.
  const flown = useRef(picks);
  useEffect(() => {
    if (flown.current === picks) return;
    flown.current = picks;
    if (selectedPlace) map.current?.flyTo(selectedPlace);
  }, [picks, selectedPlace]);

  // Stable, so rows and pins that didn't change skip re-rendering.
  const items = trip.data?.items;
  const pickPin = useCallback(
    (placeId: string) => {
      const target = items && selectedDay ? itemForPin(items, placeId, selectedDay) : null;
      if (target) selectItem(target.itemId, 'map', target.day);
    },
    [items, selectedDay, selectItem],
  );
  const pickRow = useCallback((itemId: string) => selectItem(itemId, 'list'), [selectItem]);

  // The selected pill again re-frames the day (the map re-frames itself on a new day).
  const pickDay = useCallback(
    (day: string) => {
      if (day === selectedDay && entries) {
        map.current?.fitTo(entries.flatMap((e) => e.placeId ?? []));
      }
      selectDay(day);
    },
    [selectedDay, entries, selectDay],
  );

  const [bodyHeight, setBodyHeight] = useState(() => height - insets.top - TOP_ESTIMATE);
  const mapHeight = Math.round(height * MAP_SHARE);
  const sheetHalf = Math.max(bodyHeight - mapHeight + SHEET_OVERLAP, 0);

  if (!tripId) return <PlaceholderScreen title={tabTitle('plan')} />;

  const weather = forecast.data ?? {};
  const bucketCount = trip.data?.bucketItems.length;

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
            onSelect={pickDay}
          />
        ) : (
          <View style={styles.pillsLoading}>
            <Skeleton height={58} radius="card" testID="pills-loading" />
          </View>
        )}
      </View>
      <View style={styles.body} onLayout={(e) => setBodyHeight(e.nativeEvent.layout.height)}>
        <View style={{ height: mapHeight }}>
          {trip.data && selectedDay ? (
            <TripDayMap
              ref={map}
              data={trip.data}
              focusDay={selectedDay}
              selectedId={selectedPlace}
              onPinPress={pickPin}
            />
          ) : (
            <Skeleton height={mapHeight} radius="sm" testID="map-loading" />
          )}
        </View>
        <PlanSheet
          halfHeight={sheetHalf}
          collapseKey={picks}
          mode={selection.planMode}
          onModeChange={selection.setPlanMode}
          bucketCount={bucketCount}
          header={
            selectedDay ? (
              <DayHeader day={selectedDay} weather={weather[selectedDay]} unit={UNIT} />
            ) : (
              <View style={styles.dayLoading}>
                <Skeleton width={140} height={28} />
              </View>
            )
          }
          itinerary={
            <Itinerary
              entries={entries}
              selectedId={selectedItemId}
              revealKey={picks}
              reveal={selectedBy === 'map'}
              onSelect={pickRow}
              onOpenBucketList={() => selection.setPlanMode('bucket')}
              bottomInset={insets.bottom + spacing.xl}
            />
          }
          bucketList={<BucketListSlot count={bucketCount} />}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  headerLoading: { alignItems: 'center', paddingVertical: spacing.xs },
  pills: { paddingBottom: spacing.md },
  pillsLoading: { paddingHorizontal: screenPadding },
  body: { flex: 1 },
  dayLoading: { paddingHorizontal: screenPadding, paddingVertical: spacing.md },
});
