# 0019 — TikTok and Reel links: one shared ParseProvider, oEmbed, clipboard and in-app browser

**Context.** TR-30 turns a copied TikTok or Instagram Reel into Bucket List places (PRD → TikTok /
Reels, flow 6). ADR 0004 put the model behind a `ParseProvider`; until now only `parse-booking`
used it, with the provider written inside that function. The TDD rules out scraping. The demo runs
in Expo Go, so the clipboard and the browser must come from Expo SDK modules.

**Decision.**
- The provider moves to `supabase/functions/_shared/parse/provider.ts` and gains a text method,
  `extractPlaces(caption, city)`, next to `parse(file)`. Prompts live on their own in
  `_shared/parse/prompts.ts` (the booking prompt unchanged). `PARSE_PROVIDER=fixture` answers the
  sample videos in `_shared/parse/linkFixtures.ts`; without `GEMINI_API_KEY` the function answers
  `not_configured` and the app says "Finding places in videos isn't set up yet".
- New Edge Function `parse-link`: the video's own text from TikTok's public oEmbed endpoint, or an
  Instagram post's Open Graph tags when Instagram serves them (often it sends a login page; then
  there is no text and the app offers search). No page scraping beyond those public tags.
- Each place is located with Photon (no key) inside the trip's area, then as "name, city" kept only
  within 60 km of the trip, and only when the names match (Photon matches loosely). The spot rules
  move to `_shared/places/spots.ts`, shared with `places`.
- The function writes nothing. The app saves what the traveller ticks: the places, a `saved_links`
  row (now with `trip_id` and `author`), and bucket items pointing at it (`saved_link_id`,
  migration 0008), so a demo session saves the same way in memory.
- Clipboard: `expo-clipboard` (`hasUrlAsync` on every foreground, which iOS answers without a paste
  prompt; the text is read only after a tap). "Watch": `expo-web-browser` (an in-app Safari
  sheet). Both ship in Expo Go (ADR 0001); they change the iOS fingerprint, so the next E2E run
  makes one new `e2e` build (ADR 0015).

**Consequences.**
- Gemini's free tier also reads captions (the same privacy note as bookings: captions are public).
- Instagram mostly yields nothing without a login; the share sheet (Phase B) can pass the caption
  directly.
- A video saved twice makes a second link and second places; merging duplicates is left for later.
