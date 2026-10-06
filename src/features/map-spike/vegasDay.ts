import { pinPhotos } from './pinPhotos';
import type { LngLat, SpikePin } from './types';

/** The sample day from the reference mockup: Fri, Nov 14 in Las Vegas. */
export const vegasDay: SpikePin[] = [
  {
    id: 'brunch',
    title: 'Brunch at Mon Ami Gabi',
    time: '10:00 AM',
    lat: 36.1125,
    lng: -115.1716,
    photo: pinPhotos.brunch,
  },
  {
    id: 'fountains',
    title: 'Bellagio Fountains',
    time: '12:00 PM',
    lat: 36.1129,
    lng: -115.1745,
    photo: pinPhotos.fountains,
  },
  {
    id: 'sphere',
    title: 'Sphere Experience',
    time: '3:00 PM',
    lat: 36.1209,
    lng: -115.1617,
    photo: pinPhotos.sphere,
  },
  {
    id: 'dinner',
    title: 'Dinner at Carbone',
    time: '8:00 PM',
    lat: 36.1074,
    lng: -115.1767,
    photo: pinPhotos.dinner,
  },
];

const photos = Object.values(pinPhotos);

/**
 * The sample day plus extra deterministic pins scattered around the Strip, for the 30-pin
 * performance check. Same input, same pins (no Math.random).
 */
export function spikePins(count: number): SpikePin[] {
  const pins = vegasDay.slice(0, count);
  let seed = 7;
  const next = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = pins.length; i < count; i++) {
    pins.push({
      id: `extra-${i}`,
      title: `Saved place ${i - vegasDay.length + 1}`,
      time: '',
      lat: 36.095 + next() * 0.04,
      lng: -115.185 + next() * 0.035,
      photo: photos[i % photos.length],
    });
  }
  return pins;
}

/** The day's route: the four stops in time order (straight legs; real routing is out of scope). */
export const vegasRoute: LngLat[] = vegasDay.map(({ lat, lng }) => ({ lat, lng }));

/** Camera that frames the Strip, shared by both city maps so they open on the same view. */
export const vegasCenter: LngLat = { lat: 36.1135, lng: -115.1705 };

/** The flight view: Tampa to Las Vegas (TPA → LAS). */
export const flight = {
  from: { lat: 27.9755, lng: -82.5332, code: 'TPA', city: 'Tampa' },
  to: { lat: 36.084, lng: -115.1537, code: 'LAS', city: 'Las Vegas' },
} as const;
