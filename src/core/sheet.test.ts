import {
  mapAreaHeight,
  SHEET_COLLAPSED,
  SHEET_FULL,
  SHEET_HALF,
  sheetCover,
  sheetHeights,
} from './sheet';

describe('sheetHeights', () => {
  it('collapses to what the sheet needs to show', () => {
    expect(sheetHeights({ half: 420, peek: 160 })).toEqual({ collapsed: 160, half: 420 });
  });

  it('keeps the collapsed sheet clearly below the half one', () => {
    expect(sheetHeights({ half: 180, peek: 170 })).toEqual({ collapsed: 132, half: 180 });
  });

  it('never goes below zero', () => {
    expect(sheetHeights({ half: -10, peek: 100 })).toEqual({ collapsed: 0, half: 0 });
  });
});

describe('the map under the sheet', () => {
  const heights = { collapsed: 160, half: 420 };

  it('fills the screen down to the collapsed sheet', () => {
    expect(mapAreaHeight(700, sheetCover(SHEET_COLLAPSED, heights), 16)).toBe(556);
  });

  it('is the usual share above the half sheet', () => {
    expect(mapAreaHeight(700, sheetCover(SHEET_HALF, heights), 16)).toBe(296);
  });

  it("keeps half's map under a full sheet (it is covered anyway)", () => {
    expect(sheetCover(SHEET_FULL, heights)).toBe(420);
  });
});
