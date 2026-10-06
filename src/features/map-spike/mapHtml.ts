import { colors, mapColors } from '@/theme';

import { darkStyle } from './darkStyle';
import { along } from './geo';
import type { LngLat, SpikePin } from './types';
import { planeTiming } from './vegasDay';

/**
 * Pinned MapLibre GL JS build, loaded from a CDN inside the WebView. v5 is the last UMD build with
 * its worker inlined; v6 is ES modules only with a separate worker file, which a WebView page can't
 * load cross-origin.
 */
export const MAPLIBRE_VERSION = '5.24.0';
const CDN = `https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist`;

/** Messages the WebView posts back to React Native. */
export type WebMapMessage =
  | { type: 'ready'; ms: number }
  | { type: 'select'; id: string }
  | { type: 'fps'; fps: number }
  | { type: 'error'; message: string };

/** Commands React Native sends into the WebView (see `commandScript`). */
export type WebMapCommand =
  | { type: 'select'; id: string | null }
  | { type: 'flyTo'; id: string }
  | { type: 'tilt'; on: boolean }
  | { type: 'pins'; count: number };

/** JavaScript for `WebView.injectJavaScript` that runs one command. */
export function commandScript(command: WebMapCommand): string {
  return `window.spike && window.spike.command(${JSON.stringify(command)}); true;`;
}

/** Parses a WebView message; anything unexpected becomes an error message, never a throw. */
export function parseMessage(data: string): WebMapMessage {
  try {
    const msg = JSON.parse(data) as WebMapMessage;
    if (msg && typeof msg.type === 'string') return msg;
  } catch {}
  return { type: 'error', message: `Bad message: ${data.slice(0, 80)}` };
}

function page(body: string, script: string): string {
  return `<!doctype html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<link rel="stylesheet" href="${CDN}/maplibre-gl.css">
<style>
html, body, #map { margin: 0; height: 100%; background: ${mapColors.space}; overflow: hidden; }
.maplibregl-ctrl-attrib { background: ${colors.backdrop} !important; color: ${colors.textSecondary}; font: 10px -apple-system, sans-serif; }
.maplibregl-ctrl-attrib a { color: ${colors.textSecondary}; }
.maplibregl-ctrl-attrib-button { filter: invert(1); }
${body}
</style>
</head><body>
<div id="map"></div>
<script>window.__t0 = performance.now();</script>
<script src="${CDN}/maplibre-gl.js"></script>
<script>
(function () {
  function post(msg) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg));
    else console.log('spike', JSON.stringify(msg));
  }
  window.onerror = function (m) { post({ type: 'error', message: String(m) }); };
  if (!window.maplibregl) { post({ type: 'error', message: 'MapLibre failed to load (offline?)' }); return; }
  var reported = false;
  function onReady(map) {
    map.once('idle', function () {
      if (reported) return;
      reported = true;
      post({ type: 'ready', ms: Math.round(performance.now() - window.__t0) });
    });
    // Only errors before the first frame count: a single failed tile later is routine on a phone.
    map.on('error', function (e) {
      if (!reported) post({ type: 'error', message: String(e && e.error && e.error.message || e) });
    });
  }
  // Frames per second while the map moves (pinch, pan, rotate, fly-to), reported when it stops.
  function trackFps(map) {
    var frames = 0, start = 0, moving = false;
    function tick() { if (!moving) return; frames++; requestAnimationFrame(tick); }
    map.on('movestart', function () { moving = true; frames = 0; start = performance.now(); requestAnimationFrame(tick); });
    map.on('moveend', function () {
      moving = false;
      var s = (performance.now() - start) / 1000;
      if (s > 0.3) post({ type: 'fps', fps: Math.round(frames / s) });
    });
  }
${script}
})();
</script>
</body></html>`;
}

/**
 * The city map page: photo pins (round, white ring, orange when selected), the dashed orange
 * route, tap to select, fly-to, tilt for 3D buildings. All `pins` are embedded; the `pins`
 * command shows the first N (4 or 30).
 */
export function cityHtml(pins: SpikePin[], route: LngLat[], center: LngLat, visible = 4): string {
  const photos = [...new Set(pins.map((p) => p.photo))];
  const data = pins.map((p) => ({
    id: p.id,
    lng: p.lng,
    lat: p.lat,
    photo: photos.indexOf(p.photo),
  }));
  const css = `
.pin { width: 40px; height: 40px; border-radius: 50%; border: 3px solid ${mapColors.pinRing};
  background: ${mapColors.pinFallback} center / cover no-repeat; box-sizing: border-box;
  transition: transform 160ms ease-out, border-color 160ms ease-out; cursor: pointer; }
.pin.selected { border-color: ${mapColors.pinRingSelected}; transform: scale(1.18); }`;
  const script = `
  var PHOTOS = ${JSON.stringify(photos)};
  var PINS = ${JSON.stringify(data)};
  var map = new maplibregl.Map({
    container: 'map', style: ${JSON.stringify(darkStyle())},
    center: [${center.lng}, ${center.lat}], zoom: 13.6, maxPitch: 70,
    attributionControl: { compact: true },
  });
  onReady(map);
  trackFps(map);
  map.on('load', function () {
    map.addSource('route', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: {
      type: 'LineString', coordinates: ${JSON.stringify(route.map((p) => [p.lng, p.lat]))} } } });
    map.addLayer({ id: 'route', type: 'line', source: 'route',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '${mapColors.route}', 'line-width': 3, 'line-dasharray': [1.5, 1.5] } });
  });
  var markers = {}, selected = null, tilted = false;
  PINS.forEach(function (p, i) {
    var el = document.createElement('div');
    el.className = 'pin';
    el.style.backgroundImage = 'url(' + PHOTOS[p.photo] + ')';
    el.addEventListener('click', function (e) { e.stopPropagation(); select(p.id); post({ type: 'select', id: p.id }); });
    markers[p.id] = { el: el, pin: p, marker: new maplibregl.Marker({ element: el }).setLngLat([p.lng, p.lat]) };
  });
  function showPins(count) {
    PINS.forEach(function (p, i) {
      var m = markers[p.id].marker;
      if (i < count) m.addTo(map); else m.remove();
    });
  }
  function select(id) {
    if (selected && markers[selected]) markers[selected].el.classList.remove('selected');
    selected = id;
    if (id && markers[id]) markers[id].el.classList.add('selected');
  }
  showPins(${visible});
  window.spike = { command: function (c) {
    if (c.type === 'select') select(c.id);
    if (c.type === 'pins') showPins(c.count);
    if (c.type === 'tilt') { tilted = c.on; map.easeTo({ pitch: c.on ? 60 : 0, bearing: c.on ? -20 : 0, duration: 800 }); }
    if (c.type === 'flyTo' && markers[c.id]) {
      select(c.id);
      var p = markers[c.id].pin;
      map.flyTo({ center: [p.lng, p.lat], zoom: 16.2, pitch: tilted ? 60 : 0, duration: 1600, essential: true });
    }
  } };`;
  return page(css, script);
}

const PLANE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24"><path fill="${colors.textPrimary}" d="M12 1.5c.9 0 1.5.8 1.5 1.7v5.9l8 4.6v2.1l-8-2.4v5l2.3 1.7v1.7L12 20.9l-3.8.9v-1.7l2.3-1.7v-5l-8 2.4v-2.1l8-4.6V3.2c0-.9.6-1.7 1.5-1.7z"/></svg>`;

/** Frames of the plane along the arc: [lng, lat, heading]. */
export function planeFrames(arc: LngLat[], steps = 420): [number, number, number][] {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const { at, heading } = along(arc, i / steps);
    return [+at.lng.toFixed(5), +at.lat.toFixed(5), Math.round(heading)];
  });
}

/**
 * The flight page: a dark MapLibre globe with the great-circle arc in orange, the two airports,
 * and a plane flying the arc on a loop. Drag to spin the globe.
 */
export function globeHtml(
  arc: LngLat[],
  ends: { lat: number; lng: number; city: string }[],
): string {
  const css = `.plane { width: 26px; height: 26px; pointer-events: none; }`;
  const mid = arc[Math.floor(arc.length / 2)];
  const script = `
  var FRAMES = ${JSON.stringify(planeFrames(arc))};
  var map = new maplibregl.Map({
    container: 'map', style: ${JSON.stringify(darkStyle({ globe: true }))},
    center: [${mid.lng.toFixed(3)}, ${(mid.lat - 4).toFixed(3)}], zoom: 1.7,
    attributionControl: { compact: true },
  });
  onReady(map);
  map.on('load', function () {
    map.addSource('arc', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: {
      type: 'LineString', coordinates: ${JSON.stringify(arc.map((p) => [+p.lng.toFixed(4), +p.lat.toFixed(4)]))} } } });
    map.addLayer({ id: 'arc', type: 'line', source: 'arc', layout: { 'line-cap': 'round' },
      paint: { 'line-color': '${mapColors.route}', 'line-width': 2.5 } });
    map.addSource('ends', { type: 'geojson', data: { type: 'FeatureCollection', features: ${JSON.stringify(
      ends.map((e) => ({
        type: 'Feature',
        properties: { city: e.city },
        geometry: { type: 'Point', coordinates: [e.lng, e.lat] },
      })),
    )} } });
    map.addLayer({ id: 'ends', type: 'circle', source: 'ends', paint: {
      'circle-radius': 5, 'circle-color': '${mapColors.route}',
      'circle-stroke-color': '${mapColors.pinRing}', 'circle-stroke-width': 1.5 } });
    map.addLayer({ id: 'ends-label', type: 'symbol', source: 'ends', layout: {
      'text-field': ['get', 'city'], 'text-font': ['Noto Sans Bold'], 'text-size': 13,
      'text-offset': [0, 1.2], 'text-anchor': 'top' },
      paint: { 'text-color': '${mapColors.label}', 'text-halo-color': '${mapColors.labelHalo}', 'text-halo-width': 1.4 } });
  });
  var el = document.createElement('div');
  el.className = 'plane';
  el.innerHTML = ${JSON.stringify(PLANE_SVG)};
  var plane = new maplibregl.Marker({ element: el, rotationAlignment: 'map', pitchAlignment: 'map' })
    .setLngLat([FRAMES[0][0], FRAMES[0][1]]).addTo(map);
  // The plane flies the arc, waits at the gate, repeats. Also the page's frame rate, drags included.
  var start = performance.now(), frames = 0, last = start;
  function fly(now) {
    var t = (Math.max(0, now - start) % ${planeTiming.loopMs}) / ${planeTiming.flightMs};
    var f = FRAMES[Math.min(FRAMES.length - 1, Math.floor(Math.min(t, 1) * (FRAMES.length - 1)))];
    plane.setLngLat([f[0], f[1]]).setRotation(f[2]);
    frames++;
    if (now - last > 2000) { post({ type: 'fps', fps: Math.round(frames * 1000 / (now - last)) }); frames = 0; last = now; }
    requestAnimationFrame(fly);
  }
  requestAnimationFrame(fly);
  window.spike = { command: function () {} };`;
  return page(css, script);
}
