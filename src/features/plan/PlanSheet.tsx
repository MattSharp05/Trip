import { useMemo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { MapSheet } from '@/features/map/MapSheet';
import type { PlanMode } from '@/stores/selection';
import { screenPadding, spacing } from '@/theme';
import { Segmented } from '@/ui';

export interface PlanSheetProps {
  /** Height of the half snap point, from the bottom of the screen. */
  halfHeight: number;
  /** The floating tab bar and home indicator under a collapsed sheet. */
  bottomInset: number;
  /** Ask the sheet to go back to half height; changes each time (e.g. a row was tapped). */
  collapseKey: number;
  /** Ask the sheet to go to half height from any height; changes each time a trip is opened. */
  halfKey?: number;
  /** How much of the screen the sheet covers now: the map is sized to the rest. */
  onCoverChange?: (cover: number) => void;
  mode: PlanMode;
  onModeChange: (mode: PlanMode) => void;
  /** Shown in the Bucket List segment's label. */
  bucketCount: number | undefined;
  /** The day header, over both segments. */
  header: ReactNode;
  itinerary: ReactNode;
  bucketList: ReactNode;
}

/**
 * The Plan sheet over the map (PRD → Plan): a grabber, the day header, Itinerary / Bucket List, and
 * the selected segment's content. Snaps collapsed (grabber and day header over a full-screen map),
 * half and full (TR-46).
 */
export function PlanSheet({
  halfHeight,
  bottomInset,
  collapseKey,
  halfKey,
  onCoverChange,
  mode,
  onModeChange,
  bucketCount,
  header,
  itinerary,
  bucketList,
}: PlanSheetProps) {
  const segments = useMemo(
    () =>
      [
        { value: 'itinerary', label: 'Itinerary' },
        {
          value: 'bucket',
          label: bucketCount === undefined ? 'Bucket List' : `Bucket List (${bucketCount})`,
        },
      ] as const,
    [bucketCount],
  );

  return (
    <MapSheet
      halfHeight={halfHeight}
      bottomInset={bottomInset}
      collapseKey={collapseKey}
      halfKey={halfKey}
      onCoverChange={onCoverChange}
      top={header}
      testID="plan-sheet"
    >
      <View style={styles.segmented}>
        <Segmented segments={segments} value={mode} onChange={onModeChange} testID="plan-mode" />
      </View>
      <View style={styles.body}>{mode === 'itinerary' ? itinerary : bucketList}</View>
    </MapSheet>
  );
}

const styles = StyleSheet.create({
  segmented: { paddingHorizontal: screenPadding, paddingBottom: spacing.sm },
  body: { flex: 1 },
});
