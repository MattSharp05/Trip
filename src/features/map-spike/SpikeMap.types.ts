import type { Ref } from 'react';

import type { SpikePin } from './types';

/** What the spike screen can do to either city map (the future `TripMap` interface, ADR 0002). */
export interface SpikeMapHandle {
  flyTo: (id: string) => void;
  tilt: (on: boolean) => void;
}

export interface SpikeMapProps {
  pins: SpikePin[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** The map has drawn its first frame. */
  onReady: () => void;
  /** Frames per second over the last gesture or fly-to, where the renderer can measure it. */
  onFps?: (fps: number) => void;
  onError?: (message: string) => void;
  ref?: Ref<SpikeMapHandle>;
}
