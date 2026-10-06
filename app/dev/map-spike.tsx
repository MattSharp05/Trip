import { Redirect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { devToolsEnabled } from '@/core/devTools';
import {
  AppleGlobe,
  AppleSpikeMap,
  cityHtml,
  flight,
  globeHtml,
  greatCircle,
  spikePins,
  vegasCenter,
  vegasDay,
  vegasRoute,
  WebSpikeMap,
  type SpikeMapHandle,
  type SpikeTab,
} from '@/features/map-spike';
import { colors, screenPadding, spacing } from '@/theme';
import { Chip, Segmented, Surface, Text } from '@/ui';

const TABS = [
  { value: 'apple', label: 'A · Apple Maps' },
  { value: 'maplibre', label: 'B · MapLibre' },
  { value: 'globe', label: 'Globe' },
] as const;

const ENGINES = [
  { value: 'maplibre', label: 'MapLibre' },
  { value: 'apple', label: 'Apple' },
] as const;

type Engine = (typeof ENGINES)[number]['value'];

/** TR-5 spike: the same Vegas day on Apple Maps and on MapLibre, plus the flight globe. */
export default function MapSpikeScreen() {
  return devToolsEnabled() ? <MapSpike /> : <Redirect href="/trips" />;
}

function MapSpike() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<SpikeTab>('apple');
  const [globeEngine, setGlobeEngine] = useState<Engine>('maplibre');
  const [many, setMany] = useState(false);
  const [tilted, setTilted] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [readyMs, setReadyMs] = useState<number | null>(null);
  const [fps, setFps] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const map = useRef<SpikeMapHandle>(null);
  const mountedAt = useRef(0);
  useEffect(() => {
    mountedAt.current = performance.now();
  }, []);

  const allPins = useMemo(() => spikePins(30), []);
  const pins = many ? allPins : vegasDay;
  // Built once: a new HTML string would reload the WebView.
  const city = useMemo(() => cityHtml(allPins, vegasRoute, vegasCenter), [allPins]);
  const globe = useMemo(
    () => globeHtml(greatCircle(flight.from, flight.to), [flight.from, flight.to]),
    [],
  );

  const restartClock = () => {
    mountedAt.current = performance.now();
    setReadyMs(null);
    setFps(null);
    setError(null);
    setTilted(false);
  };
  const onReady = useCallback(
    () => setReadyMs(Math.round(performance.now() - mountedAt.current)),
    [],
  );
  const selected = pins.find((p) => p.id === selectedId);

  const stats = [
    readyMs === null ? 'Loading map' : `Ready in ${(readyMs / 1000).toFixed(2)} s`,
    fps === null ? null : `${fps} fps last move`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.screen}>
      <View style={styles.top}>
        <Segmented
          segments={TABS}
          value={tab}
          onChange={(value) => {
            restartClock();
            setTab(value);
          }}
        />
        {tab === 'globe' ? (
          <Segmented
            segments={ENGINES}
            value={globeEngine}
            onChange={(value) => {
              restartClock();
              setGlobeEngine(value);
            }}
          />
        ) : null}
      </View>

      <View style={styles.map}>
        {tab === 'apple' ? (
          <AppleSpikeMap
            ref={map}
            pins={pins}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onReady={onReady}
          />
        ) : null}
        {tab === 'maplibre' ? (
          <WebSpikeMap
            ref={map}
            html={city}
            pins={pins}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onReady={onReady}
            onFps={setFps}
            onError={setError}
          />
        ) : null}
        {tab === 'globe' && globeEngine === 'maplibre' ? (
          <WebSpikeMap
            testID="maplibre-globe"
            html={globe}
            pins={[]}
            selectedId={null}
            onSelect={() => {}}
            onReady={onReady}
            onFps={setFps}
            onError={setError}
          />
        ) : null}
        {tab === 'globe' && globeEngine === 'apple' ? <AppleGlobe onReady={onReady} /> : null}
      </View>

      <Surface
        level="raised"
        padding="md"
        style={[styles.panel, { paddingBottom: insets.bottom + spacing.md }]}
      >
        <Text variant="caption" tone="secondary" testID="spike-stats">
          {error ? `Error: ${error}` : stats}
        </Text>
        {tab === 'globe' ? (
          <Text variant="subhead">Tampa to Las Vegas. Drag to spin the globe.</Text>
        ) : (
          <>
            <Text variant="headline" numberOfLines={1}>
              {selected
                ? `${selected.title}${selected.time ? ` · ${selected.time}` : ''}`
                : 'Fri, Nov 14'}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.row}>
                {vegasDay.map((pin) => (
                  <Chip
                    key={pin.id}
                    label={pin.time}
                    selected={pin.id === selectedId}
                    onPress={() => {
                      setSelectedId(pin.id);
                      map.current?.flyTo(pin.id);
                    }}
                  />
                ))}
                <Chip
                  label="3D"
                  selected={tilted}
                  onPress={() => {
                    map.current?.tilt(!tilted);
                    setTilted(!tilted);
                  }}
                />
                <Chip label="30 pins" selected={many} onPress={() => setMany(!many)} />
              </View>
            </ScrollView>
          </>
        )}
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  top: { padding: screenPadding, paddingTop: spacing.sm, gap: spacing.sm },
  map: { flex: 1, overflow: 'hidden' },
  panel: { gap: spacing.sm, borderRadius: 0 },
  row: { flexDirection: 'row', gap: spacing.sm },
});
