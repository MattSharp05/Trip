import { dragShift, dropIndex } from './drag';

// Three rows: 68 tall, 68 + a 28 leg, 68.
const offsets = [0, 68, 164, 232];

describe('dropIndex', () => {
  it('stays put for a small move', () => {
    expect(dropIndex(offsets, 1, 10)).toBe(1);
    expect(dropIndex(offsets, 1, -10)).toBe(1);
  });

  it('lands on the row its middle is over', () => {
    expect(dropIndex(offsets, 0, 100)).toBe(1);
    expect(dropIndex(offsets, 0, 140)).toBe(2);
    expect(dropIndex(offsets, 2, -140)).toBe(0);
  });

  it('clamps to the ends of the list', () => {
    expect(dropIndex(offsets, 0, 1000)).toBe(2);
    expect(dropIndex(offsets, 2, -1000)).toBe(0);
  });
});

describe('dragShift', () => {
  it('moves the rows in between out of the way', () => {
    // Row 0 dragged down over row 2: rows 1 and 2 move up by its height.
    expect([1, 2].map((i) => dragShift(offsets, 0, 2, i))).toEqual([-68, -68]);
    // Row 1 (with its leg, 96) dragged up over row 0: row 0 moves down.
    expect(dragShift(offsets, 1, 0, 0)).toBe(96);
    expect(dragShift(offsets, 1, 0, 2)).toBe(0);
  });
});
