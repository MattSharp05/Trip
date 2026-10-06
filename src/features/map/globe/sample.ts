/** The plane flies the arc in `flightMs`, then waits at the gate until `loopMs`. */
export const planeTiming = { flightMs: 7000, loopMs: 8000 } as const;

/**
 * The sample flight from the TR-5 spike: Tampa to Las Vegas (TPA → LAS). TR-23 replaces it with
 * the trip's real flights.
 */
export const flight = {
  from: { lat: 27.9755, lng: -82.5332, code: 'TPA', city: 'Tampa' },
  to: { lat: 36.084, lng: -115.1537, code: 'LAS', city: 'Las Vegas' },
} as const;
