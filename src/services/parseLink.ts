import {
  LINK_ERROR_COPY,
  readLinkResult,
  type LinkErrorCode,
  type LinkResult,
} from '../../supabase/functions/_shared/parse/links';

/** Required on first use, so demo sessions and tests never create a Supabase client. */
const client = (): (typeof import('./supabase'))['supabase'] =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('./supabase').supabase;

/** Why a link couldn't be read, with the copy to show (from the `parse-link` function). */
export class LinkError extends Error {
  constructor(
    readonly code: LinkErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export const LINK_COPY = LINK_ERROR_COPY;

const CODES: readonly LinkErrorCode[] = [
  'not_configured',
  'rate_limited',
  'unreadable',
  'failed',
  'unsupported',
];

/** The trip the places should be near: its city and coordinates. */
export interface LinkTripArea {
  city: string | null;
  near: { lat: number; lng: number } | null;
}

/** Asks `parse-link` for the places a TikTok or Reel names; the answer is checked. */
export async function parseLink(url: string, area: LinkTripArea): Promise<LinkResult> {
  const { data, error } = await client().functions.invoke<unknown>('parse-link', {
    body: { url, near: area.near, city: area.city },
  });
  if (error) {
    // A non-2xx answer carries `{ error, message }`; anything else is a network failure.
    const context = (error as { context?: { json?: () => Promise<unknown> } }).context;
    const body = (await context?.json?.().catch(() => null)) as { error?: string } | null;
    const code = CODES.find((c) => c === body?.error) ?? 'failed';
    throw new LinkError(code, LINK_COPY[code]);
  }
  const result = readLinkResult((data as { result?: unknown } | null)?.result);
  if (!result) throw new LinkError('failed', LINK_COPY.failed);
  return result;
}
