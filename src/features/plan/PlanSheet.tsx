import BottomSheet from '@gorhom/bottom-sheet';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { PlanMode } from '@/stores/selection';
import { colors, radii, screenPadding, spacing } from '@/theme';
import { Segmented } from '@/ui';

/** The sheet's two heights: over the lower part of the screen, or covering the map. */
export const SHEET_HALF = 0;
export const SHEET_FULL = 1;

export interface PlanSheetProps {
  /** Height of the half snap point, from the bottom of the screen. */
  halfHeight: number;
  /** Ask the sheet to go back to half height; changes each time (e.g. a row was tapped). */
  collapseKey: number;
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
 * the selected segment's content. Snaps at half height and full height.
 */
export function PlanSheet({
  halfHeight,
  collapseKey,
  mode,
  onModeChange,
  bucketCount,
  header,
  itinerary,
  bucketList,
}: PlanSheetProps) {
  const sheet = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => [halfHeight, '100%'], [halfHeight]);

  // A tap in the list while the sheet covers the map brings the map back into view.
  const collapsed = useRef(collapseKey);
  useEffect(() => {
    if (collapsed.current === collapseKey) return;
    collapsed.current = collapseKey;
    sheet.current?.snapToIndex(SHEET_HALF);
  }, [collapseKey]);

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
    <BottomSheet
      ref={sheet}
      index={SHEET_HALF}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      enableOverDrag={false}
      animateOnMount={false}
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.grabber}
      handleStyle={styles.handle}
    >
      <View testID="plan-sheet" style={styles.content}>
        {header}
        <View style={styles.segmented}>
          <Segmented segments={segments} value={mode} onChange={onModeChange} testID="plan-mode" />
        </View>
        <View style={styles.body}>{mode === 'itinerary' ? itinerary : bucketList}</View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  background: {
    backgroundColor: colors.surface,
    borderRadius: radii.photo,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  handle: { paddingTop: spacing.sm, paddingBottom: spacing.xxs },
  grabber: { backgroundColor: colors.textSecondary, width: 36, height: 5 },
  content: { flex: 1 },
  segmented: { paddingHorizontal: screenPadding, paddingBottom: spacing.sm },
  body: { flex: 1 },
});
