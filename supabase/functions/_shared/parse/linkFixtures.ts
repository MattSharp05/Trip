// Sample videos for TR-30 (made-up links and captions): what the `fixture` provider and scenario
// demo sessions use instead of TikTok, the model and Photon. `vegas-food` names four places, one of
// which Photon can't find; `instagram-sunset` names none.

import type { ExtractedPlaces, LinkResult } from './links.ts';
import type { LinkMeta } from './linkMeta.ts';

export interface LinkSample {
  /** What oEmbed / Open Graph would say. */
  meta: LinkMeta;
  /** What the model reads from the caption. */
  extracted: ExtractedPlaces;
  /** The function's whole answer, places located near Las Vegas. */
  result: LinkResult;
}

const VEGAS_FOOD_URL = 'https://www.tiktok.com/@trip.sample/video/7400000000000000001';
const VEGAS_FOOD_CAPTION =
  'Where locals eat in Vegas: Esther’s Kitchen downtown, Eggslut at the Cosmopolitan, Tacos El ' +
  'Gordo on the Strip, and Kaiseki Yuzu if you can get a seat #vegasfood #lasvegas';
const SUNSET_URL = 'https://www.instagram.com/reel/TRIPSAMPLE2/';
const SUNSET_CAPTION = 'Sunset from the balcony on our last night. Best trip ever #vegas';

export const LINK_SAMPLES: Record<'vegas-food' | 'instagram-sunset', LinkSample> = {
  'vegas-food': {
    meta: { title: VEGAS_FOOD_CAPTION, author: 'trip.sample', thumbnailUrl: null },
    extracted: {
      places: [
        { name: 'Esther’s Kitchen', city: 'Las Vegas', kind: 'food' },
        { name: 'Eggslut', city: 'Las Vegas', kind: 'food' },
        { name: 'Tacos El Gordo', city: 'Las Vegas', kind: 'food' },
        { name: 'Kaiseki Yuzu', city: 'Las Vegas', kind: 'food' },
      ],
    },
    result: {
      url: VEGAS_FOOD_URL,
      platform: 'tiktok',
      title: VEGAS_FOOD_CAPTION,
      author: 'trip.sample',
      thumbnailUrl: null,
      places: [
        {
          name: "Esther's Kitchen",
          kind: 'food',
          area: 'Downtown',
          address: '1131 South Main Street, Las Vegas',
          lat: 36.16,
          lng: -115.153,
        },
        {
          name: 'Eggslut',
          kind: 'food',
          area: 'The Strip',
          address: '3708 South Las Vegas Boulevard, Las Vegas',
          lat: 36.1098,
          lng: -115.174,
        },
        {
          name: 'Tacos El Gordo',
          kind: 'food',
          area: 'The Strip',
          address: '3049 South Las Vegas Boulevard, Las Vegas',
          lat: 36.1335,
          lng: -115.1647,
        },
        { name: 'Kaiseki Yuzu', kind: 'food', area: 'Las Vegas', address: null, lat: null, lng: null },
      ],
    },
  },
  'instagram-sunset': {
    meta: { title: SUNSET_CAPTION, author: 'trip.sample', thumbnailUrl: null },
    extracted: { places: [] },
    result: {
      url: SUNSET_URL,
      platform: 'instagram',
      title: SUNSET_CAPTION,
      author: 'trip.sample',
      thumbnailUrl: null,
      places: [],
    },
  },
};

export type LinkSampleName = keyof typeof LINK_SAMPLES;

/** The sample a link is, if any (scenarios and the fixture provider). */
export function linkSampleFor(url: string): LinkSample | null {
  const u = url.trim();
  return Object.values(LINK_SAMPLES).find((s) => s.result.url === u) ?? null;
}
