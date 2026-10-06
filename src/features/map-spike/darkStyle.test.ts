import { mapColors } from '@/theme';

import { darkStyle, OPENFREEMAP } from './darkStyle';

describe('darkStyle', () => {
  it('uses OpenFreeMap tiles and glyphs (no key)', () => {
    const style = darkStyle();
    expect(style.version).toBe(8);
    expect(style.sources.omt).toEqual({ type: 'vector', url: OPENFREEMAP.tiles });
    expect(style.glyphs).toBe(OPENFREEMAP.glyphs);
    expect(JSON.stringify(style)).not.toMatch(/key=|token=/i);
  });

  it('takes every colour from the map tokens', () => {
    const json = JSON.stringify(darkStyle({ globe: true }));
    const used = json.match(/#[0-9A-Fa-f]{6}\b/g) ?? [];
    const allowed = new Set<string>(Object.values(mapColors));
    expect(used.filter((c) => !allowed.has(c))).toEqual([]);
  });

  it('has unique layer ids and extrudes buildings for tilt', () => {
    const ids = darkStyle().layers.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(darkStyle().layers.find((l) => l.id === 'building')?.type).toBe('fill-extrusion');
  });

  it('switches on the globe projection only for the flight view', () => {
    expect(darkStyle()).not.toHaveProperty('projection');
    expect(darkStyle({ globe: true })).toMatchObject({ projection: { type: 'globe' } });
  });
});
