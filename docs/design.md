# Design rules

`docs/design/reference-mockup.webp` is the visual source of truth: aesthetic, spacing, hierarchy,
card treatment and map prominence. Do not copy its tab labels; the tabs are
**Trips · Plan · Organize · Discover**. The vision mockup
(https://claude.ai/artifact/1ZebwCGiuemK9uAi2Ngs1v) shows the flows.

Every UI ticket's code review checks the diff against this page.

## Tokens

| Token | Value |
|---|---|
| Background | `#000000` |
| Surface | `#111111` |
| Raised surface | `#1A1A1A` |
| Hairline border | white at 8–12% |
| Primary text | `#FFFFFF` |
| Secondary text | `#A0A0A0` |
| Accent (the only one) | `#FF6B22` |
| Semantic green (e.g. "On time") | `#30D158` |

- **Dark only.**
- Orange marks selected states, primary actions, routes and the active tab. Nothing else gets colour.
- Font: the system font (SF Pro). Icons: **SF Symbols** (`expo-symbols`), outlined; white or grey when
  inactive, orange when selected.
- Corners: Apple-standard continuous corners. Tighter on list cards (about 10–12), larger only on
  big photo cards (about 16).
- Bars: Apple's native tab bar and navigation bars, as iOS ships them (Liquid Glass on iOS 26).
  No custom glass effects.

## Never (looks "vibe-coded")

- Emoji anywhere in the UI (weather, categories, flags: use SF Symbols)
- Lucide icons; Inter, Geist or Space Grotesk
- Gradients, except a subtle dark scrim over photos for legibility
- Purple, neon, pastel or rainbow colour; glows, radial orbs, dot grids
- Drop shadows (separate surfaces with a lighter fill and hairline borders)
- A coloured stripe on the left of cards (the itinerary timeline is a timeline, not a card stripe)
- Bento grids or rows of three feature cards
- Sparkle, magic-wand or robot icons; AI chat screens. Smart Add is a normal button.
- Checkmark bullet lists; "it's not X, it's Y" copy; em dashes in app copy (an en dash in a date
  range like "Nov 12 – 16" is fine)
- Decorative or arrow animations. Only native motion: map fly-to, sheet springs, list changes.

## Always

- Skeleton placeholders wherever data loads (no bare spinners, no blank screens)
- Terms and Privacy screens in Settings
- Plain, specific copy: name things the way a traveller would
