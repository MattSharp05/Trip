# 0023 — Discover's saved videos: pooled through a security-definer function

**Context.** TR-34 adds "Saved from TikTok & Reels" to Discover: the videos travellers saved for
a trip's city (TR-30's `saved_links`), plus a handpicked Las Vegas set. `saved_links` is
owner-only (RLS, ADR 0003), and a link row also knows who saved it, the video's author, the trip
and when. Other travellers must see the videos, never that.

**Decision.**
- **`public.city_links(p_city text)`** (migration 0009), `security definer`, `stable`, empty
  `search_path`: the one way to read saved links across accounts. It answers only `url`, `title`
  (the caption), `thumbnail_url` (https only) and `place_count`, one row per video URL, for links
  whose trip's city matches (trimmed, any case) and that name at least one place. Only TikTok and
  Instagram URLs count, so a hand-written row can't put any other link in front of other people.
  Most-saved first, then newest, at most 30. Execute: `authenticated` only (not `anon`).
- A function, not a view: a view over `saved_links` would either run with the caller's RLS
  (owner rows only) or need `security_invoker = false` plus column grants; the function takes the
  city as a parameter and makes the exposed columns explicit. `scripts/supabase-rls-test.mjs`
  proves the columns, that no user id, author, trip or link id leaks, the URL filter, the city
  match, and that anonymous callers are refused.
- **Handpicked videos** live in `supabase/seed/vegas_links.json` (made-up links) with the places
  each names, so tapping one opens the TR-30 results sheet without reading the video. The app
  bundles them; they come first, then pooled videos not already in the set.
- **Demo sessions** (scenarios) show the handpicked set only and never call Supabase.
- **Sample networking events** have no source either: four made-up Las Vegas events
  (`supabase/functions/_shared/events/networking.ts`, TypeScript because the function deploy
  ships `_shared/**/*.ts` only) are added to every `events` answer near the trip on its dates,
  tagged `sample` and shown as "Sample" under the Networking chip only.

**Consequences.**
- Captions are visible to other travellers in the same city. They are the public video's own
  text, but a traveller who edits a row by hand could put any text there; worth a report or
  moderation step before real users.
- A real networking source replaces `networking.ts` later (a provider in the `events` function).
