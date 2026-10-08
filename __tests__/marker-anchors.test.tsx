import { render, screen } from '@testing-library/react-native';
import { readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';
import { StyleSheet } from 'react-native';
import type { ReactTestInstance } from 'react-test-renderer';

import { flight } from '@/features/map/globe';
import { AppleGlobe } from '@/features/map/globe/AppleGlobe';
import { GlobeDot } from '@/features/map/globe/GlobeDot';
import { anchorOnScreen } from '@/features/map/markerAnchor';
import { PinMarker } from '@/features/map/PinMarker';
import type { MapPin } from '@/features/map/types';

// TR-23 QA round 2: on a real iPhone the globe's dots sat about half a label to the right of
// their place. iOS sizes a marker from its first native subview, and the new architecture
// flattens a plain layout View, so a marker's content must be one non-collapsable box of a known
// size, and centerOffset must put the anchor (the dot's centre) on the coordinate.

type Instance = ReactTestInstance;

/** The native view a component renders (skips function components). */
function host(node: Instance): Instance {
  let at = node;
  while (typeof at.type !== 'string') at = at.children[0] as Instance;
  return at;
}

/** The marker's single content box, checked the way iOS will lay it out. */
function nativeBox(marker: Instance) {
  const children = marker.children.filter((c): c is Instance => typeof c !== 'string');
  expect(children).toHaveLength(1);
  const box = host(children[0]);
  expect(box.props.collapsable).toBe(false);
  const style = StyleSheet.flatten(box.props.style) as { width: number; height: number };
  expect(typeof style.width).toBe('number');
  expect(typeof style.height).toBe('number');
  return { box, size: { width: style.width, height: style.height } };
}

/** The anchor view's centre inside the box: boxes stack from the top, centred across. */
function anchorOf(size: { width: number }, dot: Instance) {
  const dotStyle = StyleSheet.flatten(dot.props.style) as { width: number; height: number };
  return { x: size.width / 2, y: dotStyle.height / 2 };
}

const pin = (extra: Partial<MapPin> = {}): MapPin => ({
  id: 'p1',
  coordinate: { lat: 36.1, lng: -115.2 },
  kind: 'food',
  photo: null,
  label: 'Dinner at Carbone',
  ...extra,
});

describe('globe dots', () => {
  it('puts the dot, not the label box, on the place', () => {
    render(<GlobeDot coordinate={{ lat: -33.9, lng: 18.4 }} label="Cape Town" testID="dot" />);
    const marker = screen.getByTestId('dot');
    const { box, size } = nativeBox(marker);
    const dot = host(box.children[0] as Instance);
    const anchor = anchorOf(size, dot);
    expect(anchorOnScreen(size, marker.props.centerOffset, anchor)).toEqual({ x: 0, y: 0 });
  });

  it('draws both airports and the plane of the flight globe with real boxes', () => {
    render(<AppleGlobe route={flight} />);
    for (const code of [flight.from.code, flight.to.code]) {
      const marker = screen.getByTestId(`globe-end-${code}`);
      const { box, size } = nativeBox(marker);
      const anchor = anchorOf(size, host(box.children[0] as Instance));
      expect(anchorOnScreen(size, marker.props.centerOffset, anchor)).toEqual({ x: 0, y: 0 });
    }
    const plane = screen.getByTestId('globe-plane');
    const { size } = nativeBox(plane);
    // The plane is centred in its box: no offset.
    expect(plane.props.centerOffset ?? { x: 0, y: 0 }).toEqual({ x: 0, y: 0 });
    expect(size.width).toBe(size.height);
  });
});

describe('Plan pins', () => {
  it.each([
    ['symbol', pin(), false, false],
    ['photo', pin({ photo: 'https://example.com/a.jpg' }), false, false],
    ['outline', pin({ outlined: true }), false, false],
    ['dot', pin(), false, true],
    ['selected', pin(), true, false],
    ['selected photo', pin({ photo: 'https://example.com/a.jpg' }), true, false],
  ])('keeps the %s pin centred on its place', (_name, p, selected, dimmed) => {
    render(<PinMarker pin={p} selected={selected} dimmed={dimmed} />);
    const marker = screen.getByTestId('pin-p1');
    const { box, size } = nativeBox(marker);
    const anchor = anchorOf(size, host(box.children[0] as Instance));
    expect(anchorOnScreen(size, marker.props.centerOffset, anchor)).toEqual({ x: 0, y: 0 });
  });
});

describe('every custom marker in src/', () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name.endsWith('.tsx') && !name.endsWith('.test.tsx')) files.push(full);
    }
  };
  walk(path.join(__dirname, '..', 'src'));

  it('wraps its view in MarkerBox', () => {
    const offenders = files.filter((file) => {
      const source = readFileSync(file, 'utf8');
      // A <Marker …> that is not self-closing has a custom view.
      const opened = /<Marker\b[^>]*[^/]>/s.test(source);
      return opened && !source.includes('<MarkerBox');
    });
    expect(offenders).toEqual([]);
  });
});
