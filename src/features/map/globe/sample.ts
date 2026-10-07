import type { GlobeRoute } from './AppleGlobe';

export { planeTiming } from '@/core/flights';

/**
 * The sample flight from the TR-5 spike: Tampa to Las Vegas (TPA → LAS). The Plan tab's flight
 * globe shows the trip's real flights; this is the default when no route is given.
 */
export const flight: GlobeRoute = {
  from: { lat: 27.9755, lng: -82.5332, code: 'TPA', city: 'Tampa' },
  to: { lat: 36.084, lng: -115.1537, code: 'LAS', city: 'Las Vegas' },
};
