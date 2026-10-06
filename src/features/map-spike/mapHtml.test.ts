import { flight, spikePins, vegasCenter, vegasRoute } from './vegasDay';
import { greatCircle } from './geo';
import {
  cityHtml,
  commandScript,
  globeHtml,
  MAPLIBRE_VERSION,
  parseMessage,
  planeFrames,
} from './mapHtml';

describe('cityHtml', () => {
  const html = cityHtml(spikePins(30), vegasRoute, vegasCenter);

  it('loads the pinned MapLibre build and our dark style', () => {
    expect(html).toContain(`maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.js`);
    expect(html).toContain('tiles.openfreemap.org/planet');
    expect(html).toContain("'line-dasharray'");
  });

  it('embeds each photo once and all 30 pins, showing 4 at first', () => {
    expect(html.match(/data:image\/jpeg;base64,/g)).toHaveLength(4);
    expect(html.match(/"photo":\d/g)).toHaveLength(30);
    expect(html).toContain('showPins(4)');
  });
});

describe('globeHtml', () => {
  it('draws the arc with the globe projection and a plane', () => {
    const arc = greatCircle(flight.from, flight.to);
    const html = globeHtml(arc, [flight.from, flight.to]);
    expect(html).toContain('"projection":{"type":"globe"}');
    expect(html).toContain('Tampa');
    expect(html).toContain('Las Vegas');
    expect(html).toContain("el.className = 'plane'");
  });

  it('precomputes plane frames from Tampa to Las Vegas', () => {
    const frames = planeFrames(greatCircle(flight.from, flight.to), 10);
    expect(frames).toHaveLength(11);
    expect(frames[0][0]).toBeCloseTo(flight.from.lng, 3);
    expect(frames[10][1]).toBeCloseTo(flight.to.lat, 3);
  });
});

describe('bridge', () => {
  it('wraps commands for injectJavaScript', () => {
    expect(commandScript({ type: 'flyTo', id: 'sphere' })).toBe(
      'window.spike && window.spike.command({"type":"flyTo","id":"sphere"}); true;',
    );
  });

  it('parses messages and never throws on junk', () => {
    expect(parseMessage('{"type":"ready","ms":420}')).toEqual({ type: 'ready', ms: 420 });
    expect(parseMessage('nope')).toMatchObject({ type: 'error' });
    expect(parseMessage('null')).toMatchObject({ type: 'error' });
  });
});
