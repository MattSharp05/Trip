import { useCallback, useEffect, useRef, type RefObject } from 'react';
import type MapView from 'react-native-maps';

import type { LngLat } from '../types';
import { spin, spinLng } from './spin';

export interface GlobeSpin {
  /** Spread onto a View wrapping the map: a finger on the globe stops the spin. */
  touchHandlers: {
    onTouchStart: () => void;
    onTouchEnd: () => void;
    onTouchCancel: () => void;
  };
}

/**
 * Turns the globe slowly by moving the camera from JS while `active` (map ready, Reduce Motion
 * off, screen in view). A finger on the globe stops it; after the finger lifts and the drag
 * settles, it carries on from wherever the user left the globe.
 */
export function useGlobeSpin(
  map: RefObject<MapView | null>,
  start: LngLat,
  active: boolean,
): GlobeSpin {
  const center = useRef(start);
  const touching = useRef(false);
  const resume = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!active) return;
    let last = Date.now();
    const id = setInterval(() => {
      const at = Date.now();
      const elapsed = at - last;
      last = at;
      if (touching.current) return;
      const { lat, lng } = center.current;
      center.current = { lat, lng: spinLng(lng, elapsed) };
      map.current?.setCamera({
        center: { latitude: lat, longitude: center.current.lng },
      });
    }, 1000 / spin.fps);
    return () => clearInterval(id);
  }, [active, map]);

  useEffect(() => () => clearTimeout(resume.current), []);

  const onTouchStart = useCallback(() => {
    touching.current = true;
    clearTimeout(resume.current);
  }, []);

  const onTouchEnd = useCallback(() => {
    clearTimeout(resume.current);
    resume.current = setTimeout(async () => {
      try {
        const camera = await map.current?.getCamera();
        if (camera) center.current = { lat: camera.center.latitude, lng: camera.center.longitude };
      } catch {
        // Keep the last known centre; the globe just jumps back a little.
      }
      touching.current = false;
    }, spin.resumeAfterMs);
  }, [map]);

  return { touchHandlers: { onTouchStart, onTouchEnd, onTouchCancel: onTouchEnd } };
}
