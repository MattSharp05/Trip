import { useCallback, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tabTitle } from '@/core/tabs';
import { TripDayMap, type TripMapHandle } from '@/features/map';
import { useTripData } from '@/services/data';
import { useScenarioStore } from '@/stores/scenario';
import { useTripStore } from '@/stores/trip';
import { colors } from '@/theme';
import { PlaceholderScreen, Skeleton } from '@/ui';

/** Share of the screen the map takes, under the date pills (PRD → Plan). */
const MAP_SHARE = 0.45;

export default function PlanScreen() {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const tripId = useTripStore((s) => s.selectedTripId);
  const trip = useTripData(tripId);
  // TR-12 replaces this with the selected-day store; for now the scenario's day, else day one.
  const scenarioDay = useScenarioStore((s) => s.view.day);
  const map = useRef<TripMapHandle>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Stable, so pins that didn't change skip re-rendering.
  const select = useCallback((id: string) => {
    setSelectedId(id);
    map.current?.flyTo(id);
  }, []);

  if (!tripId) return <PlaceholderScreen title={tabTitle('plan')} />;

  const focusDay = scenarioDay ?? trip.data?.trip.startDate;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* TR-12: date pills go here. */}
      <View style={{ height: height * MAP_SHARE }}>
        {trip.data && focusDay ? (
          <TripDayMap
            ref={map}
            data={trip.data}
            focusDay={focusDay}
            selectedId={selectedId}
            onPinPress={select}
          />
        ) : (
          <Skeleton height={height * MAP_SHARE} radius="sm" testID="map-loading" />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
});
