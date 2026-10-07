import { linkSampleFor } from '../../../supabase/functions/_shared/parse/linkFixtures';
import {
  findLink,
  linkPlatform,
  type LinkResult,
} from '../../../supabase/functions/_shared/parse/links';
import { curatedLinkFor } from '@/services/cityLinks';
import type { DataSource } from '@/services/data';
import { LINK_COPY, LinkError, parseLink, type LinkTripArea } from '@/services/parseLink';

/** How long a demo session "reads" a sample video, so the skeleton shows as it would for real. */
export const DEMO_READ_MS = 600;

/** The TikTok or Instagram link in pasted text (share text often wraps it), else the text. */
export const linkIn = (text: string) => findLink(text) ?? text.trim();

/**
 * Finds the places in a pasted or copied link. Discover's handpicked videos (TR-34) carry their
 * places already; a demo session also answers the sample videos itself (no network); any other
 * link goes to the `parse-link` function, which works signed out too.
 */
export async function readLink(
  source: DataSource,
  text: string,
  area: LinkTripArea,
): Promise<LinkResult> {
  const url = linkIn(text);
  if (!linkPlatform(url)) throw new LinkError('unsupported', LINK_COPY.unsupported);
  const curated = curatedLinkFor(url);
  if (curated) return curated;
  const sample = source.kind === 'demo' ? linkSampleFor(url) : null;
  if (sample) {
    await new Promise((resolve) => setTimeout(resolve, DEMO_READ_MS));
    return JSON.parse(JSON.stringify(sample.result)) as LinkResult;
  }
  return parseLink(url, area);
}

/** The copy for anything that stopped a read. */
export function linkErrorMessage(error: unknown): string {
  return error instanceof LinkError ? error.message : LINK_COPY.failed;
}
