import { useEffect, useImperativeHandle, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { colors } from '@/theme';

import { commandScript, parseMessage, type WebMapCommand } from './mapHtml';
import type { SpikeMapProps } from './SpikeMap.types';

interface WebSpikeMapProps extends SpikeMapProps {
  /** The page from `cityHtml` or `globeHtml`. Build it once; a new string reloads the map. */
  html: string;
  testID?: string;
}

/** Option B (and the flight globe): MapLibre GL JS in a WebView, driven through a small bridge. */
export function WebSpikeMap({
  html,
  pins,
  selectedId,
  onSelect,
  onReady,
  onFps,
  onError,
  ref,
  testID = 'maplibre-map',
}: WebSpikeMapProps) {
  const web = useRef<WebView>(null);
  const send = (command: WebMapCommand) => {
    web.current?.injectJavaScript(commandScript(command));
  };

  useImperativeHandle(ref, () => ({
    flyTo: (id) => send({ type: 'flyTo', id }),
    tilt: (on) => send({ type: 'tilt', on }),
  }));

  // Commands sent before the page has loaded are dropped, so the ready message replays the state.
  useEffect(() => {
    send({ type: 'pins', count: pins.length });
  }, [pins.length]);
  useEffect(() => {
    send({ type: 'select', id: selectedId });
  }, [selectedId]);

  const onMessage = (event: WebViewMessageEvent) => {
    const msg = parseMessage(event.nativeEvent.data);
    if (msg.type === 'ready') {
      send({ type: 'pins', count: pins.length });
      send({ type: 'select', id: selectedId });
      onReady();
    }
    if (msg.type === 'select') onSelect(msg.id);
    if (msg.type === 'fps') onFps?.(msg.fps);
    if (msg.type === 'error') onError?.(msg.message);
  };

  return (
    <WebView
      ref={web}
      testID={testID}
      source={{ html }}
      originWhitelist={['*']}
      onMessage={onMessage}
      style={styles.web}
      containerStyle={styles.web}
      scrollEnabled={false}
      bounces={false}
      overScrollMode="never"
      webviewDebuggingEnabled={__DEV__}
    />
  );
}

const styles = StyleSheet.create({
  web: { flex: 1, backgroundColor: colors.background },
});
