import { fromZonedTime } from 'date-fns-tz';

import { dayLabel, timeLabel } from '@/core/dates';
import type { FlightData, LocalDateTime, PassCrop, PassImage } from '@/services/data/types';

/** `Thu, Nov 12` and `9:05 AM`, in the airport's own local time (never the phone's). */
export function localLabels(at: LocalDateTime): { day: string; time: string } {
  return { day: dayLabel(at.date), time: timeLabel(at.time) };
}

/** The facts row under the route: only the fields the booking has. */
export function flightFacts(flight: FlightData): { label: string; value: string }[] {
  const facts: [string, string | null][] = [
    ['Terminal', flight.terminal],
    ['Gate', flight.gate],
    ['Seat', flight.seat],
    ['Class', flight.cabin],
  ];
  return facts.flatMap(([label, value]) => (value ? [{ label, value }] : []));
}

/** The instant a local wall-clock time happens. */
export function instantOf(at: LocalDateTime): Date {
  return fromZonedTime(`${at.date}T${at.time}:00`, at.timezone);
}

export interface FlightCalendarEvent {
  title: string;
  startDate: Date;
  endDate: Date;
  timeZone: string;
  location: string;
  notes: string;
}

/** What "Add to calendar" saves: departure to arrival, with the details you need at the airport. */
export function flightCalendarEvent(flight: FlightData): FlightCalendarEvent {
  const notes = [
    `Confirmation ${flight.confirmation}`,
    flight.terminal ? `Terminal ${flight.terminal}` : null,
    flight.gate ? `Gate ${flight.gate}` : null,
    flight.seat ? `Seat ${flight.seat}` : null,
  ];
  return {
    title: `${flight.flightNumber} to ${flight.to.city}`,
    startDate: instantOf(flight.departs),
    endDate: instantOf(flight.arrives),
    timeZone: flight.departs.timezone,
    location: `${flight.from.city} (${flight.from.code})`,
    notes: notes.filter(Boolean).join('\n'),
  };
}

/** The smallest code area, as a fraction of the image, so the rectangle stays grabbable. */
export const MIN_CROP = 0.08;

/** Where a newly added pass's code area starts: the middle of the lower half, where codes sit. */
export const DEFAULT_CROP: PassCrop = { x: 0.15, y: 0.45, width: 0.7, height: 0.4 };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Keeps a crop inside the image and at least `MIN_CROP` in each direction. */
export function clampCrop(crop: PassCrop): PassCrop {
  const width = clamp(crop.width, MIN_CROP, 1);
  const height = clamp(crop.height, MIN_CROP, 1);
  return {
    x: clamp(crop.x, 0, 1 - width),
    y: clamp(crop.y, 0, 1 - height),
    width,
    height,
  };
}

/** The crop dragged by a fraction of the image: it slides, stopping at the edges. */
export function moveCrop(crop: PassCrop, dx: number, dy: number): PassCrop {
  return clampCrop({ ...crop, x: crop.x + dx, y: crop.y + dy });
}

/** The crop's bottom-right corner dragged: it grows or shrinks, stopping at the image's edges. */
export function resizeCrop(crop: PassCrop, dx: number, dy: number): PassCrop {
  return clampCrop({
    ...crop,
    width: Math.min(crop.width + dx, 1 - crop.x),
    height: Math.min(crop.height + dy, 1 - crop.y),
  });
}

/**
 * How to draw a crop of `image` at `width` points wide: the visible frame's size, and the whole
 * image's size and offset inside it (the frame clips the rest).
 */
export function cropLayout(crop: PassCrop, image: PassImage, width: number) {
  const imageWidth = width / crop.width;
  const imageHeight = imageWidth * (image.height / image.width);
  return {
    frame: { width, height: imageHeight * crop.height },
    image: {
      width: imageWidth,
      height: imageHeight,
      left: -crop.x * imageWidth,
      top: -crop.y * imageHeight,
    },
  };
}
