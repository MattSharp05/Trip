import BottomSheet from '@gorhom/bottom-sheet';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import {
  SHEET_COLLAPSED,
  SHEET_FULL,
  SHEET_HALF,
  sheetCover,
  sheetHeights,
  type SheetIndex,
} from '@/core/sheet';
import { colors, radii, spacing } from '@/theme';

/** The grabber row: its padding and the 5 pt grabber. */
const HANDLE_HEIGHT = spacing.sm + 5 + spacing.xxs;
/** The top row's height until it has been measured. */
const PEEK_ESTIMATE = 64;

export interface MapSheetProps {
  /** The half snap point's height, from the bottom of the area. */
  halfHeight: number;
  /** What sits under the collapsed sheet's top row (the floating tab bar and the home indicator). */
  bottomInset: number;
  /** Ask the sheet to leave full height for half; changes each time (e.g. a row was tapped). */
  collapseKey?: number;
  /** Always on show, even collapsed (the day header, the trip filter). */
  top: ReactNode;
  /** Under `top`; hidden when the sheet is collapsed. */
  children: ReactNode;
  /** How much of the area the sheet covers now: size the map to the rest. */
  onCoverChange?: (cover: number) => void;
  testID?: string;
}

/**
 * A sheet over a map (ADR 0011) with three heights: collapsed (only the grabber and `top` show, so
 * the map takes the screen), half, and full. It tells the screen how much it covers, early when
 * it goes down (the map grows behind it) and once it has settled when it goes up (the map shrinks
 * under it), so no gap ever shows between them.
 */
export function MapSheet({
  halfHeight,
  bottomInset,
  collapseKey = 0,
  top,
  children,
  onCoverChange,
  testID,
}: MapSheetProps) {
  const sheet = useRef<BottomSheet>(null);
  const [topHeight, setTopHeight] = useState(PEEK_ESTIMATE);
  const heights = useMemo(
    () => sheetHeights({ half: halfHeight, peek: HANDLE_HEIGHT + topHeight + bottomInset }),
    [halfHeight, topHeight, bottomInset],
  );
  const snapPoints = useMemo(() => [heights.collapsed, heights.half, '100%'], [heights]);

  const index = useRef<SheetIndex>(SHEET_HALF);
  const report = useCallback(
    (to: number) => {
      if (to < SHEET_COLLAPSED || to > SHEET_FULL) return;
      index.current = to as SheetIndex;
      onCoverChange?.(sheetCover(index.current, heights));
    },
    [heights, onCoverChange],
  );
  // New heights (measured top row, rotated screen): the map follows.
  useEffect(() => {
    onCoverChange?.(sheetCover(index.current, heights));
  }, [heights, onCoverChange]);

  // A tap in the list while the sheet covers the map brings the map back into view. A collapsed
  // sheet stays down: the map is already on show.
  const collapsed = useRef(collapseKey);
  useEffect(() => {
    if (collapsed.current === collapseKey) return;
    collapsed.current = collapseKey;
    if (index.current === SHEET_FULL) sheet.current?.snapToIndex(SHEET_HALF);
  }, [collapseKey]);

  const onTopLayout = (e: LayoutChangeEvent) =>
    setTopHeight(Math.ceil(e.nativeEvent.layout.height));

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
      onAnimate={(from, to) => {
        if (to < from) report(to);
      }}
      onChange={report}
    >
      <View testID={testID} style={styles.content}>
        <View onLayout={onTopLayout}>{top}</View>
        <View style={styles.body}>{children}</View>
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
  body: { flex: 1 },
});
