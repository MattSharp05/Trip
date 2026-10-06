// Edge Function `photos`: trip cover photos from Unsplash (TR-10). The key lives only here, as the
// function secret UNSPLASH_ACCESS_KEY. Without it, search answers `{ photo: null }` (200) and the
// app shows its placeholder cover.
//
//   POST { action: 'search', query }            → { photo: CoverPhoto | null }
//   POST { action: 'track', downloadLocation }  → { tracked: boolean }
//
// Unsplash API guidelines: hotlink the returned image URLs, credit the photographer and Unsplash
// with links, and call the photo's download_location when the user picks it (`track`).
//
// One self-contained file: Deno runs it (`Deno.serve` below) and Jest imports `handle` to test it.

export interface CoverPhoto {
  /** Hotlinked Unsplash image URL (never re-hosted). */
  url: string;
  photographer: string;
  /** Photographer's Unsplash profile, with the referral parameters Unsplash asks for. */
  photographerUrl: string;
  /** The photo's Unsplash page, with referral parameters. */
  photoUrl: string;
  /** Unsplash's download-tracking endpoint for this photo; pass it to `track`. */
  downloadLocation: string;
}

const API = 'https://api.unsplash.com';
const UTM = 'utm_source=trip_demo&utm_medium=referral';

const withUtm = (link: string) => `${link}${link.includes('?') ? '&' : '?'}${UTM}`;

interface UnsplashPhoto {
  urls?: { regular?: string };
  links?: { html?: string; download_location?: string };
  user?: { name?: string; links?: { html?: string } };
}

export function toCoverPhoto(json: unknown): CoverPhoto | null {
  const photo = (json as { results?: UnsplashPhoto[] } | null)?.results?.[0];
  const url = photo?.urls?.regular;
  const name = photo?.user?.name;
  const profile = photo?.user?.links?.html;
  const page = photo?.links?.html;
  const download = photo?.links?.download_location;
  if (!url || !name || !profile || !page || !download) return null;
  return {
    url,
    photographer: name,
    photographerUrl: withUtm(profile),
    photoUrl: withUtm(page),
    downloadLocation: download,
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function handle(
  req: Request,
  accessKey: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);
  let body: { action?: unknown; query?: unknown; downloadLocation?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Body must be JSON' }, 400);
  }
  const headers = { Authorization: `Client-ID ${accessKey}`, 'Accept-Version': 'v1' };

  if (body.action === 'search') {
    const query = typeof body.query === 'string' ? body.query.trim() : '';
    if (query.length < 2 || query.length > 100) {
      return json({ error: 'query must be 2 to 100 characters' }, 400);
    }
    if (!accessKey) return json({ photo: null });
    const url = new URL(`${API}/search/photos`);
    url.searchParams.set('query', query);
    url.searchParams.set('per_page', '1');
    url.searchParams.set('orientation', 'landscape');
    url.searchParams.set('content_filter', 'high');
    const res = await fetchImpl(url.toString(), { headers });
    if (!res.ok) return json({ error: `Unsplash returned ${res.status}` }, 502);
    return json({ photo: toCoverPhoto(await res.json()) });
  }

  if (body.action === 'track') {
    const location = typeof body.downloadLocation === 'string' ? body.downloadLocation : '';
    // Only Unsplash's own endpoint: the key must never be sent anywhere else.
    if (!location.startsWith(`${API}/photos/`)) {
      return json({ error: 'downloadLocation must be an Unsplash API URL' }, 400);
    }
    if (!accessKey) return json({ tracked: false });
    const res = await fetchImpl(location, { headers });
    return json({ tracked: res.ok });
  }

  return json({ error: "action must be 'search' or 'track'" }, 400);
}

declare const Deno:
  | {
      serve: (handler: (req: Request) => Promise<Response>) => void;
      env: { get: (name: string) => string | undefined };
    }
  | undefined;

if (typeof Deno !== 'undefined') {
  const deno = Deno;
  deno.serve((req) => handle(req, deno.env.get('UNSPLASH_ACCESS_KEY')));
}
