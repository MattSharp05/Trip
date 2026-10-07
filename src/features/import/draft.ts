import { DEFAULT_TIME } from '@/core/bookingMapping';

import {
  parsedBookingSchema,
  type ParsedBooking,
  type ParsedBookingType,
  type ParsedLocation,
  type When,
} from '../../../supabase/functions/_shared/parse/schema';

/**
 * The review screen's form (TR-25): every field of the parsed booking as an editable string,
 * keyed by its path in the booking (`hotel.name`, `legs.0.departs.time`). Saving writes the strings
 * back onto the booking and validates it with the shared schema.
 */

export type FieldKind = 'text' | 'date' | 'time' | 'code' | 'amount' | 'currency' | 'count';

export interface FieldDef {
  path: string;
  label: string;
  kind: FieldKind;
  /** Section heading the field starts, e.g. "Flight 2". */
  section?: string;
}

export type Values = Record<string, string>;

export interface Draft {
  /** The booking the form edits: carries what has no field (coordinates, country). */
  base: ParsedBooking;
  values: Values;
  /** Paths to double-check: the model's doubts plus times the booking left out. */
  uncertain: string[];
}

export const TYPE_OPTIONS: readonly { value: ParsedBookingType; label: string }[] = [
  { value: 'flight', label: 'Flight' },
  { value: 'hotel', label: 'Hotel' },
  { value: 'car', label: 'Car' },
  { value: 'ticket', label: 'Ticket' },
  { value: 'reservation', label: 'Table' },
];

const PRICE: FieldDef[] = [
  { path: 'price.amount', label: 'Price', kind: 'amount', section: 'Price' },
  { path: 'price.currency', label: 'Currency', kind: 'currency' },
];

const place = (prefix: string, name: string, section?: string): FieldDef[] => [
  { path: `${prefix}.name`, label: name, kind: 'text', section },
  { path: `${prefix}.address`, label: 'Address', kind: 'text' },
  { path: `${prefix}.city`, label: 'City', kind: 'text' },
];

const when = (prefix: string, label: string): FieldDef[] => [
  { path: `${prefix}.date`, label: `${label} date`, kind: 'date' },
  { path: `${prefix}.time`, label: `${label} time`, kind: 'time' },
];

/** The fields a booking shows, in order. */
export function fieldsFor(booking: ParsedBooking): FieldDef[] {
  switch (booking.type) {
    case 'flight':
      return [
        { path: 'confirmation', label: 'Confirmation', kind: 'text', section: 'Booking' },
        { path: 'passenger', label: 'Passenger', kind: 'text' },
        ...booking.legs.flatMap((_leg, i): FieldDef[] => [
          {
            path: `legs.${i}.flightNumber`,
            label: 'Flight number',
            kind: 'text',
            section: booking.legs.length > 1 ? `Flight ${i + 1}` : 'Flight',
          },
          { path: `legs.${i}.airline`, label: 'Airline', kind: 'text' },
          { path: `legs.${i}.from.code`, label: 'From (airport code)', kind: 'code' },
          { path: `legs.${i}.to.code`, label: 'To (airport code)', kind: 'code' },
          { path: `legs.${i}.to.city`, label: 'Arriving in', kind: 'text' },
          ...when(`legs.${i}.departs`, 'Departure'),
          ...when(`legs.${i}.arrives`, 'Arrival'),
          { path: `legs.${i}.seat`, label: 'Seat', kind: 'text' },
        ]),
        ...PRICE,
      ];
    case 'hotel':
      return [
        ...place('hotel', 'Hotel', 'Hotel'),
        ...when('checkIn', 'Check-in'),
        ...when('checkOut', 'Check-out'),
        { path: 'room', label: 'Room', kind: 'text' },
        { path: 'confirmation', label: 'Confirmation', kind: 'text' },
        ...PRICE,
      ];
    case 'car':
      return [
        { path: 'company', label: 'Company', kind: 'text', section: 'Rental car' },
        ...place('pickupLocation', 'Pick-up location'),
        ...when('pickup', 'Pick-up'),
        ...when('dropoff', 'Return'),
        { path: 'vehicle', label: 'Car', kind: 'text' },
        { path: 'confirmation', label: 'Confirmation', kind: 'text' },
        ...PRICE,
      ];
    case 'ticket':
      return [
        { path: 'event', label: 'Event', kind: 'text', section: 'Ticket' },
        ...place('venue', 'Venue'),
        ...when('starts', 'Start'),
        { path: 'section', label: 'Section', kind: 'text' },
        { path: 'row', label: 'Row', kind: 'text' },
        { path: 'seats', label: 'Seats', kind: 'text' },
        { path: 'confirmation', label: 'Confirmation', kind: 'text' },
        ...PRICE,
      ];
    case 'reservation':
      return [
        ...place('venue', 'Restaurant', 'Reservation'),
        ...when('starts', 'Reservation'),
        { path: 'partySize', label: 'Guests', kind: 'count' },
        { path: 'confirmation', label: 'Confirmation', kind: 'text' },
        ...PRICE,
      ];
  }
}

/** Reads a value at a dotted path (`legs.0.to.code`). */
export function getAt(value: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (v, key) =>
        v !== null && typeof v === 'object' ? (v as Record<string, unknown>)[key] : undefined,
      value,
    );
}

/** A copy of `value` with `path` set, creating objects on the way. */
export function setAt<T>(value: T, path: string, next: unknown): T {
  const [key, ...rest] = path.split('.');
  const container: Record<string, unknown> | unknown[] = Array.isArray(value)
    ? [...value]
    : { ...((value ?? {}) as Record<string, unknown>) };
  const current = (container as Record<string, unknown>)[key];
  (container as Record<string, unknown>)[key] = rest.length
    ? setAt(current, rest.join('.'), next)
    : next;
  return container as T;
}

/** The time a missing one starts as on the form (and in the plan). */
function defaultTime(path: string): string {
  if (path.startsWith('checkIn')) return DEFAULT_TIME.checkIn;
  if (path.startsWith('checkOut')) return DEFAULT_TIME.checkOut;
  return DEFAULT_TIME.other;
}

const toText = (v: unknown) => (typeof v === 'number' ? String(v) : typeof v === 'string' ? v : '');

/** The form for a parsed booking. Missing times get a default and are flagged to check. */
export function draftFrom(booking: ParsedBooking, uncertain: readonly string[] = []): Draft {
  const flagged = new Set(uncertain);
  const values: Values = {};
  for (const field of fieldsFor(booking)) {
    const raw = getAt(booking, field.path);
    if (field.kind === 'time' && (raw === null || raw === undefined)) {
      values[field.path] = defaultTime(field.path);
      flagged.add(field.path);
    } else {
      values[field.path] = toText(raw);
    }
  }
  return { base: booking, values, uncertain: [...flagged] };
}

const emptyPlace = (name = ''): ParsedLocation => ({
  name,
  address: null,
  city: null,
  country: null,
  lat: null,
  lng: null,
});

/** The common parts of any booking: what survives a type switch. */
function essentials(b: ParsedBooking): {
  name: string;
  place: ParsedLocation;
  start: When;
  end: When;
  confirmation: string | null;
  price: ParsedBooking['price'];
} {
  const common = { confirmation: b.confirmation, price: b.price };
  switch (b.type) {
    case 'flight': {
      const first = b.legs[0];
      const last = b.legs[b.legs.length - 1];
      return {
        ...common,
        name: first.airline,
        place: {
          ...emptyPlace(first.to.city ?? first.to.code),
          city: first.to.city,
          country: first.to.country,
          lat: first.to.lat,
          lng: first.to.lng,
        },
        start: first.departs,
        end: last.arrives,
      };
    }
    case 'hotel':
      return { ...common, name: b.hotel.name, place: b.hotel, start: b.checkIn, end: b.checkOut };
    case 'car':
      return {
        ...common,
        name: b.company,
        place: b.pickupLocation,
        start: b.pickup,
        end: b.dropoff,
      };
    case 'ticket':
      return { ...common, name: b.event, place: b.venue, start: b.starts, end: b.starts };
    case 'reservation':
      return { ...common, name: b.venue.name, place: b.venue, start: b.starts, end: b.starts };
  }
}

/** The same booking as another type, keeping its name, place, dates, confirmation and price. */
export function convertBooking(b: ParsedBooking, type: ParsedBookingType): ParsedBooking {
  if (b.type === type) return b;
  const e = essentials(b);
  switch (type) {
    case 'flight':
      return {
        type,
        confirmation: e.confirmation,
        passenger: null,
        legs: [
          {
            airline: e.name,
            airlineCode: null,
            flightNumber: '',
            from: { code: '', city: null, country: null, lat: null, lng: null },
            to: {
              code: '',
              city: e.place.city,
              country: e.place.country,
              lat: e.place.lat,
              lng: e.place.lng,
            },
            departs: e.start,
            arrives: e.end,
            terminal: null,
            gate: null,
            seat: null,
            cabin: null,
          },
        ],
        price: e.price,
      };
    case 'hotel':
      return {
        type,
        hotel: e.place,
        checkIn: e.start,
        checkOut: e.end,
        confirmation: e.confirmation,
        room: null,
        phone: null,
        website: null,
        email: null,
        price: e.price,
      };
    case 'car':
      return {
        type,
        company: e.name,
        pickupLocation: e.place,
        returnLocation: null,
        pickup: e.start,
        dropoff: e.end,
        confirmation: e.confirmation,
        vehicle: null,
        price: e.price,
      };
    case 'ticket':
      return {
        type,
        event: e.name,
        venue: e.place,
        starts: e.start,
        section: null,
        row: null,
        seats: null,
        confirmation: e.confirmation,
        price: e.price,
      };
    case 'reservation':
      return {
        type,
        venue: e.place,
        starts: e.start,
        partySize: null,
        confirmation: e.confirmation,
        price: e.price,
      };
  }
}

/** Switches the form to another type, keeping what the old one had in common. */
export function switchType(draft: Draft, type: ParsedBookingType): Draft {
  const current = applyValues(draft);
  return draftFrom(convertBooking(current, type), draft.uncertain);
}

/** The draft's booking with the form's strings written back (not yet validated). */
export function applyValues(draft: Draft): ParsedBooking {
  let booking: ParsedBooking = draft.base;
  let amount: number | null = null;
  let currency = '';
  for (const field of fieldsFor(draft.base)) {
    const text = (draft.values[field.path] ?? '').trim();
    switch (field.kind) {
      case 'amount':
        amount = text ? readAmount(text) : null;
        break;
      case 'currency':
        currency = text.toUpperCase();
        break;
      case 'count':
        booking = setAt(booking, field.path, text ? Number(text) : null);
        break;
      case 'code':
        booking = setAt(booking, field.path, text.toUpperCase());
        break;
      case 'date':
      case 'time':
        booking = setAt(booking, field.path, text || null);
        break;
      default: {
        // Names can't be empty (the schema says so); other text fields can.
        const required = /(^|\.)(name|airline|flightNumber|company|event)$/.test(field.path);
        booking = setAt(booking, field.path, text || (required ? '' : null));
      }
    }
  }
  const price = amount === null ? null : { amount, currency };
  return forgetMovedPlaces(draft.base, { ...booking, price } as ParsedBooking);
}

/**
 * A place whose name, address or city was edited is somewhere else: its coordinates (geocoded
 * from what the model read) no longer apply, so trip matching falls back to the city name.
 */
function forgetMovedPlaces(before: ParsedBooking, after: ParsedBooking): ParsedBooking {
  let result = after;
  const placePaths = ['hotel', 'venue', 'pickupLocation', 'returnLocation'];
  if (after.type === 'flight') {
    after.legs.forEach((_leg, i) => placePaths.push(`legs.${i}.from`, `legs.${i}.to`));
  }
  for (const path of placePaths) {
    const old = getAt(before, path) as Record<string, unknown> | null | undefined;
    const now = getAt(result, path) as Record<string, unknown> | null | undefined;
    if (!old || !now) continue;
    const moved = ['name', 'address', 'city', 'code'].some(
      (k) => (old[k] ?? null) !== (now[k] ?? null),
    );
    if (moved) result = setAt(result, path, { ...now, lat: null, lng: null });
  }
  return result;
}

/**
 * A typed amount: `1,250.50` and `1250.5` as usual, and a decimal comma (`412,30`, `1.250,50`) as
 * European receipts write it. NaN when it isn't a number (the schema then flags it).
 */
export function readAmount(text: string): number {
  const t = text.replace(/\s/g, '');
  const comma = t.lastIndexOf(',');
  if (comma > t.lastIndexOf('.') && /,\d{1,2}$/.test(t)) {
    return Number(`${t.slice(0, comma).replace(/[.,]/g, '')}.${t.slice(comma + 1)}`);
  }
  return Number(t.replace(/,/g, ''));
}

const MESSAGES: Record<FieldKind, string> = {
  text: 'Fill this in.',
  date: 'Pick a date.',
  time: 'Pick a time.',
  code: 'Use the 3-letter airport code, like LAS.',
  amount: 'Enter an amount like 412.30.',
  currency: 'Use a 3-letter currency code, like USD.',
  count: 'Enter a number of guests.',
};

/** The booking to save, or a message for each field that needs fixing. */
export function finishDraft(
  draft: Draft,
): { booking: ParsedBooking } | { errors: Record<string, string> } {
  const parsed = parsedBookingSchema.safeParse(applyValues(draft));
  if (parsed.success) {
    const b = parsed.data;
    const backwards = endBeforeStart(b);
    if (backwards) return { errors: { [backwards]: 'This is before the start.' } };
    return { booking: b };
  }
  const fields = fieldsFor(draft.base);
  const errors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const path = issue.path.join('.');
    // Price issues sit on `price.amount` / `price.currency`; others on the field itself.
    const field =
      fields.find((f) => f.path === path) ?? fields.find((f) => f.path.startsWith(`${path}.`));
    if (field && !errors[field.path]) errors[field.path] = MESSAGES[field.kind];
  }
  if (Object.keys(errors).length === 0) errors[fields[0].path] = MESSAGES.text;
  return { errors };
}

/** The path of an end date that comes before its start, if any. */
function endBeforeStart(b: ParsedBooking): string | null {
  const stamp = (w: When) => `${w.date} ${w.time ?? '00:00'}`;
  switch (b.type) {
    case 'hotel':
      return b.checkOut.date < b.checkIn.date ? 'checkOut.date' : null;
    case 'car':
      return stamp(b.dropoff) < stamp(b.pickup) ? 'dropoff.date' : null;
    // Flights aren't checked: local times across the date line can land "before" departure.
    default:
      return null;
  }
}
