import { vegasSnapshot } from '@/scenarios/fixtures/vegas';
import type { FlightData } from '@/services/data/types';

import {
  clampCrop,
  cropLayout,
  flightCalendarEvent,
  flightFacts,
  localLabels,
  MIN_CROP,
  moveCrop,
  resizeCrop,
} from './flightInfo';

const outbound = vegasSnapshot.bookings.find((b) => b.id === 'booking-flight-out')!
  .data as FlightData;

describe('flight info', () => {
  it("labels times in each airport's own local time", () => {
    expect(localLabels(outbound.departs)).toEqual({ day: 'Thu, Nov 12', time: '9:05 AM' });
    expect(localLabels(outbound.arrives)).toEqual({ day: 'Thu, Nov 12', time: '11:02 AM' });
  });

  it('lists only the facts the booking has', () => {
    expect(flightFacts(outbound)).toEqual([
      { label: 'Terminal', value: 'E' },
      { label: 'Gate', value: 'E75' },
      { label: 'Seat', value: '14A' },
      { label: 'Class', value: 'Main' },
    ]);
    expect(flightFacts({ ...outbound, terminal: null, cabin: null }).map((f) => f.label)).toEqual([
      'Gate',
      'Seat',
    ]);
  });

  it('builds a calendar event at the real departure and arrival instants', () => {
    const event = flightCalendarEvent(outbound);
    expect(event.title).toBe('AA 2410 to Las Vegas');
    // 9:05 AM in Tampa (EST) and 11:02 AM in Las Vegas (PST).
    expect(event.startDate.toISOString()).toBe('2026-11-12T14:05:00.000Z');
    expect(event.endDate.toISOString()).toBe('2026-11-12T19:02:00.000Z');
    expect(event.location).toBe('Tampa (TPA)');
    expect(event.notes).toBe('Confirmation KXJ4PL\nTerminal E\nGate E75\nSeat 14A');
  });

  it('keeps a crop inside the image and above the minimum size', () => {
    expect(clampCrop({ x: 0.9, y: -0.2, width: 0.5, height: 0.01 })).toEqual({
      x: 0.5,
      y: 0,
      width: 0.5,
      height: MIN_CROP,
    });
    expect(clampCrop({ x: 0, y: 0, width: 2, height: 1 })).toEqual({
      x: 0,
      y: 0,
      width: 1,
      height: 1,
    });
  });

  it('moves a crop up to the edges and resizes it without shifting it', () => {
    const crop = { x: 0.5, y: 0.5, width: 0.5, height: 0.25 };
    expect(moveCrop(crop, 0.2, -0.1)).toEqual({ x: 0.5, y: 0.4, width: 0.5, height: 0.25 });
    // Dragging the corner past the right edge stops at it; the left side stays put.
    expect(resizeCrop(crop, 0.2, 0.1)).toEqual({ x: 0.5, y: 0.5, width: 0.5, height: 0.35 });
    expect(resizeCrop(crop, -1, 0)).toEqual({ x: 0.5, y: 0.5, width: MIN_CROP, height: 0.25 });
  });

  it('lays out a crop so only the code area shows', () => {
    const image = { uri: 'x', width: 1000, height: 2000 };
    const layout = cropLayout({ x: 0.25, y: 0.5, width: 0.5, height: 0.25 }, image, 200);
    expect(layout.image).toEqual({ width: 400, height: 800, left: -100, top: -400 });
    expect(layout.frame).toEqual({ width: 200, height: 200 });
  });
});
