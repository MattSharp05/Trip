/**
 * A map with a sheet over it (Plan, Trips): the sheet snaps collapsed (only its top row shows, so
 * the map fills the screen), half, or full. The map is sized to the part the sheet leaves
 * uncovered, so framing a day or the globe uses what is actually on screen (TR-46 QA round 2).
 */

/** Snap indexes, lowest first (`@gorhom/bottom-sheet` order). */
export const SHEET_COLLAPSED = 0;
export const SHEET_HALF = 1;
export const SHEET_FULL = 2;
export type SheetIndex = typeof SHEET_COLLAPSED | typeof SHEET_HALF | typeof SHEET_FULL;

/** The collapsed sheet stays at least this far below the half one, so the two never merge. */
const MIN_STEP = 48;

export interface SheetHeights {
  collapsed: number;
  half: number;
}

/**
 * The collapsed and half heights, from the bottom of the area the sheet lives in. `peek` is what
 * the collapsed sheet shows (grabber, its top row, and the floating tab bar under it).
 */
export function sheetHeights({ half, peek }: { half: number; peek: number }): SheetHeights {
  const h = Math.max(Math.round(half), 0);
  const collapsed = Math.max(Math.min(Math.round(peek), h - MIN_STEP), 0);
  return { collapsed, half: h };
}

/** How much of the area the sheet covers at `index`. Full covers the map: it keeps half's map. */
export function sheetCover(index: SheetIndex, heights: SheetHeights): number {
  return index === SHEET_COLLAPSED ? heights.collapsed : heights.half;
}

/**
 * The map's height: the area minus the sheet, plus the sheet's rounded top that overlaps the
 * map's bottom edge.
 */
export function mapAreaHeight(area: number, cover: number, overlap: number): number {
  return Math.max(Math.round(area - cover + overlap), 0);
}
