// The model behind every AI read (ADR 0004, ADR 0019), shared by `parse-booking` (a booking file)
// and `parse-link` (a video's caption). Chosen by the PARSE_PROVIDER secret: `gemini` (default,
// Gemini Flash free tier, needs GEMINI_API_KEY) or `fixture` (canned answers, no model, no key).
// GEMINI_MODEL and GEMINI_FALLBACK_MODEL override the models.

import { SAMPLE_PARSES, sampleFor } from './fixtures.ts';
import { LINK_SAMPLES } from './linkFixtures.ts';
import { BOOKING_PROMPT, linkPrompt } from './prompts.ts';
import { PARSE_ERROR_COPY, type ParseErrorCode } from './schema.ts';

const GEMINI = 'https://generativelanguage.googleapis.com/v1beta/models';
export const DEFAULT_MODEL = 'gemini-flash-latest';
/** Tried once when the main model is still overloaded after its retries. */
export const DEFAULT_FALLBACK_MODEL = 'gemini-flash-lite-latest';

/**
 * The free tier often answers 503 "model overloaded" (TR-25 QA round 2: 9 of 12 live samples).
 * Each model gets this many tries on a 500 or 503, waiting `BACKOFF_MS * 2^n` plus up to
 * `JITTER_MS` between them; a 429 is retried only when Gemini says to retry within
 * `MAX_RETRY_DELAY_MS`. Worst case a few seconds of waiting, well inside the Edge Function limit.
 */
export const RETRY = {
  attempts: 3,
  BACKOFF_MS: 400,
  JITTER_MS: 250,
  MAX_RETRY_DELAY_MS: 3000,
};

export interface RetryOptions {
  /** Tried once after the main model's last 500/503; null for none. */
  fallbackModel?: string | null;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export interface BookingFile {
  name: string;
  mimeType: string;
  bytes: Uint8Array;
}

/** A model that reads bookings and captions. Throws `ParseFailure` for the errors the app shows. */
export interface ParseProvider {
  readonly name: string;
  /** A booking file → the booking JSON (checked by `readParseResult`). */
  parse(file: BookingFile): Promise<unknown>;
  /** A caption → `{ places: [...] }` (checked by `extractedPlacesSchema`). */
  extractPlaces(text: string, city: string | null): Promise<unknown>;
}

export class ParseFailure extends Error {
  constructor(
    readonly code: ParseErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export type Env = (name: string) => string | undefined;

type Part = { text: string } | { inline_data: { mime_type: string; data: string } };

/** Gemini Flash on the free tier (prompts may be used by Google; the app says so). */
export function geminiProvider(
  apiKey: string,
  model: string,
  fetchImpl: typeof fetch,
  copy: Record<ParseErrorCode, string> = PARSE_ERROR_COPY,
  { fallbackModel = DEFAULT_FALLBACK_MODEL, sleep = wait, random = Math.random }: RetryOptions = {},
): ParseProvider {
  const call = (name: string, parts: Part[]) =>
    fetchImpl(`${GEMINI}/${name}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0 },
      }),
    });

  /** One model with retries; the last response when every try was transient. */
  async function tryModel(name: string, parts: Part[], attempts: number): Promise<Response> {
    let res = await call(name, parts);
    for (let n = 1; n < attempts; n++) {
      const delay = await retryDelay(res, n);
      if (delay === null) return res;
      // Deno keeps an unread body's connection open: let go of the answer we're retrying.
      await res.body?.cancel().catch(() => {});
      await sleep(delay);
      res = await call(name, parts);
    }
    return res;
  }

  /** How long to wait before try `n + 1`, or null when this response isn't worth retrying. */
  async function retryDelay(res: Response, n: number): Promise<number | null> {
    if (res.status === 500 || res.status === 503) {
      return RETRY.BACKOFF_MS * 2 ** (n - 1) + Math.round(random() * RETRY.JITTER_MS);
    }
    if (res.status !== 429) return null;
    const asked = await askedDelay(res.clone());
    return asked !== null && asked <= RETRY.MAX_RETRY_DELAY_MS ? asked : null;
  }

  async function generate(parts: Part[]): Promise<unknown> {
    let res = await tryModel(model, parts, RETRY.attempts);
    if (res.status === 503 && fallbackModel && fallbackModel !== model) {
      res = await tryModel(fallbackModel, parts, 1);
    }
    if (res.status === 429) throw new ParseFailure('rate_limited', copy.rate_limited);
    if (!res.ok) throw new ParseFailure('failed', `Gemini returned ${res.status}`);
    const body = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const answer = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('');
    if (!answer) throw new ParseFailure('unreadable', copy.unreadable);
    try {
      return JSON.parse(answer);
    } catch {
      throw new ParseFailure('unreadable', copy.unreadable);
    }
  }
  return {
    name: 'gemini',
    parse: (file) =>
      generate([
        { inline_data: { mime_type: file.mimeType, data: toBase64(file.bytes) } },
        { text: BOOKING_PROMPT },
      ]),
    extractPlaces: (text, city) => generate([{ text: linkPrompt(text, city) }]),
  };
}

/** Canned answers: the sample parses by file name, the sample videos by caption. */
export const fixtureProvider: ParseProvider = {
  name: 'fixture',
  async parse(file) {
    return JSON.parse(JSON.stringify(SAMPLE_PARSES[sampleFor(file.name)]));
  },
  async extractPlaces(text) {
    const sample = Object.values(LINK_SAMPLES).find((s) => s.meta.title === text);
    return JSON.parse(JSON.stringify(sample?.extracted ?? { places: [] }));
  },
};

export function chooseProvider(
  env: Env,
  fetchImpl: typeof fetch,
  copy: Record<ParseErrorCode, string> = PARSE_ERROR_COPY,
): ParseProvider {
  if (env('PARSE_PROVIDER') === 'fixture') return fixtureProvider;
  const key = env('GEMINI_API_KEY');
  if (!key) throw new ParseFailure('not_configured', copy.not_configured);
  return geminiProvider(key, env('GEMINI_MODEL') || DEFAULT_MODEL, fetchImpl, copy, {
    fallbackModel: env('GEMINI_FALLBACK_MODEL') || DEFAULT_FALLBACK_MODEL,
  });
}

/**
 * The wait a 429 asks for, in ms: a `Retry-After` header (seconds) or Gemini's `RetryInfo`
 * detail (`"retryDelay": "2s"`); null when it doesn't say.
 */
async function askedDelay(res: Response): Promise<number | null> {
  const header = Number(res.headers.get('retry-after'));
  if (res.headers.has('retry-after') && Number.isFinite(header)) return header * 1000;
  try {
    const body = (await res.json()) as { error?: { details?: { retryDelay?: string }[] } };
    const delay = body.error?.details?.find((d) => d.retryDelay)?.retryDelay;
    const seconds = delay ? Number.parseFloat(delay) : NaN;
    return Number.isFinite(seconds) ? Math.round(seconds * 1000) : null;
  } catch {
    return null;
  }
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
