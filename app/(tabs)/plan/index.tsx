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
import {
  LinkBanner,
  LinkResultsSheet,
  readClipboard,
  useClipboardOfferStore,
  useLinkFlow,
} from '@/features/links';
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
import { LINK_SAMPLES } from '../../../supabase/functions/_shared/parse/linkFixtures';
import { useDataSource, useTripData, type DataSource } from '@/services/data';
import { useTripForecast } from '@/services/weather';
import { useScenarioStore } from '@/stores/scenario';
import { useTripSelection } from '@/stores/selection';
import { useTripStore } from '@/stores/trip';
import { colors, radii, screenPadding, spacing } from '@/theme';
import { Button, LoadError, Skeleton, Text, Toast } from '@/ui';

/** Share of the screen the map shows above the half-height sheet (reference mockup, Plan). */
const MAP_SHARE = 0.36;
/** The sheet's rounded top overlaps the map by its corner radius. */
const SHEET_OVERLAP = radii.photo;
/** Header and date pills, until the body under them has been measured. */
const TOP_ESTIMATE = 140;

/** The toast floats above the tab bar (49 pt on iPhone) over the sheet. */
const TOAST_BOTTOM = 49 + spacing.md;

/** Demo sessions whose sample video has been opened: once per scenario load. */
/** How long a scenario's sample video waits before its results sheet opens (TR-43). */
const SAMPLE_OPEN_DELAY_MS = 600;

/**
 * The native tab bar floats over the bottom of the screen (iOS 26): the itinerary and Bucket List
 * scroll their last row (and "Add a place") clear of it (TR-35).
 */
const FLOATING_TAB_BAR = 64;

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

  const near = useMemo(
    () =>
      info && info.lat !== null && info.lng !== null ? { lat: info.lat, lng: info.lng } : null,
    [info],
  );
  const editor = useItineraryEditor({ data: trip.data, day: selectedDay, days, near });

  // TikTok and Reel links (TR-30): the clipboard banner and the Add sheet's paste row open the
  // results sheet; saved places land on the Bucket List.
  const offered = useClipboardOfferStore((s) => s.offered);
  const dismissOffer = useClipboardOfferStore((s) => s.dismiss);
  const linkArea = useMemo(() => ({ city: info?.city ?? null, near }), [info?.city, near]);
  const { setPlanMode: setMode } = selection;
  const showBucket = useCallback(() => setMode('bucket'), [setMode]);
  const links = useLinkFlow(tripId, linkArea, showBucket);
  const { open: openLink } = links;
  const addFromClipboard = useCallback(async () => {
    dismissOffer();
    openLink(await readClipboard());
  }, [dismissOffer, openLink]);
  const { closeSheet: closeAddSheet } = actions;
  const addLink = useCallback(
    (text: string) => {
      closeAddSheet();
      openLink(text);
    },
    [closeAddSheet, openLink],
  );
  // A scenario can open straight on the results for a sample video, once its trip has loaded and
  // the scenario link's tab switch has settled (TR-43). Every Plan screen that mounts opens it; it
  // is used up only when the sheet this screen opened closes (saved or dismissed), so a screen torn
  // down by the redirect doesn't use it up for the one that stays.
  const source = useDataSource();
  const tripLoaded = trip.data !== undefined;
  const sampleOpened = useRef<DataSource | null>(null);
  useEffect(() => {
    const sample = useScenarioStore.getState().view.linkSample;
    if (!sample || source.kind !== 'demo' || !tripLoaded || sampleOpened.current === source) return;
    const timer = setTimeout(() => {
      sampleOpened.current = source;
      openLink(LINK_SAMPLES[sample].result.url);
    }, SAMPLE_OPEN_DELAY_MS);
    return () => clearTimeout(timer);
  }, [openLink, source, tripLoaded]);
  useEffect(() => {
    if (sampleOpened.current !== source || links.isOpen) return;
    const { view } = useScenarioStore.getState();
    if (view.linkSample) useScenarioStore.setState({ view: { ...view, linkSample: undefined } });
  }, [links.isOpen, source]);

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
  // Plan my bucket list (TR-32): when everything fit, the earliest new stop's day opens; when
  // something didn't, the Bucket List stays, with a note on each item left.
  const { planAll } = smart;
  const planAllBucket = useCallback(() => {
    dismissEditToast();
    dismissBucketToast();
    const first = planAll();
    if (!first) return;
    setPlanMode('itinerary');
    setGlobeDay(null);
    selectItem(first.itemId, 'map', first.day);
  }, [planAll, setPlanMode, selectItem, dismissEditToast, dismissBucketToast]);
  // The newest toast wins: an edit or a bucket change replaces Smart Add's.
  useEffect(() => {
    if (editor.toast || actions.toast || links.toast) dismissSmartToast();
  }, [editor.toast, actions.toast, links.toast, dismissSmartToast]);
  const toast = smart.toast ?? editor.toast ?? actions.toast ?? links.toast;
  const toastUndo = smart.toast ? smart.undo : editor.toast ? editor.undo : actions.undo;
  const toastDismiss = smart.toast
    ? smart.dismissToast
    : editor.toast
      ? editor.dismissToast
      : actions.toast
        ? actions.dismissToast
        : links.dismissToast;

  const [bodyHeight, setBodyHeight] = useState(() => height - insets.top - TOP_ESTIMATE);
  const mapHeight = Math.round(height * MAP_SHARE);
  const sheetHalf = Math.max(bodyHeight - mapHeight + SHEET_OVERLAP, 0);

  if (!tripId || trip.data === null) {
    return (
      <View
        style={[styles.screen, styles.center, { paddingTop: insets.top }]}
        testID="plan-no-trip"
      >
        <Text variant="largeTitle" accessibilityRole="header">
          {tabTitle('plan')}
        </Text>
        <Text variant="body" tone="secondary" style={styles.centerText}>
          {tripId
            ? 'This trip is no longer in your account. Pick another one on Trips.'
            : 'Pick a trip on Trips, or create one, to see its map and days here.'}
        </Text>
        <Button label="Go to Trips" variant="secondary" onPress={() => router.navigate('/trips')} />
      </View>
    );
  }
  if (trip.isError && !trip.data) {
    return (
      <View style={[styles.screen, styles.center, { paddingTop: insets.top }]}>
        <LoadError
          message="Couldn't load this trip. Check your connection."
          onRetry={() => void trip.refetch()}
          testID="plan-error"
        />
      </View>
    );
  }

  const weather = forecast.data ?? {};
  const bucketCount = trip.data?.bucketItems.length;
  const onGlobe = flight !== null && !inBucket && globeDay === selectedDay;
  // Edit / Done (drag handles) only when the day has stops to reorder.
  const canReorder = !inBucket && (entries?.length ?? 0) > 1;
  const reordering = canReorder && editor.reordering;
  const dayHeader = selectedDay ? (
    <DayHeader
      day={selectedDay}
      weather={weather[selectedDay]}
      unit={UNIT}
      onAdd={inBucket ? undefined : editor.add}
      onToggleReorder={canReorder ? editor.toggleReorder : undefined}
      reordering={reordering}
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
        {offered && !links.isOpen ? (
          <View style={styles.banner}>
            <LinkBanner onAdd={addFromClipboard} onDismiss={dismissOffer} />
          </View>
        ) : null}
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
              bottomInset={insets.bottom + FLOATING_TAB_BAR + spacing.lg}
              editing={editor.editing}
              reordering={reordering}
            />
          }
          bucketList={
            <BucketList
              entries={bucket}
              onSelect={pickBucketRow}
              onDelete={actions.remove}
              onSmartAdd={smartAdd}
              onPlanAll={planAllBucket}
              notes={smart.notes}
              onAdd={actions.openSearch}
              bottomInset={insets.bottom + FLOATING_TAB_BAR + spacing.lg}
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
        onLink={addLink}
        readClipboard={readClipboard}
        saving={actions.saving}
      />
      <LinkResultsSheet flow={links} near={near} />
      {editor.sheets}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingHorizontal: screenPadding,
  },
  centerText: { textAlign: 'center' },
  headerLoading: { alignItems: 'center', paddingVertical: spacing.xs },
  pills: { paddingBottom: spacing.md },
  pillsLoading: { paddingHorizontal: screenPadding },
  body: { flex: 1 },
  banner: { position: 'absolute', top: spacing.sm, left: screenPadding, right: screenPadding },
  toast: { position: 'absolute', left: screenPadding, right: screenPadding },
  dayLoading: { paddingHorizontal: screenPadding, paddingVertical: spacing.md },
});
