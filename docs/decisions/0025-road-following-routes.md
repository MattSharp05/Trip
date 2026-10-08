# 0025 — Road-following routes between stops (draft)

**Status.** Proposed (TR-47, 2026-10-08). Matthew decides; nothing is built yet. Until then the
Plan map has no lines between stops: each pin shows its number in the day's list (and its time
when selected).

**Context.** The Plan map joined a day's stops with a dashed straight line. Matthew: "I don't
think it is helpful showing a straight path because no one travels like that ... if we can show
the actual route taken (walk, train, car etc) where the line follows the roads." Apple Maps in
`react-native-maps` (ADR 0002) draws any polyline we give it, but it has no directions service
in JavaScript. Apple's own directions (`MKDirections`) need native code (Phase B, ADR 0001). A
road-following line needs a directions provider that returns the route's geometry, called from
a Supabase Edge Function so no key ships in the app (ADR 0003). The function would cache results
per pair of places and mode (a table in migration 0011), because a day's legs rarely change.

**Options.**

| | Modes | Key, account | Free allowance | Fit |
|---|---|---|---|---|
| A. OSRM public demo (`router.project-osrm.org`) | Car only; foot and bike on FOSSGIS's `routing.openstreetmap.de` | None | Best effort; the usage policy forbids heavy use, can be withdrawn without notice, and needs attribution | Prototype only: no guarantee, no transit |
| B. OpenRouteService (HeiGIT) | Car, walk, bike, wheelchair; no transit | Free key (sign-up) | 2,000 directions a day, 40 a minute | Free, keyed in the Edge Function, enough for the demo with caching; no transit |
| C. Mapbox Directions | Car (with traffic), walk, bike; no transit | Account, token; a card to activate | 100,000 requests a month free, then paid | Generous, but needs a card and is a paid plan beyond the free tier |
| D. Google Routes API | Car, walk, bike, **transit** | Google Cloud project with billing | Monthly free credit, then paid | The only option with trains and buses; needs billing set up |
| E. Apple `MKDirections` (Phase B) | Car, walk, transit ETA | Apple developer account | Free | Native code: not possible in Expo Go; fits Phase B |
| F. No lines (current) | — | — | — | Numbers and times on the pins show order and proximity |

**Recommendation.** B (OpenRouteService) for walking and driving legs, if Matthew wants lines
before Phase B. It's free with a key held in an Edge Function, its quota is plenty once legs
are cached, and it fits ADR 0003's pattern. The leg's mode follows TR-22's travel estimate (walk
under about 1.5 km, else drive). Transit stays a straight-line estimate until Phase B can use
Apple's directions (E), or Google (D) if billing is ever acceptable. Keep F until then.

**Consequences if B is chosen.**
- A new Edge Function `directions` (key `ORS_API_KEY` as a Supabase secret), a cache table
  (migration 0011) keyed by the two places and the mode, and `src/services/directions.ts`
  through TanStack Query.
- The map draws each leg's geometry as a solid thin line under the pins; legs that fail or are
  not cached yet draw nothing (never a straight line).
- Creating the ORS account and key is Matthew's step (it can't be done for him).
