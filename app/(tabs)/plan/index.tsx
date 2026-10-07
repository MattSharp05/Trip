import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tripDays } from '@/core/dates';
import { dayFlight } from '@/core/flights';
import { tabTitle } from '@/core/tabs';
import { temperatureUnitForLocale } from '@/core/weather';
import {
  AddPlaceSheet,
  BucketList,
  bucketEntries,
  bucketPins,
  useBucketActions,
  useSmartAdd,
  type BucketEntry,
} from '@/features/bucket';
import { TripDayMap, type TripMapHandle } from '@/features/map';
import { FlightGlobe } from '@/features/map/globe';
import {
  DatePills,
  DayHeader,
  FlightCard,
  Itinerary,
  itemForPin,
  itineraryEntries,
  PlanHeader,
  PlanSheet,
  useItineraryEditor,
} from '@/features/plan';
import { FlightStatusPill } from '@/features/wallet/flight';
import { useTripData } from '@/services/data';
import { useTripForecast } from '@/services/weather';
import { useTripSelection } from '@/stores/selection';
import { useTripStore } from '@/stores/trip';
import { colors, radii, screenPadding, spacing } from '@/theme';
import { PlaceholderScreen, Skeleton, Toast } from '@/ui';

/** Share of the screen the map shows above the half-height sheet (reference mockup, Plan). */
const MAP_SHARE = 0.36;
/** The sheet's rounded top overlaps the map by its corner radius. */
const SHEET_OVERLAP = radii.photo;
/** Header and date pills, until the body under them has been measured. */
const TOP_ESTIMATE = 140;

/** The toast floats above the tab bar (49 pt on iPhone) over the sheet. */
const TOAST_BOTTOM = 49 + spacing.md;

/** Until Settings has a units preference, temperatures follow the phone's region. */
const UNIT = temperatureUnitForLocale(Intl.DateTimeFormat().resolvedOptions().locale);

export default function PlanScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
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

  // A travel day (TR-23): the plane button or the flight's row swaps the map for the globe.
  const flight = useMemo(
    () => (trip.data && selectedDay ? dayFlight(trip.data, selectedDay) : null),
    [trip.data, selectedDay],
  );
  const [globeDay, setGlobeDay] = useState<string | null>(null);
  const showFlight = useCallback(() => setGlobeDay(selectedDay), [selectedDay]);
  const showMap = useCallback(() => setGlobeDay(null), []);

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
  const pickRow = useCallback(
    (itemId: string) => {
      // The flight's row shows it on the globe; any other stop goes back to the map.
      setGlobeDay(flight && itemId === flight.itemId ? selectedDay : null);
      selectItem(itemId, 'list');
    },
    [flight, selectedDay, selectItem],
  );

  // The selected pill again re-frames the day (the map re-frames itself on a new day).
  const pickDay = useCallback(
    (day: string) => {
      if (day === selectedDay && entries) {
        map.current?.fitTo(entries.flatMap((e) => e.placeId ?? []));
      }
      if (day !== selectedDay) setGlobeDay(null);
      selectDay(day);
    },
    [selectedDay, entries, selectDay],
  );

  // Bucket List: its places show on the map as outlined pins while the segment is open.
  const inBucket = selection.planMode === 'bucket';
  const bucket = useMemo(() => (trip.data ? bucketEntries(trip.data) : undefined), [trip.data]);
  const savedPins = useMemo(() => (trip.data ? bucketPins(trip.data) : []), [trip.data]);
  const savedIds = useMemo(() => savedPins.map((p) => p.id), [savedPins]);
  const actions = useBucketActions(tripId, trip.data?.bucketItems);
  const [bucketPick, setBucketPick] = useState<string | null>(null);
  const pickBucketRow = useCallback((entry: BucketEntry) => {
    setBucketPick(entry.placeId);
    map.current?.flyTo(entry.placeId);
  }, []);

  const near =
    info && info.lat !== null && info.lng !== null ? { lat: info.lat, lng: info.lng } : null;
  const editor = useItineraryEditor({ data: trip.data, day: selectedDay, days, near });

  // Smart Add (TR-29): the new stop's day opens with it selected, so the map flies to it.
  const smart = useSmartAdd(tripId, trip.data);
  const { setPlanMode } = selection;
  const { add: placeSmart, dismissToast: dismissSmartToast } = smart;
  const { dismissToast: dismissEditToast } = editor;
  const { dismissToast: dismissBucketToast } = actions;
  const smartAdd = useCallback(
    (entry: BucketEntry) => {
      dismissEditToast();
      dismissBucketToast();
      const placed = placeSmart(entry);
      if (!placed) return;
      setPlanMode('itinerary');
      setGlobeDay(null);
      selectItem(placed.itemId, 'map', placed.day);
    },
    [placeSmart, setPlanMode, selectItem, dismissEditToast, dismissBucketToast],
  );
  // The newest toast wins: an edit or a bucket change replaces Smart Add's.
  useEffect(() => {
    if (editor.toast || actions.toast) dismissSmartToast();
  }, [editor.toast, actions.toast, dismissSmartToast]);
  const toast = smart.toast ?? editor.toast ?? actions.toast;
  const toastUndo = smart.toast ? smart.undo : editor.toast ? editor.undo : actions.undo;
  const toastDismiss = smart.toast
    ? smart.dismissToast
    : editor.toast
      ? editor.dismissToast
      : actions.dismissToast;

  const [bodyHeight, setBodyHeight] = useState(() => height - insets.top - TOP_ESTIMATE);
  const mapHeight = Math.round(height * MAP_SHARE);
  const sheetHalf = Math.max(bodyHeight - mapHeight + SHEET_OVERLAP, 0);

  if (!tripId) return <PlaceholderScreen title={tabTitle('plan')} />;

  const weather = forecast.data ?? {};
  const bucketCount = trip.data?.bucketItems.length;
  const onGlobe = flight !== null && !inBucket && globeDay === selectedDay;
  const dayHeader = selectedDay ? (
    <DayHeader
      day={selectedDay}
      weather={weather[selectedDay]}
      unit={UNIT}
      onAdd={inBucket ? undefined : editor.add}
    />
  ) : (
    <View style={styles.dayLoading}>
      <Skeleton width={140} height={28} />
    </View>
  );

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
          {onGlobe ? (
            <FlightGlobe key={flight.bookingId} route={flight} onShowMap={showMap} />
          ) : trip.data && selectedDay ? (
            <TripDayMap
              ref={map}
              data={trip.data}
              focusDay={selectedDay}
              selectedId={inBucket ? bucketPick : selectedPlace}
              onPinPress={inBucket ? setBucketPick : pickPin}
              extraPins={inBucket ? savedPins : undefined}
              fitIds={inBucket && savedIds.length ? savedIds : undefined}
              onLongPress={inBucket ? actions.dropPin : undefined}
              onShowFlight={flight && !inBucket ? showFlight : undefined}
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
            onGlobe ? (
              <>
                <FlightCard
                  flight={flight.flight}
                  status={<FlightStatusPill flight={flight.flight} />}
                  onPress={() =>
                    router.push(`/organize/flight/${encodeURIComponent(flight.bookingId)}`, {
                      withAnchor: true,
                    })
                  }
                />
                {dayHeader}
              </>
            ) : (
              dayHeader
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
              editing={editor.editing}
            />
          }
          bucketList={
            <BucketList
              entries={bucket}
              onSelect={pickBucketRow}
              onDelete={actions.remove}
              onSmartAdd={smartAdd}
              onAdd={actions.openSearch}
              bottomInset={insets.bottom + spacing.xl}
            />
          }
        />
      </View>
      <View
        style={[styles.toast, { bottom: insets.bottom + TOAST_BOTTOM }]}
        pointerEvents="box-none"
      >
        <Toast
          visible={toast !== null}
          message={toast?.message ?? ''}
          actionLabel={toast?.undo ? 'Undo' : undefined}
          onAction={toastUndo}
          onDismiss={toastDismiss}
          testID="plan-toast"
        />
      </View>
      <AddPlaceSheet
        mode={actions.addMode}
        near={near}
        onClose={actions.closeSheet}
        onPickSpot={actions.pickSpot}
        onDropPin={actions.startDropPin}
        onSavePin={actions.savePin}
        saving={actions.saving}
      />
      {editor.sheets}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  headerLoading: { alignItems: 'center', paddingVertical: spacing.xs },
  pills: { paddingBottom: spacing.md },
  pillsLoading: { paddingHorizontal: screenPadding },
  body: { flex: 1 },
  toast: { position: 'absolute', left: screenPadding, right: screenPadding },
  dayLoading: { paddingHorizontal: screenPadding, paddingVertical: spacing.md },
});
