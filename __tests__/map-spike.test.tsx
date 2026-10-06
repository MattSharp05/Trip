import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import TabLayout from '../app/(tabs)/_layout';
import TripsScreen from '../app/(tabs)/trips/index';
import GalleryScreen from '../app/dev/gallery';
import MapSpikeScreen from '../app/dev/map-spike';
import RootLayout from '../app/_layout';

// Native maps don't render in Jest: stand-ins that record camera calls and expose marker presses.
const mockCamera: unknown[] = [];
const mockInjected: string[] = [];

jest.mock('react-native-maps', () => {
  const { View: MockView } = jest.requireActual('react-native');
  const { useEffect: useMockEffect, useImperativeHandle } = jest.requireActual('react');
  function MapView({ children, onMapReady, testID, ref }: any) {
    useImperativeHandle(ref, () => ({ animateCamera: (c: unknown) => mockCamera.push(c) }));
    useMockEffect(() => onMapReady?.(), [onMapReady]);
    return <MockView testID={testID}>{children}</MockView>;
  }
  const Marker = ({ children, onPress, accessibilityLabel }: any) => (
    <MockView accessible accessibilityLabel={accessibilityLabel} onTouchEnd={onPress}>
      {children}
    </MockView>
  );
  const Polyline = () => <MockView testID="polyline" />;
  return { __esModule: true, default: MapView, Marker, Polyline };
});

jest.mock('react-native-webview', () => {
  const { View: MockView } = jest.requireActual('react-native');
  const { useImperativeHandle } = jest.requireActual('react');
  function WebView({ testID, onMessage, ref }: any) {
    useImperativeHandle(ref, () => ({ injectJavaScript: (js: string) => mockInjected.push(js) }));
    return (
      <MockView
        testID={testID}
        onTouchEnd={(e: any) => onMessage({ nativeEvent: { data: e.data } })}
      />
    );
  }
  return { WebView };
});

const routes = {
  _layout: RootLayout,
  '(tabs)/_layout': TabLayout,
  '(tabs)/trips/index': TripsScreen,
  'dev/gallery': GalleryScreen,
  'dev/map-spike': MapSpikeScreen,
};

const message = (testID: string, data: object) =>
  fireEvent(screen.getByTestId(testID), 'touchEnd', { data: JSON.stringify(data) });

beforeEach(() => {
  mockCamera.length = 0;
  mockInjected.length = 0;
});

describe('map spike', () => {
  it('opens from Trips', async () => {
    const router = renderRouter(routes, { initialUrl: '/trips' });
    fireEvent.press(await screen.findByRole('button', { name: 'Map spike' }));
    expect(router.getPathname()).toBe('/dev/map-spike');
    await act(async () => {});
  });

  it('A: shows the four photo pins, selects one and flies to a stop', async () => {
    renderRouter(routes, { initialUrl: '/dev/map-spike' });
    expect(await screen.findByTestId('apple-map')).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'A · Apple Maps' })).toBeSelected();
    expect(screen.getByText(/^Ready in/)).toBeOnTheScreen();
    expect(screen.getAllByLabelText(/at |Fountains|Experience/)).toHaveLength(4);

    fireEvent(screen.getByLabelText('Sphere Experience'), 'touchEnd');
    expect(screen.getByText('Sphere Experience · 3:00 PM')).toBeOnTheScreen();

    fireEvent.press(screen.getByRole('button', { name: '8:00 PM' }));
    expect(screen.getByText('Dinner at Carbone · 8:00 PM')).toBeOnTheScreen();
    expect(mockCamera).toHaveLength(1);
    expect(mockCamera[0]).toMatchObject({ center: { latitude: 36.1074, longitude: -115.1767 } });

    fireEvent.press(screen.getByRole('button', { name: '3D' }));
    expect(mockCamera[1]).toMatchObject({ pitch: 60 });

    fireEvent.press(screen.getByRole('button', { name: '30 pins' }));
    expect(screen.getAllByLabelText(/Saved place/)).toHaveLength(26);
  });

  it('B: drives MapLibre through the bridge and shows its numbers', async () => {
    renderRouter(routes, { initialUrl: '/dev/map-spike' });
    fireEvent.press(await screen.findByRole('tab', { name: 'B · MapLibre' }));
    expect(screen.getByText('Loading map')).toBeOnTheScreen();

    message('maplibre-map', { type: 'ready', ms: 900 });
    message('maplibre-map', { type: 'fps', fps: 58 });
    expect(screen.getByText(/^Ready in .* · 58 fps last move$/)).toBeOnTheScreen();

    message('maplibre-map', { type: 'select', id: 'fountains' });
    expect(screen.getByText('Bellagio Fountains · 12:00 PM')).toBeOnTheScreen();
    expect(mockInjected.at(-1)).toContain('"type":"select","id":"fountains"');

    fireEvent.press(screen.getByRole('button', { name: '10:00 AM' }));
    expect(mockInjected.some((js) => js.includes('"type":"flyTo","id":"brunch"'))).toBe(true);

    fireEvent.press(screen.getByRole('button', { name: '30 pins' }));
    expect(mockInjected.at(-1)).toContain('"type":"pins","count":30');

    message('maplibre-map', { type: 'error', message: 'MapLibre failed to load (offline?)' });
    expect(screen.getByText('Error: MapLibre failed to load (offline?)')).toBeOnTheScreen();
  });

  it('Globe: MapLibre by default, Apple flyover on request', async () => {
    renderRouter(routes, { initialUrl: '/dev/map-spike' });
    fireEvent.press(await screen.findByRole('tab', { name: 'Globe' }));
    expect(screen.getByTestId('maplibre-globe')).toBeOnTheScreen();
    expect(screen.getByText('Tampa to Las Vegas. Drag to spin the globe.')).toBeOnTheScreen();

    fireEvent.press(screen.getByRole('tab', { name: 'Apple' }));
    expect(screen.getByTestId('apple-globe')).toBeOnTheScreen();
    expect(screen.getByText(/^Ready in/)).toBeOnTheScreen();
  });

  it('is hidden when dev tools are off', async () => {
    process.env.EXPO_PUBLIC_SCENARIOS = 'off';
    try {
      const router = renderRouter(routes, { initialUrl: '/dev/map-spike' });
      expect(await screen.findByRole('header', { name: 'Trips' })).toBeOnTheScreen();
      expect(router.getPathname()).toBe('/trips');
    } finally {
      delete process.env.EXPO_PUBLIC_SCENARIOS;
    }
  });
});
