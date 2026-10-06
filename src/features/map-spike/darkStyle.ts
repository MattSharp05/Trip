import { mapColors } from '@/theme';

/** OpenFreeMap: free vector tiles in the OpenMapTiles schema, no key (ADR 0002). */
export const OPENFREEMAP = {
  tiles: 'https://tiles.openfreemap.org/planet',
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
} as const;

const font = ['Noto Sans Regular'];
const fontBold = ['Noto Sans Bold'];

type Layer = Record<string, unknown> & { id: string; type: string };

const roadWidth = (base: number) => [
  'interpolate',
  ['exponential', 1.6],
  ['zoom'],
  10,
  base * 0.4,
  14,
  base * 1.6,
  18,
  base * 10,
];

function road(id: string, classes: string[], color: string, width: number): Layer {
  return {
    id,
    type: 'line',
    source: 'omt',
    'source-layer': 'transportation',
    filter: ['in', ['get', 'class'], ['literal', classes]],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': color, 'line-width': roadWidth(width) },
  };
}

/**
 * Our dark MapLibre style (style spec v8) for the OpenMapTiles schema: near-black land, quiet roads,
 * 3D buildings when tilted, few labels. `globe` switches on the globe projection and atmosphere.
 */
export function darkStyle({ globe = false }: { globe?: boolean } = {}) {
  const layers: Layer[] = [
    { id: 'background', type: 'background', paint: { 'background-color': mapColors.land } },
    {
      id: 'landuse',
      type: 'fill',
      source: 'omt',
      'source-layer': 'landuse',
      filter: ['in', ['get', 'class'], ['literal', ['residential', 'commercial', 'retail']]],
      paint: { 'fill-color': mapColors.landUrban },
    },
    {
      id: 'park',
      type: 'fill',
      source: 'omt',
      'source-layer': 'park',
      paint: { 'fill-color': mapColors.park },
    },
    {
      id: 'landcover',
      type: 'fill',
      source: 'omt',
      'source-layer': 'landcover',
      filter: ['in', ['get', 'class'], ['literal', ['grass', 'wood']]],
      paint: { 'fill-color': mapColors.park, 'fill-opacity': 0.6 },
    },
    {
      id: 'water',
      type: 'fill',
      source: 'omt',
      'source-layer': 'water',
      paint: { 'fill-color': mapColors.water },
    },
    {
      id: 'boundary',
      type: 'line',
      source: 'omt',
      'source-layer': 'boundary',
      filter: ['all', ['<=', ['get', 'admin_level'], 4], ['!=', ['get', 'maritime'], 1]],
      paint: { 'line-color': mapColors.boundary, 'line-width': 0.6, 'line-dasharray': [3, 2] },
    },
    road('road-minor', ['minor', 'service', 'track'], mapColors.roadMinor, 0.6),
    road('road-major', ['primary', 'secondary', 'tertiary', 'trunk'], mapColors.roadMajor, 1),
    road('road-highway', ['motorway'], mapColors.roadHighway, 1.2),
    {
      id: 'building',
      type: 'fill-extrusion',
      source: 'omt',
      'source-layer': 'building',
      minzoom: 14,
      paint: {
        'fill-extrusion-color': mapColors.building,
        'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 0],
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
        'fill-extrusion-opacity': 0.9,
      },
    },
    {
      id: 'road-label',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'transportation_name',
      minzoom: 14,
      filter: ['in', ['get', 'class'], ['literal', ['primary', 'secondary', 'trunk', 'motorway']]],
      layout: {
        'symbol-placement': 'line',
        'text-field': ['get', 'name'],
        'text-font': font,
        'text-size': 11,
      },
      paint: {
        'text-color': mapColors.labelMuted,
        'text-halo-color': mapColors.labelHalo,
        'text-halo-width': 1.2,
      },
    },
    {
      id: 'place-label',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'place',
      filter: [
        'in',
        ['get', 'class'],
        ['literal', ['country', 'state', 'city', 'town', 'suburb', 'neighbourhood']],
      ],
      layout: {
        'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']],
        'text-font': fontBold,
        'text-size': ['match', ['get', 'class'], 'country', 13, 'city', 14, 12],
      },
      paint: {
        'text-color': mapColors.label,
        'text-halo-color': mapColors.labelHalo,
        'text-halo-width': 1.4,
      },
    },
  ];

  return {
    version: 8,
    glyphs: OPENFREEMAP.glyphs,
    sources: { omt: { type: 'vector', url: OPENFREEMAP.tiles } },
    ...(globe
      ? {
          projection: { type: 'globe' },
          sky: {
            'sky-color': mapColors.space,
            'horizon-color': mapColors.atmosphere,
            'fog-color': mapColors.space,
            'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0],
          },
        }
      : {}),
    layers,
  };
}
