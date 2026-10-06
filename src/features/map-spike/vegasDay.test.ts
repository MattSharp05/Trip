import { spikePins, vegasDay, vegasRoute } from './vegasDay';

describe('spike data', () => {
  it('has the four stops of the mockup day, in order, with photos', () => {
    expect(vegasDay.map((p) => p.title)).toEqual([
      'Brunch at Mon Ami Gabi',
      'Bellagio Fountains',
      'Sphere Experience',
      'Dinner at Carbone',
    ]);
    for (const pin of vegasDay) expect(pin.photo).toMatch(/^data:image\/jpeg;base64,/);
    expect(vegasRoute).toHaveLength(4);
  });

  it('makes 30 deterministic pins with unique ids around the Strip', () => {
    const pins = spikePins(30);
    expect(pins).toHaveLength(30);
    expect(new Set(pins.map((p) => p.id)).size).toBe(30);
    expect(spikePins(30)).toEqual(pins);
    for (const p of pins) {
      expect(p.lat).toBeGreaterThan(36.09);
      expect(p.lat).toBeLessThan(36.14);
      expect(p.lng).toBeGreaterThan(-115.19);
      expect(p.lng).toBeLessThan(-115.14);
    }
  });

  it('returns just the day for 4 pins', () => {
    expect(spikePins(4)).toEqual(vegasDay);
  });
});
