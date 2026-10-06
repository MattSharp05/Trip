# Trip

An iPhone travel app with three concepts: **Organize** (a wallet that turns bookings into clear
cards), **Plan** (a big interactive map with the itinerary underneath, plus a Bucket List and Smart
Add) and **Discover** (events on your dates for every upcoming trip). AI works out of sight: it
reads bookings and TikToks. The demo phase costs $0 and runs in Expo Go; if Matthew's company
approves it, Phase B moves to their Apple developer account (TestFlight, share sheet, widgets,
Live Activities). The PRD on the Notion project page is the source of truth for scope.

Design: follow `docs/design.md` (rules) and `docs/design/reference-mockup.webp` (look).

## Workflow
Follows the `dev-workflow` skill (ticket-driven: Notion → branch → PR → QA → merge).
- Notion project page: https://app.notion.com/p/3f124983f3ca81b4be8dd2226fdb12a1
- Tickets data source: collection://3627b61b-ada0-45e8-a69e-2cb41034b942   (ID prefix: TR)
- Epics data source: collection://863c0317-6a10-4e3d-a94d-4391a87359fa
- GitHub: MattSharp05/Trip
- Preview URLs: batched QA mode, so no per-PR previews. QA happens in Expo Go on the latest `main`
  (EAS Update channel for `main`; link on the project page once Epic 0 sets it up).
- QA mode: batched (batch ends at ⭐ checkpoint waves)
- Merge policy: fast. When `main` moved after a PR's CI went green (no conflict): merge now;
  main's full suite checks the combination and a red main is reverted.
- Expo project ID: 0458c1dd-61a0-47f7-ac52-c648b4458fea (`eas init --id …`)
- Supabase project ref: wghftsubdrkxfzysovou

## Stack
_To be filled after the technical design (`/plan-work`). Fixed so far: Expo (React Native +
TypeScript), Expo Go compatible throughout the demo phase; Supabase (free) for auth, database and
storage; Google Gemini free tier for import parsing, behind a switch (Claude in Phase B)._

## Commands
_After Epic 0._

## Structure
_After Epic 0._

## Conventions
_After the technical design._

## Testing
_After the technical design. Scenario links use deep links (e.g. `trip://scenario/vegas-day-3`),
disabled for real accounts._
