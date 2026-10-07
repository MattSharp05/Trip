// The model behind every AI read (ADR 0004, ADR 0019), shared by `parse-booking` (a booking file)
// and `parse-link` (a video's caption). Chosen by the PARSE_PROVIDER secret: `gemini` (default,
// Gemini Flash free tier, needs GEMINI_API_KEY) or `fixture` (canned answers, no model, no key).

import { SAMPLE_PARSES, sampleFor } from './fixtures.ts';
import { LINK_SAMPLES } from './linkFixtures.ts';
import { BOOKING_PROMPT, linkPrompt } from './prompts.ts';
import { PARSE_ERROR_COPY, type ParseErrorCode } from './schema.ts';

const GEMINI = 'https://generativelanguage.googleapis.com/v1beta/models';
export const DEFAULT_MODEL = 'gemini-flash-latest';

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
): ParseProvider {
  async function generate(parts: Part[]): Promise<unknown> {
    const res = await fetchImpl(`${GEMINI}/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0 },
      }),
    });
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
  return geminiProvider(key, env('GEMINI_MODEL') || DEFAULT_MODEL, fetchImpl, copy);
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
