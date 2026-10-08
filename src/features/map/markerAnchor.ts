/** A marker's content box, in points. */
export interface MarkerSize {
  width: number;
  height: number;
}

/** A point inside a marker's content box, in points from its top-left corner. */
export interface MarkerPoint {
  x: number;
  y: number;
}

/**
 * The `centerOffset` that puts `anchor` (a point inside the marker's box) on the marker's
 * coordinate. Apple Maps places the centre of the marker's view on the coordinate, then moves it by
 * `centerOffset` (positive is right and down), so the offset is the box's centre minus the anchor.
 *
 * This only holds when the native marker view is exactly `size`: the marker's single child must be
 * a `MarkerBox` of that size (see `MarkerBox`).
 */
export function centerOffsetFor(size: MarkerSize, anchor: MarkerPoint): MarkerPoint {
  return { x: size.width / 2 - anchor.x, y: size.height / 2 - anchor.y };
}

/**
 * Where Apple Maps draws `anchor`, relative to the coordinate's point on screen, for a native
 * marker view of `size` moved by `offset`. Zero means the anchor sits exactly on the coordinate.
 */
export function anchorOnScreen(
  size: MarkerSize,
  offset: MarkerPoint,
  anchor: MarkerPoint,
): MarkerPoint {
  return {
    x: offset.x - size.width / 2 + anchor.x,
    y: offset.y - size.height / 2 + anchor.y,
  };
}

/** A dot with a label pill under it, both centred in a fixed-width box. */
export interface LabelledDotLayout {
  size: MarkerSize;
  /** The dot's centre: the point that belongs on the coordinate. */
  anchor: MarkerPoint;
  centerOffset: MarkerPoint;
}

export function labelledDotLayout({
  width,
  dot,
  gap,
  labelHeight,
}: {
  width: number;
  dot: number;
  gap: number;
  labelHeight: number;
}): LabelledDotLayout {
  const size = { width, height: dot + gap + labelHeight };
  const anchor = { x: width / 2, y: dot / 2 };
  return { size, anchor, centerOffset: centerOffsetFor(size, anchor) };
}
