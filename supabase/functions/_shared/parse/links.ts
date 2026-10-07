// TikTok and Reel links (TR-30, ADR 0019): which links the app takes, what the model's place list
// looks like, and what `parse-link` returns. Shared by the function, which validates the model's
// answer, and the app, which validates the function's response.

import { z } from 'zod';

import type { ParseErrorCode } from './schema.ts';

export type LinkPlatform = 'tiktok' | 'instagram';

const HOSTS: { platform: LinkPlatform; pattern: RegExp }[] = [
  // tiktok.com, www., m., vm. and vt. (the app's short share links).
  { platform: 'tiktok', pattern: /^(?:[a-z0-9-]+\.)?tiktok\.com$/ },
  { platform: 'instagram', pattern: /^(?:www\.|m\.)?instagram\.com$|^instagr\.am$/ },
];

/** The platform a link belongs to, or null for any other link (or text that isn't a link). */
export function linkPlatform(url: string): LinkPlatform | null {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
  const host = parsed.hostname.toLowerCase();
  return HOSTS.find((h) => h.pattern.test(host))?.platform ?? null;
}

/**
 * The first TikTok or Instagram link in some text: copied share text often wraps it in words
 * ("Check out this video! https://vm.tiktok.com/ZM…"). Null when there is none.
 */
export function findLink(text: string): string | null {
  for (const match of text.matchAll(/https?:\/\/[^\s<>"']+/gi)) {
    const url = match[0].replace(/[).,!?]+$/, '');
    if (linkPlatform(url)) return url;
  }
  return null;
}

const text = z.string().trim().min(1);
const KINDS = ['food', 'bar', 'nightlife', 'attraction', 'landmark', 'hotel', 'arena'] as const;

/** What the model answers for a caption: the places it names. */
export const extractedPlacesSchema = z.object({
  places: z
    .array(
      z.object({
        name: text.max(120),
        city: text.nullable().default(null),
        // An unknown kind isn't worth failing the whole answer for.
        kind: z.enum(KINDS).nullable().catch(null).default(null),
      }),
    )
    .max(20),
});
export type ExtractedPlaces = z.infer<typeof extractedPlacesSchema>;
export type ExtractedPlace = ExtractedPlaces['places'][number];

/** A place the video names; no coordinates when Photon couldn't find it near the trip. */
export const linkPlaceSchema = z.object({
  name: text,
  kind: z.string().nullable(),
  /** Neighbourhood or city. */
  area: z.string().nullable(),
  address: z.string().nullable(),
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
});
export type LinkPlace = z.infer<typeof linkPlaceSchema>;

/** `parse-link`'s answer: the video and the places found in it. */
export const linkResultSchema = z.object({
  url: z.string().url(),
  platform: z.enum(['tiktok', 'instagram']),
  /** The caption (TikTok) or the post's text (Instagram), when the platform shares it. */
  title: z.string().nullable(),
  author: z.string().nullable(),
  thumbnailUrl: z.string().url().nullable(),
  places: z.array(linkPlaceSchema),
});
export type LinkResult = z.infer<typeof linkResultSchema>;

export function readLinkResult(value: unknown): LinkResult | null {
  const parsed = linkResultSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** `unsupported`: not a TikTok or Instagram link (checked before anything is sent). */
export type LinkErrorCode = ParseErrorCode | 'unsupported';

export const LINK_ERROR_COPY: Record<LinkErrorCode, string> = {
  not_configured: "Finding places in videos isn't set up yet. Search for the place instead.",
  rate_limited: 'Too many videos at once. Try again in a minute.',
  unreadable: "Couldn't open that video. Check the link and try again.",
  failed: 'Something went wrong reading that video. Check your connection and try again.',
  unsupported: "That link isn't a TikTok or an Instagram Reel.",
};

/** The results sheet's copy when the video names no place. */
export const NOTHING_FOUND_COPY = "Couldn't find a place in this video. Search for it instead.";
