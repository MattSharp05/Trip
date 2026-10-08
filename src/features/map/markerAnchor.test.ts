import { anchorOnScreen, centerOffsetFor, labelledDotLayout } from './markerAnchor';

describe('centerOffsetFor', () => {
  it('is zero for an anchor at the centre of the box', () => {
    expect(centerOffsetFor({ width: 40, height: 40 }, { x: 20, y: 20 })).toEqual({ x: 0, y: 0 });
  });

  it('moves the box down when the anchor is near its top', () => {
    expect(centerOffsetFor({ width: 120, height: 36 }, { x: 60, y: 6 })).toEqual({ x: 0, y: 12 });
  });

  it('moves the box right when the anchor is near its left', () => {
    expect(centerOffsetFor({ width: 100, height: 20 }, { x: 10, y: 10 })).toEqual({ x: 40, y: 0 });
  });

  it.each([
    [
      { width: 120, height: 36 },
      { x: 60, y: 6 },
    ],
    [
      { width: 160, height: 78 },
      { x: 80, y: 26 },
    ],
    [
      { width: 44, height: 44 },
      { x: 22, y: 22 },
    ],
    [
      { width: 30, height: 90 },
      { x: 3, y: 87 },
    ],
  ])('puts the anchor on the coordinate (%o, %o)', (size, anchor) => {
    const point = anchorOnScreen(size, centerOffsetFor(size, anchor), anchor);
    expect(point.x).toBeCloseTo(0);
    expect(point.y).toBeCloseTo(0);
  });
});

describe('labelledDotLayout', () => {
  const layout = labelledDotLayout({ width: 120, dot: 12, gap: 4, labelHeight: 20 });

  it('is the dot, the gap and the label, stacked', () => {
    expect(layout.size).toEqual({ width: 120, height: 36 });
    expect(layout.anchor).toEqual({ x: 60, y: 6 });
    expect(layout.centerOffset).toEqual({ x: 0, y: 12 });
  });

  it('keeps the dot on the coordinate', () => {
    expect(anchorOnScreen(layout.size, layout.centerOffset, layout.anchor)).toEqual({
      x: 0,
      y: 0,
    });
  });

  it('reproduces the QA round 2 miss when the native view shrinks to the 12 pt dot', () => {
    // What iOS did before MarkerBox: the box was flattened, the marker took the dot's 12 × 12
    // frame (drawn 54 pt in from the box's left), and the same offset moved it. Matthew's
    // screenshot shows the dots 53.5 pt right and 11.7 pt below the arc's ends.
    const shrunk = { width: 12, height: 12 };
    const dotInShrunkView = { x: 54 + 6, y: 6 };
    expect(anchorOnScreen(shrunk, layout.centerOffset, dotInShrunkView)).toEqual({ x: 54, y: 12 });
  });
});
