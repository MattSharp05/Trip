// Tidies the model's raw JSON before it is validated (TR-49). The model reads the booking right
// but writes it slightly off the schema often enough to cost whole imports: `"row": 12` as a
// number, the booking without its `{ "booking": … }` wrapper, `"type": "event"`, `"PT"` for a
// country, a leg with an airport code and no country. Each fix here only reshapes what the model
// sent or fills a value that follows from it (an airport's city and country); nothing is guessed.

import { airportPlace } from './airports.ts';

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Model words for the five booking types. */
const TYPE_ALIASES: Record<string, string> = {
  flight: 'flight',
  flights: 'flight',
  'boarding pass': 'flight',
  'boarding-pass': 'flight',
  hotel: 'hotel',
  lodging: 'hotel',
  accommodation: 'hotel',
  stay: 'hotel',
  car: 'car',
  'car rental': 'car',
  'car-rental': 'car',
  car_rental: 'car',
  rental: 'car',
  ticket: 'ticket',
  tickets: 'ticket',
  event: 'ticket',
  'event ticket': 'ticket',
  event_ticket: 'ticket',
  'e-ticket': 'ticket',
  concert: 'ticket',
  match: 'ticket',
  game: 'ticket',
  sports: 'ticket',
  show: 'ticket',
  reservation: 'reservation',
  restaurant: 'reservation',
  'restaurant reservation': 'reservation',
  table: 'reservation',
  dining: 'reservation',
};

/** Text fields the model sometimes sends as numbers (`"row": 12`, `"seats": 7`). */
const TEXT_KEYS = new Set([
  'section',
  'row',
  'seats',
  'seat',
  'gate',
  'terminal',
  'room',
  'confirmation',
  'flightNumber',
  'phone',
  'address',
]);

const COUNTRY_ALIASES: Record<string, string> = {
  USA: 'United States',
  'U.S.': 'United States',
  'U.S.A.': 'United States',
  US: 'United States',
  'United States of America': 'United States',
  UK: 'United Kingdom',
  'Great Britain': 'United Kingdom',
};

let regionNames: Intl.DisplayNames | null | undefined;

/** "PT" → "Portugal", "USA" → "United States"; anything else as sent. */
export function countryName(value: string): string {
  const text = value.trim();
  if (COUNTRY_ALIASES[text]) return COUNTRY_ALIASES[text];
  if (!/^[A-Z]{2}$/.test(text)) return text;
  if (regionNames === undefined) {
    try {
      regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
    } catch {
      regionNames = null;
    }
  }
  const name = regionNames?.of(text);
  return name && name !== text ? name : text;
}

/** Symbols the model sometimes writes instead of a code. `$` is left alone: it's ambiguous. */
const CURRENCY_SYMBOLS: Record<string, string> = { '€': 'EUR', '£': 'GBP', '¥': 'JPY' };

function price(value: unknown): unknown {
  if (!isObject(value)) return value;
  const out = { ...value };
  if (typeof out.amount === 'string') {
    const amount = Number(out.amount.replace(/[^\d.-]/g, ''));
    if (out.amount.trim() !== '' && Number.isFinite(amount)) out.amount = amount;
  }
  if (typeof out.currency === 'string' && CURRENCY_SYMBOLS[out.currency.trim()]) {
    out.currency = CURRENCY_SYMBOLS[out.currency.trim()];
  }
  return out;
}

function place(value: unknown): unknown {
  if (!isObject(value)) return value;
  const out = { ...value };
  if (typeof out.country === 'string') out.country = countryName(out.country);
  return out;
}

function airport(value: unknown): unknown {
  if (!isObject(value)) return value;
  const out = place(value) as Json;
  const known = typeof out.code === 'string' ? airportPlace(out.code) : null;
  if (known) {
    if (!out.city) out.city = known.city;
    if (!out.country) out.country = known.country;
  }
  return out;
}

/** Numbers in text fields become text, at any depth. */
function textify(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(textify);
  if (!isObject(value)) return value;
  const out: Json = {};
  for (const [key, item] of Object.entries(value)) {
    out[key] = TEXT_KEYS.has(key) && typeof item === 'number' ? String(item) : textify(item);
  }
  return out;
}

function booking(value: unknown): unknown {
  if (!isObject(value)) return value;
  const out = textify(value) as Json;
  if (typeof out.type === 'string') {
    const type = out.type.trim().toLowerCase();
    out.type = TYPE_ALIASES[type] ?? type;
  }
  if ('price' in out) out.price = price(out.price);
  if (typeof out.partySize === 'string' && /^\s*\d+\s*$/.test(out.partySize)) {
    out.partySize = Number(out.partySize);
  }
  for (const key of ['hotel', 'venue', 'pickupLocation', 'returnLocation']) {
    if (key in out) out[key] = place(out[key]);
  }
  if (Array.isArray(out.legs)) {
    out.legs = out.legs.map((leg) =>
      isObject(leg) ? { ...leg, from: airport(leg.from), to: airport(leg.to) } : leg,
    );
  }
  return out;
}

/**
 * The model's answer reshaped towards `parseResultSchema`. Anything it can't make sense of is
 * returned as is, so validation still rejects it.
 */
export function normalizeAnswer(answer: unknown): unknown {
  if (!isObject(answer)) return answer;
  let wrapped: Json = answer;
  // A list of one booking, or the booking on its own without the { booking, uncertain } wrapper.
  if (!('booking' in answer) && Array.isArray(answer.bookings) && answer.bookings.length > 0) {
    wrapped = { ...answer, booking: answer.bookings[0] };
    delete wrapped.bookings;
  } else if (!('booking' in answer)) {
    wrapped = { booking: answer, uncertain: [] };
  }
  const uncertain = Array.isArray(wrapped.uncertain)
    ? wrapped.uncertain.filter((path) => typeof path === 'string')
    : [];
  return { ...wrapped, booking: booking(wrapped.booking), uncertain };
}
