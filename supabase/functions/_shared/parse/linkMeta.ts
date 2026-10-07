// What a TikTok or Instagram link says about itself, without scraping (TDD): TikTok's public
// oEmbed endpoint (caption, creator, thumbnail), and for Instagram the page's Open Graph tags when
// Instagram serves them to a plain request (often it shows a login page instead: then there is no
// text, and the app offers search).

import type { LinkPlatform } from './links.ts';

export interface LinkMeta {
  /** The caption or post text; null when the platform didn't share it. */
  title: string | null;
  author: string | null;
  thumbnailUrl: string | null;
}

export const NO_META: LinkMeta = { title: null, author: null, thumbnailUrl: null };

const TIKTOK_OEMBED = 'https://www.tiktok.com/oembed';
const USER_AGENT = 'Trip demo app (https://github.com/MattSharp05/Trip)';

const clean = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;
const httpsUrl = (value: unknown): string | null => {
  const url = clean(value);
  return url && /^https:\/\//.test(url) ? url : null;
};

/** TikTok's oEmbed JSON → caption, creator and thumbnail. Null when it isn't a video's answer. */
export function readTikTokOembed(json: unknown): LinkMeta | null {
  if (!json || typeof json !== 'object') return null;
  const o = json as Record<string, unknown>;
  const meta: LinkMeta = {
    title: clean(o.title),
    author: clean(o.author_name) ?? clean(o.author_unique_id),
    thumbnailUrl: httpsUrl(o.thumbnail_url),
  };
  return meta.title || meta.author || meta.thumbnailUrl ? meta : null;
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  quot: '"',
  apos: "'",
  lt: '<',
  gt: '>',
  nbsp: ' ',
};

export function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, code: string) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1));
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : all;
    }
    return ENTITIES[code.toLowerCase()] ?? all;
  });
}

/** `<meta property="og:…" content="…">` tags (either attribute order) → their decoded values. */
export function readOpenGraph(html: string): Record<string, string> {
  const tags: Record<string, string> = {};
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const key = /\b(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase();
    const content = /\bcontent\s*=\s*"([^"]*)"|\bcontent\s*=\s*'([^']*)'/i.exec(tag);
    if (!key || !content || !key.startsWith('og:')) continue;
    if (!(key in tags)) tags[key] = decodeEntities(content[1] ?? content[2] ?? '');
  }
  return tags;
}

/**
 * An Instagram post's Open Graph tags → caption, creator and image. Its description reads
 * `12K likes, 80 comments - vegaseats on March 1, 2026: "caption…".`; the caption is the quoted
 * part. Null when the page had no post (a login wall).
 */
export function readInstagramMeta(html: string): LinkMeta | null {
  const og = readOpenGraph(html);
  const description = og['og:description'] ?? null;
  const quoted = description ? /:\s*"([\s\S]+)"\.?\s*$/.exec(description)?.[1] : undefined;
  const author = description ? /-\s*([\w.]+)\s+on\s/.exec(description)?.[1] : undefined;
  const meta: LinkMeta = {
    title: clean(quoted) ?? clean(description) ?? clean(og['og:title']),
    author: clean(author),
    thumbnailUrl: httpsUrl(og['og:image']),
  };
  return meta.title ? meta : null;
}

/** Looks the link up; never throws (no text just means nothing to read places from). */
export async function fetchLinkMeta(
  url: string,
  platform: LinkPlatform,
  fetchImpl: typeof fetch,
): Promise<LinkMeta | null> {
  try {
    if (platform === 'tiktok') {
      const res = await fetchImpl(`${TIKTOK_OEMBED}?url=${encodeURIComponent(url)}`, {
        headers: { 'User-Agent': USER_AGENT },
      });
      return res.ok ? readTikTokOembed(await res.json()) : null;
    }
    const res = await fetchImpl(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
    });
    return res.ok ? readInstagramMeta(await res.text()) : null;
  } catch {
    return null;
  }
}
